import { createClaudeClient } from "../core/agent/claude-client.js";
import { Conversation } from "../core/agent/conversation.js";
import { runAgentLoop, type AgentCallbacks } from "../core/agent/loop.js";
import type { SystemPromptOptions } from "../core/agent/system-prompt.js";
import { SessionTracker } from "../core/agent/usage-tracker.js";
import { initFivetranApi } from "../core/api/client.js";
import { initSnowflakeConfig } from "../core/tools/query-cortex-agent.js";
import { mcpManager } from "../core/mcp/index.js";
import { toolRegistry } from "../core/tools/index.js";
import { discoverSkills, getAllSkills, loadSkillContent } from "../core/skills/index.js";
import { loadPreferences } from "../core/preferences/loader.js";
import type { AppConfig, ApiKeyProfile } from "../core/config/types.js";
import { MAX_TOOL_ROUNDS } from "../core/utils/constants.js";
import type Anthropic from "@anthropic-ai/sdk";
import type { ContentBlockParam } from "@anthropic-ai/sdk/resources/messages";

/** File attachment sent from the webview. */
export interface Attachment {
  name: string;
  mimeType: string;
  encoding: "text" | "base64";
  data: string;
}

/**
 * Message types sent from extension host to webview.
 */
export type ExtensionMessage =
  | { type: "streamText"; text: string }
  | { type: "streamEnd" }
  | { type: "toolCallStart"; name: string; input: Record<string, unknown> }
  | { type: "toolCallEnd"; name: string; success: boolean; error?: string }
  | { type: "confirmationRequired"; name: string; input: Record<string, unknown> }
  | { type: "complete"; fullText: string }
  | { type: "error"; message: string }
  | { type: "ready" }
  | { type: "metadata"; skills: { name: string; description: string }[]; mcpServers: string[]; model: string; accounts: { name: string }[]; activeAccount: string; apiKeyProfiles: { label: string }[]; activeApiKey: string }
  | { type: "modelChanged"; model: string }
  | { type: "accountChanged"; account: string }
  | { type: "apiKeyChanged"; label: string }
  | { type: "toolProgress"; name: string; text: string }
  | { type: "openUrl"; url: string }
  | { type: "compactChanged"; compact: boolean }
  | { type: "usageUpdate"; metrics: { totalInputTokens: number; totalOutputTokens: number; totalCacheCreationTokens: number; totalCacheReadTokens: number; totalApiCalls: number; estimatedCostUsd: number; cacheHitRate: number; contextUsagePercent: number }; model: string; apiKeyLabel: string };

/**
 * Bridges the core agent engine to the VSCode webview via message passing.
 */
export class AgentController {
  private client: Anthropic;
  private conversation = new Conversation();
  private model: string;
  private postMessage: (message: ExtensionMessage) => void;
  private pendingConfirmation: ((confirmed: boolean) => void) | null = null;
  private promptOptions: SystemPromptOptions = {};
  private initialized = false;
  private accounts: { name: string }[] = [];
  private activeAccount = "";
  private compact = false;
  private abortController: AbortController | null = null;
  private sessionTracker: SessionTracker;
  private apiKeyProfiles: ApiKeyProfile[] = [];
  private activeApiKeyLabel = "";
  private authToken?: string;

  constructor(
    config: AppConfig,
    model: string,
    postMessage: (message: ExtensionMessage) => void
  ) {
    this.client = createClaudeClient(config.anthropicApiKey, config.anthropicAuthToken);
    this.model = model;
    this.postMessage = postMessage;
    this.sessionTracker = new SessionTracker(model);
    this.authToken = config.anthropicAuthToken;
    initFivetranApi(config.fivetranApiKey, config.fivetranApiSecret);
    if (config.snowflakeAccount && config.snowflakePatToken) {
      initSnowflakeConfig(config.snowflakeAccount, config.snowflakePatToken);
    }

    // Initialize API key profiles from config
    if (config.anthropicApiKeys?.length) {
      this.apiKeyProfiles = config.anthropicApiKeys;
      // Set active label to the profile matching the current key, or first profile
      const match = this.apiKeyProfiles.find((p) => p.key === config.anthropicApiKey);
      this.activeApiKeyLabel = match?.label ?? this.apiKeyProfiles[0].label;
    }
  }

  /**
   * Initialize MCP servers, discover skills, and load preferences.
   * Call once after construction. Non-blocking — failures don't prevent usage.
   */
  async initialize(workspaceRoot?: string): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;

    try {
      const [, , preferences] = await Promise.all([
        mcpManager.initialize().then(() => {
          toolRegistry.registerDynamicTools(mcpManager.getTools());
        }),
        discoverSkills(),
        loadPreferences(workspaceRoot),
      ]);

      this.promptOptions = {
        mcpServers: mcpManager.getConnectedServerNames(),
        skills: getAllSkills(),
        preferences,
      };

      // Load Fivetran account data from MCP server (if available)
      await this.loadAccountData();
    } catch {
      // Non-blocking — MCP/skills/preferences failures don't prevent usage
    }
  }

  async handleUserMessage(text: string, mode?: "confirm" | "auto" | "plan", attachments?: Attachment[]): Promise<void> {
    // Handle built-in commands — these never reach Claude
    const trimmed = text.trim().toLowerCase();
    if (trimmed === "/clear") {
      this.conversation.clear();
      return;
    }
    if (trimmed === "/compact") {
      this.compact = !this.compact;
      this.promptOptions.compact = this.compact;
      const state = this.compact ? "ON" : "OFF";
      this.postMessage({ type: "streamText", text: `Compact mode **${state}**` });
      this.postMessage({ type: "streamEnd" });
      this.postMessage({ type: "complete", fullText: "" });
      this.postMessage({ type: "compactChanged", compact: this.compact } as ExtensionMessage);
      return;
    }
    if (trimmed === "/help") {
      this.postMessage({
        type: "streamText",
        text: "**Fivetran Code v0.3** — Available commands:\n\n" +
          "- `/clear` — Clear conversation history (resets session tracker)\n" +
          "- `/help` — Show this help\n" +
          "- `/account` — View session info, usage metrics, and configuration\n" +
          "- `/memory` — Open CLAUDE.md preference files\n" +
          "- `/settings` — Open Fivetran extension settings\n" +
          "- `/terminal` — Launch Fivetran CLI in terminal\n" +
          "- `/docs` — Open project README\n" +
          "- `/voice` — Toggle voice input (microphone)\n" +
          "- `/compact` — Toggle compact mode (concise responses)\n" +
          "- `/skill-name` — Invoke a skill (type `/` to see available skills)\n\n" +
          "**Modes** (toolbar above input):\n" +
          "- **Confirm actions** — Ask before executing write operations (default)\n" +
          "- **Auto-execute** — Execute all operations without asking\n" +
          "- **Plan mode** — Read-only; describe what write operations would do without executing them\n\n" +
          "**Context meter** — the footer bar shows context usage %, tokens, cache hit rate, and session cost. Yellow at 50%, red at 80%.\n\n" +
          "Try: \"Which connectors are broken?\" or \"List my groups\"",
      });
      this.postMessage({ type: "streamEnd" });
      this.postMessage({ type: "complete", fullText: "" });
      return;
    }
    if (trimmed === "/account") {
      const meta = this.getMetadata();
      const conversationLen = this.conversation.length;
      const totalTools = toolRegistry.getAllTools().length;
      const mcpCount = meta.mcpServers.length;
      const mcpNames = mcpCount > 0 ? meta.mcpServers.join(", ") : "None";
      const accountName = this.activeAccount || "Default";

      const metrics = this.sessionTracker.getMetrics();
      const totalTokens = metrics.totalInputTokens + metrics.totalOutputTokens;
      const tokenStr = totalTokens > 1000 ? `${(totalTokens / 1000).toFixed(1)}K` : String(totalTokens);

      this.postMessage({
        type: "streamText",
        text: "## Fivetran Code — Account & Usage\n\n" +
          "### Session\n" +
          `- **Fivetran account:** ${accountName}\n` +
          `- **Claude API key:** ${this.activeApiKeyLabel || "API Key"}\n` +
          `- **Model:** ${this.model}\n` +
          `- **Conversation:** ${conversationLen} messages\n\n` +
          "### Usage (this session)\n" +
          `- **API calls:** ${metrics.totalApiCalls}\n` +
          `- **Tokens:** ${tokenStr} (in: ${metrics.totalInputTokens.toLocaleString()}, out: ${metrics.totalOutputTokens.toLocaleString()})\n` +
          `- **Cache hit rate:** ${(metrics.cacheHitRate * 100).toFixed(0)}%\n` +
          `- **Context usage:** ${metrics.contextUsagePercent.toFixed(0)}%\n` +
          `- **Estimated cost:** $${metrics.estimatedCostUsd.toFixed(4)}\n\n` +
          "### Configuration\n" +
          `- **Tools:** ${totalTools} (18 Fivetran + ${totalTools - 18} MCP)\n` +
          `- **MCP servers:** ${mcpCount} (${mcpNames})\n` +
          `- **Skills:** ${meta.skills.length}\n`,
      });
      this.postMessage({ type: "streamEnd" });
      this.postMessage({ type: "complete", fullText: "" });
      return;
    }

    // Check for skill slash commands (e.g., /dbt-project-builder ...)
    let processedText = text;
    if (text.startsWith("/")) {
      const spaceIdx = text.indexOf(" ");
      const skillName = spaceIdx > 0 ? text.slice(1, spaceIdx) : text.slice(1);
      const skillContent = await loadSkillContent(skillName);
      if (skillContent) {
        const userRequest = spaceIdx > 0 ? text.slice(spaceIdx + 1) : "";
        const effectiveRequest = userRequest || "Start. Show the roadmap and ask which option to use.";
        processedText = `[Skill: ${skillName}]\n\n${skillContent}\n\nUser request: ${effectiveRequest}`;
      }
    }

    const callbacks: AgentCallbacks = {
      onStreamText: (delta) => {
        this.postMessage({ type: "streamText", text: delta });
      },
      onStreamEnd: () => {
        this.postMessage({ type: "streamEnd" });
      },
      onToolCallStart: (name, input) => {
        this.postMessage({ type: "toolCallStart", name, input });
      },
      onToolProgress: (name, text) => {
        this.postMessage({ type: "toolProgress", name, text });
      },
      onToolCallEnd: (name, result) => {
        this.postMessage({
          type: "toolCallEnd",
          name,
          success: result.success,
          error: result.error,
        });
        // Auto-open browser for tools that return URLs (e.g., open_connector_setup)
        if (result.success && result.data && typeof result.data === "object") {
          const data = result.data as Record<string, unknown>;
          if (typeof data.url === "string" && data.url.startsWith("https://")) {
            this.postMessage({ type: "openUrl", url: data.url });
          }
        }
      },
      onConfirmationRequired: (name, input) => {
        return new Promise<boolean>((resolve) => {
          this.pendingConfirmation = resolve;
          this.postMessage({ type: "confirmationRequired", name, input });
        });
      },
      onComplete: (fullText) => {
        // Append session elapsed time only after the SOLUTION COMPLETE closing block
        if (fullText.includes("SOLUTION COMPLETE")) {
          const elapsed = this.sessionTracker.getMetrics().elapsedSeconds;
          const mins = Math.ceil(elapsed / 60);
          this.postMessage({ type: "streamText", text: `\n\n**Session elapsed time: ${mins} minutes**` });
          this.postMessage({ type: "streamEnd" });
        }
        this.postMessage({ type: "complete", fullText });
      },
      onError: (error) => {
        this.postMessage({ type: "error", message: error.message });
      },
      onUsageUpdate: (_turnUsage, sessionMetrics) => {
        this.postMessage({ type: "usageUpdate", metrics: sessionMetrics, model: this.model, apiKeyLabel: this.activeApiKeyLabel || "API Key" });
      },
    };

    // Build multimodal content blocks when attachments are present
    const userContent = attachments?.length
      ? this.buildContentBlocks(processedText, attachments)
      : processedText;

    this.abortController = new AbortController();

    console.error(`[Fivetran Code] Sending message to Claude (model: ${this.model}, text length: ${typeof userContent === "string" ? userContent.length : "multimodal"}, conversation length: ${this.conversation.length})`);

    await runAgentLoop(this.client, this.conversation, userContent, callbacks, {
      model: this.model,
      maxToolRounds: MAX_TOOL_ROUNDS,
      promptOptions: this.promptOptions,
      mode: mode ?? "confirm",
      signal: this.abortController.signal,
      sessionTracker: this.sessionTracker,
    });

    this.abortController = null;
  }

  /** Convert attachments + text into Claude API content blocks. */
  private buildContentBlocks(text: string, attachments: Attachment[]): ContentBlockParam[] {
    const blocks: ContentBlockParam[] = [];

    for (const att of attachments) {
      if (att.mimeType.startsWith("image/")) {
        blocks.push({
          type: "image",
          source: {
            type: "base64",
            media_type: att.mimeType as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
            data: att.data,
          },
        });
      } else if (att.mimeType === "application/pdf") {
        blocks.push({
          type: "document",
          source: {
            type: "base64",
            media_type: "application/pdf",
            data: att.data,
          },
          title: att.name,
        } as ContentBlockParam);
      } else {
        // Text/code files — wrap in a labeled code block
        const ext = att.name.split(".").pop() ?? "";
        blocks.push({
          type: "text",
          text: `[Attached file: ${att.name}]\n\`\`\`${ext}\n${att.data}\n\`\`\``,
        });
      }
    }

    // User's typed message always comes last
    blocks.push({ type: "text", text });
    return blocks;
  }

  /** Switch the model for subsequent API calls. */
  setModel(model: string): void {
    this.model = model;
    this.sessionTracker.setModel(model);
  }

  /** Get the current model. */
  getModel(): string {
    return this.model;
  }

  /** Switch the active Claude API key by profile label. Recreates the client. */
  switchApiKey(label: string): boolean {
    const profile = this.apiKeyProfiles.find((p) => p.label === label);
    if (!profile) return false;
    this.client = createClaudeClient(profile.key, this.authToken);
    this.activeApiKeyLabel = label;
    return true;
  }

  /** Get available API key profiles. */
  getApiKeyProfiles(): ApiKeyProfile[] {
    return this.apiKeyProfiles;
  }

  /** Get the label of the active API key profile. */
  getActiveApiKeyLabel(): string {
    return this.activeApiKeyLabel;
  }

  cancelRequest(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
      this.pendingConfirmation = null;
      this.postMessage({ type: "complete", fullText: "(Cancelled by user)" });
    }
  }

  respondToConfirmation(confirmed: boolean): void {
    if (this.pendingConfirmation) {
      this.pendingConfirmation(confirmed);
      this.pendingConfirmation = null;
    }
  }

  clearHistory(): void {
    this.conversation.clear();
    this.sessionTracker.reset();
  }

  /**
   * Load Fivetran account list from the fivetran2 MCP server.
   */
  private async loadAccountData(): Promise<void> {
    try {
      const listTool = toolRegistry.getTool("mcp__fivetran2__list_accounts");

      if (listTool) {
        const result = await listTool.execute({});
        if (result.success && result.data) {
          const data = typeof result.data === "string" ? JSON.parse(result.data) : result.data;
          // accounts is a string array: ["MDS_SNOWFLAKE_HOL", ...]
          if (Array.isArray(data.accounts)) {
            this.accounts = data.accounts.map((a: string | { name: string }) =>
              typeof a === "string" ? { name: a } : { name: a.name }
            );
          }
          // list_accounts also returns current_account
          if (data.current_account) {
            this.activeAccount = data.current_account;
          }
        }
      }

      // Fallback: get_current_account if list_accounts didn't provide it
      if (!this.activeAccount) {
        const currentTool = toolRegistry.getTool("mcp__fivetran2__get_current_account");
        if (currentTool) {
          const result = await currentTool.execute({});
          if (result.success && result.data) {
            const data = typeof result.data === "string" ? JSON.parse(result.data) : result.data;
            this.activeAccount = data.current_account_name ?? data.current_account ?? "";
          }
        }
      }
    } catch {
      // Non-blocking — account data is optional
    }
  }

  /**
   * Switch the active Fivetran account via MCP server.
   */
  async switchAccount(accountName: string): Promise<boolean> {
    try {
      const tool = toolRegistry.getTool("mcp__fivetran2__switch_account");
      if (!tool) return false;

      const result = await tool.execute({ account_name: accountName });
      if (result.success) {
        this.activeAccount = accountName;
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  /** Get the active account name. */
  getActiveAccount(): string {
    return this.activeAccount;
  }

  /** Get the list of available accounts. */
  getAccounts(): { name: string }[] {
    return this.accounts;
  }

  /**
   * Get skills, MCP server info, model, account, and API key data for the webview UI.
   */
  getMetadata(): { skills: { name: string; description: string }[]; mcpServers: string[]; model: string; accounts: { name: string }[]; activeAccount: string; apiKeyProfiles: { label: string }[]; activeApiKey: string } {
    return {
      skills: getAllSkills().map((s) => ({ name: s.name, description: s.description })),
      mcpServers: mcpManager.getConnectedServerNames(),
      model: this.model,
      accounts: this.accounts,
      activeAccount: this.activeAccount,
      apiKeyProfiles: this.apiKeyProfiles.map((p) => ({ label: p.label })),
      activeApiKey: this.activeApiKeyLabel,
    };
  }

  /**
   * Gracefully shut down MCP connections on deactivation.
   */
  async shutdown(): Promise<void> {
    await mcpManager.shutdown();
  }
}
