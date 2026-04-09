#!/usr/bin/env node
try { await import("dotenv/config"); } catch { /* dotenv optional — env vars may already be set */ }
import { program } from "commander";
import { loadConfig } from "../core/config/manager.js";
import { VERSION, DEFAULT_MODEL } from "../core/utils/constants.js";

program
  .name("fivetran")
  .description("Conversational Fivetran management agent powered by Claude")
  .version(VERSION)
  .option("--model <model>", "Claude model to use (haiku=fast, sonnet=default, opus=complex)", DEFAULT_MODEL)
  .option("-q, --query <text>", "Run a single query and exit (non-interactive)")
  .option("-o, --output <format>", "Output format: json, compact, table (default: table)", "table")
  .option("--auto", "Auto-execute write operations without confirmation prompts")
  .option("--dry-run", "Show what write operations would do without executing them (plan mode)")
  .option("--plain", "Strip emoji and markdown from output (agent-friendly)")
  .option("--timeout <seconds>", "Max execution time in seconds (default: 120)", "120")
  .option("--quiet", "Suppress banner and progress output (only results to stdout)")
  .option("--no-color", "Strip ANSI color codes from output")
  .option("--debug", "Enable debug logging (includes tool_calls in JSON output)")
  .parse();

const options = program.opts<{
  model: string;
  query?: string;
  output: string;
  auto: boolean;
  dryRun: boolean;
  plain: boolean;
  timeout: string;
  quiet: boolean;
  color: boolean;  // commander inverts --no-color to color: false
  debug: boolean;
}>();

// ── Env var defaults: FIVETRAN_QUIET, FIVETRAN_NO_COLOR, FIVETRAN_PLAIN ──
const quiet = options.quiet || process.env.FIVETRAN_QUIET === "1";
const noColor = !options.color || process.env.FIVETRAN_NO_COLOR === "1";
const plain = options.plain || process.env.FIVETRAN_PLAIN === "1";

const config = await loadConfig();

// ── Non-interactive mode: --query flag ──
if (options.query) {
  const { runOneShot, formatOutput } = await import("./oneshot.js");

  if (!config) {
    process.stderr.write("Error: No credentials configured. See ~/.fivetran-code/config.json\n");
    process.exit(1);
  }

  const result = await runOneShot({
    config,
    model: options.model,
    query: options.query,
    output: options.output as "json" | "compact" | "table",
    autoExecute: options.auto ?? false,
    dryRun: options.dryRun ?? false,
    timeoutMs: parseInt(options.timeout) * 1000,
    quiet,
    noColor,
    plain,
    debug: options.debug ?? false,
  });

  // Results to stdout, errors already went to stderr
  const formatted = formatOutput(result, options.output as "json" | "compact" | "table", {
    noColor,
    plain,
    debug: options.debug ?? false,
  });
  process.stdout.write(formatted + "\n");

  process.exit(result.success ? 0 : 1);
}

// ── Interactive REPL mode (default) ──
const { render } = await import("ink");
const { App } = await import("./app.js");

const blue = "\x1b[1m\x1b[34m";
const dim = "\x1b[2m";
const reset = "\x1b[0m";
console.log(`
${blue}  ___ _         _                    ___         _     ${reset}
${blue} | __(_)_ _____| |_ _ _ __ _ _ _   / __|___  __| |___ ${reset}
${blue} | _|| \\ V / -_)  _| '_/ _\` | ' \\ | (__/ _ \\/ _\` / -_)${reset}
${blue} |_| |_|\\_/\\___|\\__|_| \\__,_|_||_| \\___\\___/\\__,_\\___|${reset}
${dim}  v${VERSION} — Conversational Fivetran management${reset}
${dim}  Powered by Claude. Type a question or /help. /exit to quit.${reset}
`);

const { waitUntilExit } = render(
  <App initialConfig={config} model={options.model} />
);

await waitUntilExit();
