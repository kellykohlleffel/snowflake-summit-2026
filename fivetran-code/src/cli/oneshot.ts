import { createClaudeClient } from "../core/agent/claude-client.js";
import { Conversation } from "../core/agent/conversation.js";
import { runAgentLoop, type AgentCallbacks } from "../core/agent/loop.js";
import type { SystemPromptOptions } from "../core/agent/system-prompt.js";
import { initFivetranApi } from "../core/api/client.js";
import { mcpManager } from "../core/mcp/index.js";
import { toolRegistry } from "../core/tools/index.js";
import { initSnowflakeConfig } from "../core/tools/query-cortex-agent.js";
import { discoverSkills, getAllSkills, loadSkillContent } from "../core/skills/index.js";
import { loadPreferences } from "../core/preferences/loader.js";
import type { AppConfig } from "../core/config/types.js";
import { MAX_TOOL_ROUNDS } from "../core/utils/constants.js";

export interface OneShotOptions {
  config: AppConfig;
  model: string;
  query: string;
  output: "json" | "compact" | "table";
  autoExecute: boolean;
  dryRun: boolean;
  timeoutMs: number;
  quiet: boolean;
  noColor: boolean;
  plain: boolean;
  debug: boolean;
}

interface OneShotResult {
  success: boolean;
  response: string;
  toolCalls: { name: string; success: boolean; error?: string }[];
}

/**
 * Run a single query through the agent loop and return the result.
 * No interactive UI — designed for subprocess/scripting use.
 *
 * - Results go to stdout (parseable by calling process)
 * - Progress/errors go to stderr (visible but doesn't pollute stdout)
 * - Exits cleanly so the calling process can continue
 */
export async function runOneShot(options: OneShotOptions): Promise<OneShotResult> {
  const { config, model, query, output, autoExecute, dryRun, timeoutMs, quiet, noColor } = options;

  const log = quiet
    ? () => {}
    : (msg: string) => process.stderr.write(msg + "\n");

  // Initialize
  const client = createClaudeClient(config.anthropicApiKey, config.anthropicAuthToken);
  initFivetranApi(config.fivetranApiKey, config.fivetranApiSecret);
  // Initialize Snowflake Cortex Agent config if credentials are present.
  // Without this, query_cortex_agent returns a "not configured" error even
  // when the config file has valid credentials. VSCode, interactive CLI, and
  // MCP server frontends already do this — oneshot was the only gap.
  if (config.snowflakeAccount && config.snowflakePatToken) {
    initSnowflakeConfig(config.snowflakeAccount, config.snowflakePatToken);
  }

  log("Initializing...");

  // Initialize MCP, skills, preferences (non-blocking failures)
  let promptOptions: SystemPromptOptions = {};
  try {
    const [, , preferences] = await Promise.all([
      mcpManager.initialize().then(() => {
        toolRegistry.registerDynamicTools(mcpManager.getTools());
      }),
      discoverSkills(),
      loadPreferences(process.cwd()),
    ]);
    promptOptions = {
      mcpServers: mcpManager.getConnectedServerNames(),
      skills: getAllSkills(),
      preferences,
    };
    log(`Ready — ${toolRegistry.getAllTools().length} tools loaded`);
  } catch {
    log("Warning: MCP/skills init failed, continuing with built-in tools only");
  }

  // Process skill slash commands
  let processedQuery = query;
  if (query.startsWith("/")) {
    const spaceIdx = query.indexOf(" ");
    const skillName = spaceIdx > 0 ? query.slice(1, spaceIdx) : query.slice(1);
    const skillContent = await loadSkillContent(skillName);
    if (skillContent) {
      const userRequest = spaceIdx > 0 ? query.slice(spaceIdx + 1) : "";
      processedQuery = `[Skill: ${skillName}]\n\n${skillContent}\n\nUser request: ${userRequest}`;
    }
  }

  // Collect results
  const conversation = new Conversation();
  let fullText = "";
  const toolCalls: OneShotResult["toolCalls"] = [];

  const callbacks: AgentCallbacks = {
    onStreamText: (text) => {
      fullText += text;
    },
    onStreamEnd: () => {},
    onToolCallStart: (name) => {
      log(`  [tool] ${name}...`);
    },
    onToolCallEnd: (name, result) => {
      toolCalls.push({ name, success: result.success, error: result.error });
      const icon = result.success ? "✓" : "✗";
      log(`  [tool] ${icon} ${name}`);
    },
    onConfirmationRequired: (name) => {
      if (autoExecute) {
        log(`  [auto] Executing ${name}`);
        return Promise.resolve(true);
      }
      log(`  [denied] ${name} — use --auto to allow write operations`);
      return Promise.resolve(false);
    },
    onComplete: () => {},
    onError: (error) => {
      process.stderr.write(`Error: ${error.message}\n`);
    },
  };

  // Run with timeout
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`Query timed out after ${timeoutMs / 1000}s`)), timeoutMs)
  );

  try {
    await Promise.race([
      runAgentLoop(client, conversation, processedQuery, callbacks, {
        model,
        maxToolRounds: MAX_TOOL_ROUNDS,
        promptOptions,
        mode: dryRun ? "plan" : autoExecute ? "auto" : "confirm",
      }),
      timeoutPromise,
    ]);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`Error: ${errorMsg}\n`);
    await mcpManager.shutdown();
    return { success: false, response: errorMsg, toolCalls };
  }

  // Shutdown MCP
  await mcpManager.shutdown();

  return { success: true, response: fullText, toolCalls };
}

/** Strip ANSI escape codes from a string. */
export function stripAnsi(str: string): string {
  return str.replace(/\x1b\[[0-9;]*m/g, "");
}

/** Format the result for stdout based on the requested output format. */
export function formatOutput(
  result: OneShotResult,
  format: "json" | "compact" | "table",
  opts: { noColor: boolean; plain: boolean; debug: boolean }
): string {
  let text = result.response;

  // --plain: strip emoji and markdown for agent-friendly output
  if (opts.plain) {
    text = stripPlain(text);
  }

  if (format === "json") {
    const obj: Record<string, unknown> = {
      success: result.success,
      response: text,
    };
    // tool_calls only included with --debug
    if (opts.debug) {
      obj.tool_calls = result.toolCalls;
    }
    return JSON.stringify(obj, null, 2);
  }

  if (format === "compact") {
    text = text
      .replace(/\*\*(.+?)\*\*/g, "$1")  // strip bold
      .replace(/^#{1,3} /gm, "")         // strip headers
      .replace(/^\s*[-*] /gm, "  ")      // simplify lists
      .trim();
    return opts.noColor ? stripAnsi(text) : text;
  }

  // "table" — default: full response as-is (markdown)
  text = text.trim();
  return opts.noColor ? stripAnsi(text) : text;
}

/** Strip emoji characters and markdown formatting for agent-friendly output. */
function stripPlain(text: string): string {
  return text
    // Strip emoji (common Unicode ranges)
    .replace(/[\u{1F600}-\u{1F64F}]/gu, "")   // emoticons
    .replace(/[\u{1F300}-\u{1F5FF}]/gu, "")   // symbols & pictographs
    .replace(/[\u{1F680}-\u{1F6FF}]/gu, "")   // transport & map
    .replace(/[\u{1F900}-\u{1F9FF}]/gu, "")   // supplemental
    .replace(/[\u{2600}-\u{26FF}]/gu, "")     // misc symbols
    .replace(/[\u{2700}-\u{27BF}]/gu, "")     // dingbats
    .replace(/[\u{FE00}-\u{FE0F}]/gu, "")     // variation selectors
    .replace(/[\u{200D}]/gu, "")               // zero-width joiner
    // Strip markdown formatting
    .replace(/\*\*(.+?)\*\*/g, "$1")          // bold
    .replace(/\*(.+?)\*/g, "$1")              // italic
    .replace(/^#{1,6} /gm, "")                // headers
    .replace(/^---+$/gm, "")                  // dividers
    .replace(/^\s*[-*] /gm, "- ")             // normalize lists
    .replace(/\n{3,}/g, "\n\n")               // collapse blank lines
    .trim();
}
