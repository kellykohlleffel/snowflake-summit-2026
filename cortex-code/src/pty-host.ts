import {
  spawn as childSpawn,
  execFileSync,
  type ChildProcessWithoutNullStreams,
} from "child_process";
import { existsSync } from "fs";
import { isAbsolute } from "path";

/**
 * Manages a single cortex subprocess running in stream-json mode.
 *
 * Architecture:
 *   - Spawns `cortex --output-format stream-json --input-format stream-json
 *     --dangerously-allow-all-tool-calls --allowed-tools <list...>` as a
 *     plain child_process.spawn with piped stdio
 *   - NO PTY needed: stream-json mode doesn't require a TTY (it uses
 *     newline-delimited JSON for I/O, not terminal drawing)
 *   - NO Python bridge needed
 *   - NO terminal emulation needed
 *   - Cortex emits structured JSON events to stdout: assistant messages,
 *     tool calls, tool results, completion markers. Each line is one
 *     complete JSON object.
 *   - We send user messages as JSON lines to stdin:
 *     {"type":"user","message":{"role":"user","content":[{"type":"text","text":"..."}]}}
 *
 * The allowed-tools list is required because cortex's stream-json interactive
 * mode does NOT auto-approve MCP tool calls even with
 * --dangerously-allow-all-tool-calls. We explicitly enumerate the known
 * HOL-safe tools (fivetran-code + se-demo MCP servers).
 *
 * This class is transport-agnostic: it knows nothing about VSCode, webviews,
 * or chat bubbles. Its only job is to run cortex and shuttle bytes.
 */
export interface CortexHostOptions {
  /** Path to the cortex binary */
  binary: string;
  /** Working directory for the subprocess */
  cwd: string;
  /** Extra environment variables to merge with process.env */
  env?: Record<string, string>;
  /** List of tool names to pass to --allowed-tools */
  allowedTools?: string[];
}

export type CortexDataCallback = (chunk: string) => void;
export type CortexExitCallback = (code: number | null, signal: string | null) => void;

/**
 * Default allowlist of MCP tools that the HOL skill needs. This is hardcoded
 * because cortex's interactive stream-json mode requires explicit --allowed-tools
 * enumeration even with --dangerously-allow-all-tool-calls. Built-in tools
 * (read, write, bash, etc.) are NOT auto-allowed either — we opt out of most
 * of them to keep the tool surface focused on Fivetran + Snowflake workflows.
 *
 * Add new tools here when the HOL skill grows to use them. The list is
 * order-independent.
 */
export const DEFAULT_ALLOWED_TOOLS: string[] = [
  // Cortex Code built-in tools — all permitted for the HOL context.
  // Skills frequently use read/glob/task/bash to load reference files,
  // spawn sub-agents, and orchestrate multi-step workflows. Without these,
  // skills fail with "Permission denied" as soon as they try to read a
  // reference file. HOL attendees are running pre-vetted demos, so the
  // broader surface is acceptable.
  "read",
  "write",
  "edit",
  "bash",
  "bash_output",
  "kill_shell",
  "grep",
  "glob",
  "data_diff",
  "notebook_actions",
  "web_fetch",
  "web_search",
  "snowflake_sql_execute",
  "fdbt",
  "ask_user_question",
  "task",
  "enter_plan_mode",
  "exit_plan_mode",
  "send_message",
  "team_create",
  "team_delete",
  "system_todo_write",
  // fivetran-code MCP server tools
  "mcp__fivetran-code__list_groups",
  "mcp__fivetran-code__get_group_details",
  "mcp__fivetran-code__list_connections_in_group",
  "mcp__fivetran-code__get_connection_details",
  "mcp__fivetran-code__list_destinations",
  "mcp__fivetran-code__get_destination_details",
  "mcp__fivetran-code__list_users",
  "mcp__fivetran-code__get_schema_config",
  "mcp__fivetran-code__list_transformations",
  "mcp__fivetran-code__get_transformation_details",
  "mcp__fivetran-code__test_connection",
  "mcp__fivetran-code__open_connector_setup",
  "mcp__fivetran-code__get_connector_metadata",
  "mcp__fivetran-code__reload_schema",
  "mcp__fivetran-code__trigger_sync",
  "mcp__fivetran-code__pause_connection",
  "mcp__fivetran-code__resume_connection",
  "mcp__fivetran-code__create_connection",
  "mcp__fivetran-code__delete_connection",
  "mcp__fivetran-code__update_schema_config",
  "mcp__fivetran-code__create_transformation",
  "mcp__fivetran-code__trigger_transformation",
  "mcp__fivetran-code__approve_certificate",
  "mcp__fivetran-code__approve_fingerprint",
  "mcp__fivetran-code__setup_postgresql_connection",
  "mcp__fivetran-code__query_cortex_agent",
  // se-demo MCP server tools
  "mcp__se-demo__run_snowflake_query",
  "mcp__se-demo__dbt_run",
  "mcp__se-demo__dbt_test",
  "mcp__se-demo__create_demo_cortex_agent",
  "mcp__se-demo__list_cortex_agents",
  "mcp__se-demo__cortex_analyst",
  "mcp__se-demo__activate_to_app",
  "mcp__se-demo__reset_activation_app",
  "mcp__se-demo__cleanup_demo",
];

export class CortexHost {
  private process: ChildProcessWithoutNullStreams | null = null;
  private dataCallbacks: CortexDataCallback[] = [];
  private exitCallbacks: CortexExitCallback[] = [];
  private disposed = false;
  private stdoutBuffer = "";

  constructor(private options: CortexHostOptions) {}

  /** Spawn the subprocess. Must be called before write(). */
  start(): void {
    if (this.process) {
      throw new Error("CortexHost already started");
    }
    if (this.disposed) {
      throw new Error("CortexHost has been disposed");
    }

    const { binary, cwd, env: extraEnv = {}, allowedTools = DEFAULT_ALLOWED_TOOLS } = this.options;

    // Merge env: start with process.env, extend PATH, overlay extras
    const env: Record<string, string> = {};
    for (const [k, v] of Object.entries(process.env)) {
      if (typeof v === "string") env[k] = v;
    }
    env["PATH"] = extendPath(env["PATH"]);
    for (const [k, v] of Object.entries(extraEnv)) {
      env[k] = v;
    }

    // Resolve the binary to an absolute path
    const resolvedBinary = resolveBinaryAbsolute(binary, env["PATH"]);
    if (!resolvedBinary) {
      throw new Error(
        `cortex binary not found on PATH: "${binary}". Checked PATH: ${env["PATH"]}. ` +
          `Set 'cortexCodeForVscode.binaryPath' to an absolute path in VSCode settings.`
      );
    }

    // Build the cortex args.
    //   --dangerously-allow-all-tool-calls: required for interactive stream-json mode
    //   --allowed-tools: explicit allowlist for MCP tool calls
    //   --include-partial-messages: enables token-by-token streaming via
    //     Anthropic-style content_block_delta events (so users see the
    //     assistant response being typed in real time instead of appearing
    //     all at once at the end)
    const args: string[] = [
      "--output-format",
      "stream-json",
      "--input-format",
      "stream-json",
      "--include-partial-messages",
      "--dangerously-allow-all-tool-calls",
      "--allowed-tools",
      ...allowedTools,
    ];

    try {
      this.process = childSpawn(resolvedBinary, args, {
        cwd,
        env,
        stdio: ["pipe", "pipe", "pipe"],
      }) as ChildProcessWithoutNullStreams;
    } catch (err) {
      const origMsg = err instanceof Error ? err.message : String(err);
      throw new Error(
        `cortex spawn failed:\n  error: ${origMsg}\n  binary: ${resolvedBinary}\n` +
          `  args: ${JSON.stringify(args)}\n  cwd: ${cwd}`
      );
    }

    // Wire stdout: buffer bytes, split into complete lines, emit each as a
    // data event. Incomplete trailing line is held in stdoutBuffer for the
    // next chunk.
    this.process.stdout.on("data", (chunk: Buffer) => {
      this.stdoutBuffer += chunk.toString("utf-8");
      let newlineIdx;
      while ((newlineIdx = this.stdoutBuffer.indexOf("\n")) >= 0) {
        const line = this.stdoutBuffer.slice(0, newlineIdx);
        this.stdoutBuffer = this.stdoutBuffer.slice(newlineIdx + 1);
        if (line.length > 0) {
          this.emitData(line);
        }
      }
    });

    // stderr: surface any cortex warnings/errors as raw data so the webview
    // can display them (not parsed as JSON events — they're debug output)
    this.process.stderr.on("data", (chunk: Buffer) => {
      const text = chunk.toString("utf-8");
      // Prefix stderr lines so the parser can distinguish them from JSON
      for (const line of text.split("\n")) {
        if (line.trim().length > 0) {
          this.emitData(`[stderr] ${line}`);
        }
      }
    });

    this.process.on("error", (err) => {
      this.emitData(`[stderr] subprocess error: ${err.message}`);
    });

    this.process.on("close", (code, signal) => {
      // Flush any trailing buffered line
      if (this.stdoutBuffer.length > 0) {
        this.emitData(this.stdoutBuffer);
        this.stdoutBuffer = "";
      }
      for (const cb of this.exitCallbacks) {
        try {
          cb(code ?? null, signal !== null ? String(signal) : null);
        } catch (err) {
          console.error("[CortexHost] onExit callback threw:", err);
        }
      }
      this.process = null;
    });
  }

  private emitData(line: string): void {
    for (const cb of this.dataCallbacks) {
      try {
        cb(line);
      } catch (err) {
        console.error("[CortexHost] onData callback threw:", err);
      }
    }
  }

  /** Write a complete JSON line (without trailing newline) to cortex stdin. */
  writeJsonLine(obj: unknown): void {
    if (!this.process || !this.process.stdin.writable) {
      return;
    }
    try {
      const line = JSON.stringify(obj) + "\n";
      this.process.stdin.write(line);
    } catch (err) {
      console.error("[CortexHost] writeJsonLine failed:", err);
    }
  }

  /** Subscribe to one-complete-line events from cortex stdout. */
  onData(callback: CortexDataCallback): () => void {
    this.dataCallbacks.push(callback);
    return () => {
      const idx = this.dataCallbacks.indexOf(callback);
      if (idx >= 0) this.dataCallbacks.splice(idx, 1);
    };
  }

  /** Subscribe to subprocess exit. */
  onExit(callback: CortexExitCallback): () => void {
    this.exitCallbacks.push(callback);
    return () => {
      const idx = this.exitCallbacks.indexOf(callback);
      if (idx >= 0) this.exitCallbacks.splice(idx, 1);
    };
  }

  isRunning(): boolean {
    return this.process !== null && !this.disposed;
  }

  dispose(): void {
    this.disposed = true;
    this.dataCallbacks = [];
    this.exitCallbacks = [];
    if (this.process) {
      try {
        this.process.kill();
      } catch {
        // already dead
      }
      this.process = null;
    }
  }
}

/**
 * Extend a PATH string with common macOS / Linux binary locations that
 * VSCode's GUI-launched extension host often doesn't inherit from the
 * user's shell profile.
 */
function extendPath(currentPath: string | undefined): string {
  const existing = (currentPath ?? "").split(":").filter((p) => p.length > 0);
  const existingSet = new Set(existing);
  const home = process.env.HOME ?? "";
  const candidates = [
    "/opt/homebrew/bin",
    "/opt/homebrew/sbin",
    "/usr/local/bin",
    "/usr/local/sbin",
    home ? `${home}/.local/bin` : "",
    home ? `${home}/bin` : "",
    home ? `${home}/.cargo/bin` : "",
  ];
  for (const c of candidates) {
    if (c && !existingSet.has(c)) {
      existing.push(c);
      existingSet.add(c);
    }
  }
  return existing.join(":");
}

/**
 * Resolve a binary name (or path) to an absolute path by walking PATH.
 */
function resolveBinaryAbsolute(binary: string, path: string): string | null {
  if (isAbsolute(binary)) {
    return existsSync(binary) ? binary : null;
  }
  const dirs = path.split(":").filter((d) => d.length > 0);
  for (const dir of dirs) {
    const candidate = `${dir}/${binary}`;
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  try {
    const result = execFileSync("/usr/bin/which", [binary], {
      encoding: "utf-8",
      env: { PATH: path },
    }).trim();
    if (result && existsSync(result)) {
      return result;
    }
  } catch {
    // which failed
  }
  return null;
}

/**
 * One-shot exec to query the cortex version for the footer badge.
 */
export function queryCortexVersion(binary: string): Promise<string | null> {
  return new Promise((resolve) => {
    try {
      const env: Record<string, string> = {};
      for (const [k, v] of Object.entries(process.env)) {
        if (typeof v === "string") env[k] = v;
      }
      env["PATH"] = extendPath(env["PATH"]);
      const resolvedBinary = resolveBinaryAbsolute(binary, env["PATH"]) ?? binary;
      const child = childSpawn(resolvedBinary, ["--version"], {
        stdio: ["ignore", "pipe", "pipe"],
        env,
      });
      let stdout = "";
      child.stdout?.on("data", (c) => {
        stdout += c.toString();
      });
      child.on("error", () => resolve(null));
      child.on("close", (code) => {
        if (code === 0 && stdout.trim()) {
          resolve(stdout.trim());
        } else {
          resolve(null);
        }
      });
      setTimeout(() => {
        try {
          child.kill();
        } catch {
          // already dead
        }
        resolve(null);
      }, 3000);
    } catch {
      resolve(null);
    }
  });
}
