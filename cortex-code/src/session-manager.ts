import * as vscode from "vscode";
import { homedir } from "os";
import { join } from "path";
import { CortexHost, queryCortexVersion } from "./pty-host.js";
import { CortexOutputParser } from "./cortex-output-parser.js";
import { discoverAllSkills, type DiscoveredSkill } from "./utils/skills-scanner.js";
import { discoverMcpServers } from "./utils/mcp-config.js";
import {
  readSnowflakeConnection,
  countInstructionFiles,
  type SnowflakeConnectionInfo,
} from "./utils/snowflake-config.js";
import { TokenCounter } from "./token-counter.js";
import { CortexUsageTracker } from "./usage-tracker.js";
import type { HostToWebview, WebviewToHost } from "./message-protocol.js";

/**
 * A target that can receive messages from the Cortex session.
 * Both WebviewView (sidebar) and WebviewPanel (editor tab) satisfy this.
 * Modeled on fivetran-code's WebviewTarget / AgentManager pattern.
 */
export interface WebviewTarget {
  readonly webview: vscode.Webview;
}

/**
 * Shared manager for the Cortex Code stream-json session.
 *
 * Multiple webview targets (sidebar, editor tab) register here. The
 * session broadcasts events to ALL registered targets, and user input
 * from ANY target routes to the single cortex subprocess.
 *
 * Owns:
 *   - CortexHost (the subprocess)
 *   - CortexOutputParser
 *   - TokenCounter + CortexUsageTracker
 *   - Skills catalog, cortex version, session timer
 *   - Compact mode flag
 */
export class CortexSessionManager {
  private cortex: CortexHost | null = null;
  private parser = new CortexOutputParser();
  private sessionStartTime: number | null = null;
  private footerTimer: NodeJS.Timeout | null = null;
  private cortexVersion: string | null = null;
  private allSkills: DiscoveredSkill[] = [];
  private tokenCounter = new TokenCounter();
  private usageTracker: CortexUsageTracker;
  private targets = new Set<WebviewTarget>();
  private started = false;
  private compactMode = false;
  private mcpServers: string[] = [];
  private snowflakeConn: SnowflakeConnectionInfo | null = null;
  private instructionFiles: string[] = [];

  constructor(private readonly context: vscode.ExtensionContext) {
    this.usageTracker = new CortexUsageTracker(
      this.tokenCounter,
      this.getPricingModel()
    );
  }

  // ==========================================================================
  // Target registration + broadcast
  // ==========================================================================

  registerTarget(target: WebviewTarget): void {
    this.targets.add(target);
    // If session is already running, replay lightweight state so the new
    // target sees the current model / version / skills / compact status.
    if (this.started) {
      target.webview.postMessage({
        type: "ready",
        version: this.cortexVersion ?? "unknown",
      });
      target.webview.postMessage({
        type: "metadata",
        model: this.parser.getCurrentModel(),
        version: this.cortexVersion ?? "",
        skills: this.allSkills,
        mcpServers: this.mcpServers,
        pricingModel: this.getPricingModel(),
        compactMode: this.compactMode,
        snowflakeConnection: this.snowflakeConn ?? undefined,
        instructionFiles: this.instructionFiles,
      });
    }
  }

  unregisterTarget(target: WebviewTarget): void {
    this.targets.delete(target);
  }

  private broadcast(message: HostToWebview): void {
    for (const t of this.targets) {
      try {
        t.webview.postMessage(message);
      } catch (err) {
        console.error("[CortexSessionManager] postMessage failed:", err);
      }
    }
  }

  // ==========================================================================
  // Webview message entry point (called by both ChatViewProvider and ChatPanelManager)
  // ==========================================================================

  async handleWebviewMessage(message: WebviewToHost): Promise<void> {
    switch (message.type) {
      case "webviewReady":
        this.queryVersionAsync();
        discoverAllSkills(this.getBinaryPath())
          .then((skills) => {
            this.allSkills = skills;
          })
          .catch(() => {
            this.allSkills = [];
          });
        // Read MCP server names from ~/.snowflake/cortex/mcp.json
        // synchronously so they're available before the first metadata
        // broadcast. Cortex's init event may or may not include
        // mcp_servers in stream-json mode, so we read the config directly.
        this.mcpServers = discoverMcpServers();
        this.snowflakeConn = readSnowflakeConnection();
        const instr = countInstructionFiles(this.getCwd());
        this.instructionFiles = instr.files;
        if (this.getAutoStart()) {
          this.startSession();
        }
        break;

      case "userInput":
        this.handleUserInput(message.text, message.attachments);
        break;

      case "confirmationResponse":
        // stream-json mode: cortex handles its own permission flow
        break;

      case "restartSession":
        this.restartSession();
        break;

      case "clearChat":
        this.clearChat();
        break;

      case "openFilePicker":
        await this.openFilePicker();
        break;

      case "cancelRequest":
        // v1: no-op (no stream-json interrupt event available)
        break;

      case "openDocs":
        try {
          const readmeUri = vscode.Uri.joinPath(this.context.extensionUri, "README.md");
          await vscode.commands.executeCommand("markdown.showPreview", readmeUri);
        } catch {
          vscode.window.showInformationMessage("README not available.");
        }
        break;

      case "openSettings":
        await vscode.commands.executeCommand(
          "workbench.action.openSettings",
          "cortexCodeForVscode"
        );
        break;

      case "openMemory":
        try {
          const memoryPath = join(homedir(), ".claude", "CLAUDE.md");
          const memoryUri = vscode.Uri.file(memoryPath);
          await vscode.window.showTextDocument(memoryUri);
        } catch {
          vscode.window.showInformationMessage("~/.claude/CLAUDE.md not found.");
        }
        break;

      case "openTerminal":
        try {
          const term = vscode.window.createTerminal({
            name: "Cortex Code",
            shellPath: this.getBinaryPath(),
          });
          term.show();
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          vscode.window.showErrorMessage(`Failed to open terminal: ${msg}`);
        }
        break;

      case "toggleVoice":
        // macOS Dictation tip — stream-json mode can't stream mic audio
        this.broadcast({
          type: "rawOutput",
          text:
            "[voice] Cortex Code for VSCode uses macOS Dictation for voice input. " +
            "Click into the message box, press fn twice (or Control twice), speak, " +
            "then press Enter.",
        });
        break;

      case "toggleCompact":
        this.compactMode = !this.compactMode;
        this.broadcast({
          type: "compactModeChanged",
          enabled: this.compactMode,
        });
        this.broadcast({
          type: "rawOutput",
          text: this.compactMode
            ? "[compact] ON — Cortex will answer tersely, data-first."
            : "[compact] OFF — normal responses resumed.",
        });
        break;

      case "showAccount":
        this.showAccountPanel();
        break;

      case "showMcp":
        this.showMcpPanel();
        break;

      case "switchPricingModel":
        await this.switchPricingModel(message.model);
        break;

      case "upgradeCortex":
        try {
          const term = vscode.window.createTerminal({
            name: "Cortex Update",
          });
          term.show();
          term.sendText("cortex update", true);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          vscode.window.showErrorMessage(`Failed to run cortex update: ${msg}`);
        }
        break;
    }
  }

  // ==========================================================================
  // Session lifecycle
  // ==========================================================================

  private startSession(): void {
    if (this.cortex?.isRunning()) return;

    const binary = this.getBinaryPath();
    const cwd = this.getCwd();

    this.parser.reset();
    this.cortex = new CortexHost({ binary, cwd });

    this.cortex.onData((line) => {
      this.parser.feed(line, (event) => {
        switch (event.type) {
          case "metadata":
            // Capture MCP servers from cortex's init event so we can
            // replay them when new webview targets register later.
            if ("mcpServers" in event) {
              const servers = (event as { mcpServers?: string[] }).mcpServers;
              if (Array.isArray(servers) && servers.length > 0) {
                this.mcpServers = servers;
              }
            }
            this.broadcast({
              ...event,
              version: this.cortexVersion ?? "",
              skills: this.allSkills,
              mcpServers: this.mcpServers,
              pricingModel: this.getPricingModel(),
              compactMode: this.compactMode,
              snowflakeConnection: this.snowflakeConn ?? undefined,
              instructionFiles: this.instructionFiles,
            });
            return;

          case "streamText":
            this.usageTracker.recordAssistantText(event.text);
            this.broadcast(event);
            return;

          case "toolCallStart":
            this.usageTracker.recordToolUse(event.name, event.input ?? "");
            this.broadcast(event);
            return;

          case "toolCallEnd":
            this.usageTracker.recordToolResult(event.body);
            this.broadcast(event);
            return;

          case "usageUpdate":
            this.usageTracker
              .endTurn()
              .then(() => this.emitTrackerMetrics())
              .catch((err) => {
                const msg = err instanceof Error ? err.message : String(err);
                process.stderr.write(`[CortexSessionManager] endTurn failed: ${msg}\n`);
              });
            return;

          default:
            this.broadcast(event);
        }
      });
    });

    this.cortex.onExit((code, signal) => {
      this.parser.flush((event) => this.broadcast(event));
      this.broadcast({ type: "sessionExited", code, signal });
      this.stopFooterTimer();
    });

    try {
      this.cortex.start();
      this.sessionStartTime = Date.now();
      this.started = true;
      this.startFooterTimer();
      this.broadcast({ type: "ready", version: this.cortexVersion ?? "unknown" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.broadcast({
        type: "rawOutput",
        text: `Failed to start cortex code:\n\n${msg}`,
      });
      this.cortex = null;
    }
  }

  private stopSession(): void {
    this.cortex?.dispose();
    this.cortex = null;
    this.stopFooterTimer();
    this.sessionStartTime = null;
    this.started = false;
  }

  public restartSession(): void {
    this.stopSession();
    this.parser.reset();
    this.usageTracker.reset();
    this.broadcast({ type: "sessionCleared" });
    this.startSession();
  }

  public clearChat(): void {
    this.broadcast({ type: "chatCleared" });
  }

  private handleUserInput(
    text: string,
    attachments?: Array<{ name: string; mimeType: string; sizeBytes: number; data: string }>
  ): void {
    if (!this.cortex || !this.cortex.isRunning()) {
      this.broadcast({
        type: "rawOutput",
        text: "[session not running — click Restart to start a new Cortex Code session]",
      });
      return;
    }

    if (text.trim().length === 0 && (!attachments || attachments.length === 0)) {
      return;
    }

    // Echo the user's original text to the bubble (with the / skill prefix
    // if they invoked one via the slash menu).
    this.broadcast({ type: "user", text });
    this.broadcast({ type: "thinkingStart" });
    this.usageTracker.startTurn(text);

    // Translate leading /<skillname> to $<skillname> for cortex. Cortex
    // invokes skills with the $ prefix, but we show / in the UI to match
    // Fivetran Code's UX. Only translate if the name matches a known skill.
    let cortexText = text;
    const skillMatch = text.match(/^\/([\w\-]+)(\s|$)/);
    if (skillMatch) {
      const name = skillMatch[1];
      const isSkill = this.allSkills.some((s) => s.name === name);
      if (isSkill) {
        cortexText = "$" + text.slice(1);
      }
    }

    // Build payload. Compact mode prepends a concise-response hint.
    let payload = cortexText;
    if (this.compactMode) {
      payload =
        "(Compact mode: be terse, data-first, no preamble, no summaries.)\n\n" + cortexText;
    }
    if (attachments && attachments.length > 0) {
      const textAttachments = attachments.filter((a) => !a.mimeType.startsWith("image/"));
      for (const att of textAttachments) {
        try {
          const content = Buffer.from(att.data, "base64").toString("utf-8");
          payload += `\n\n[File: ${att.name}]\n${content}`;
        } catch {
          payload += `\n\n[File: ${att.name} — could not decode]`;
        }
      }
    }

    this.cortex.writeJsonLine({
      type: "user",
      message: {
        role: "user",
        content: [{ type: "text", text: payload }],
      },
    });
  }

  // ==========================================================================
  // Account panel + pricing model switcher
  // ==========================================================================

  private showMcpPanel(): void {
    const servers = this.mcpServers;
    if (servers.length === 0) {
      this.broadcast({
        type: "rawOutput",
        text: "No MCP servers configured. Add servers to ~/.snowflake/cortex/mcp.json or use `cortex mcp add`.",
      });
      return;
    }
    const hasMcpCloud = servers.includes("mcp-cloud");
    const lines = [
      `**MCP Servers (${servers.length})**`,
      "",
      ...servers.map((s) => `- ${s}`),
      "",
      hasMcpCloud
        ? "To toggle servers, ask: \"enable the [server] MCP server\" or \"disable [server]\". Changes take effect after a session restart (/restart)."
        : "To manage MCP servers at runtime, add the **mcp-cloud** MCP server to your cortex config. Otherwise, edit ~/.snowflake/cortex/mcp.json and restart.",
    ];
    this.broadcast({ type: "rawOutput", text: lines.join("\n") });
  }

  private showAccountPanel(): void {
    const metrics = this.usageTracker.getMetrics();
    const conn = this.snowflakeConn;
    const lines = [
      "**Account & Usage**",
      "",
    ];
    if (conn) {
      lines.push(
        "**Snowflake Connection**",
        `Connection: ${conn.connectionName}`,
        `Account: ${conn.account}`,
        `User: ${conn.user}`,
        `Warehouse: ${conn.warehouse}`,
        `Database: ${conn.database}`,
        ""
      );
    }
    lines.push(
      "**Session**",
      `Model: ${this.parser.getCurrentModel()}`,
      `Pricing model: ${this.getPricingModel()}`,
      `Cortex version: ${this.cortexVersion ?? "unknown"}`,
      `Compact mode: ${this.compactMode ? "ON" : "OFF"}`,
      `MCP servers: ${this.mcpServers.length > 0 ? this.mcpServers.join(", ") : "none"}`,
      `Instruction files: ${this.instructionFiles.length > 0 ? this.instructionFiles.join(", ") : "none"}`,
      "",
      "**Usage (this session)**",
      `Turns: ${metrics.totalApiCalls}`,
      `Input tokens: ${metrics.totalInputTokens.toLocaleString()}`,
      `Output tokens: ${metrics.totalOutputTokens.toLocaleString()}`,
      `Context: ${metrics.contextUsagePercent.toFixed(1)}%`,
      `Estimated cost: $${metrics.estimatedCostUsd.toFixed(4)}`,
      `Elapsed: ${Math.floor(metrics.elapsedSeconds / 60)}m ${metrics.elapsedSeconds % 60}s`,
    );
    this.broadcast({ type: "rawOutput", text: lines.join("\n") });
  }

  private async switchPricingModel(model: string): Promise<void> {
    const allowed = ["claude-sonnet-4-6", "claude-opus-4-6", "claude-haiku-4-5-20251001"];
    if (!allowed.includes(model)) return;
    await vscode.workspace
      .getConfiguration("cortexCodeForVscode")
      .update("pricingModel", model, vscode.ConfigurationTarget.Global);
    this.usageTracker.setPricingModel(model);
    this.broadcast({ type: "pricingModelChanged", model });
    this.emitTrackerMetrics();
  }

  private emitTrackerMetrics(): void {
    const metrics = this.usageTracker.getMetrics();
    this.broadcast({
      type: "usageUpdate",
      metrics: {
        totalInputTokens: metrics.totalInputTokens,
        totalOutputTokens: metrics.totalOutputTokens,
        totalCacheCreationTokens: metrics.totalCacheCreationTokens,
        totalCacheReadTokens: metrics.totalCacheReadTokens,
        totalTurns: metrics.totalApiCalls,
        totalDurationMs: metrics.elapsedSeconds * 1000,
        contextUsagePercent: metrics.contextUsagePercent,
        cacheHitRate: metrics.cacheHitRate,
        estimatedCostUsd: metrics.estimatedCostUsd,
      },
      model: this.getPricingModel(),
    });
  }

  // ==========================================================================
  // File picker
  // ==========================================================================

  private async openFilePicker(): Promise<void> {
    const uris = await vscode.window.showOpenDialog({
      canSelectMany: true,
      canSelectFiles: true,
      canSelectFolders: false,
      openLabel: "Attach to Cortex Code",
    });
    if (!uris || uris.length === 0) return;

    const files: Array<{ name: string; mimeType: string; sizeBytes: number; data: string }> = [];
    for (const uri of uris) {
      try {
        const bytes = await vscode.workspace.fs.readFile(uri);
        const name = uri.path.split("/").pop() ?? "file";
        const mimeType = guessMimeType(name);
        const data = Buffer.from(bytes).toString("base64");
        files.push({ name, mimeType, sizeBytes: bytes.length, data });
      } catch (err) {
        console.error("[CortexSessionManager] Failed to read file:", err);
      }
    }

    if (files.length > 0) {
      this.broadcast({ type: "filesSelected", files });
    }
  }

  // ==========================================================================
  // Footer timer
  // ==========================================================================

  private startFooterTimer(): void {
    this.stopFooterTimer();
    this.footerTimer = setInterval(() => {
      if (this.sessionStartTime === null) return;
      const elapsedSeconds = Math.floor((Date.now() - this.sessionStartTime) / 1000);
      this.broadcast({
        type: "footerUpdate",
        elapsedSeconds,
        status: this.cortex?.isRunning() ? "running" : "exited",
      });
    }, 1000);
  }

  private stopFooterTimer(): void {
    if (this.footerTimer) {
      clearInterval(this.footerTimer);
      this.footerTimer = null;
    }
  }

  // ==========================================================================
  // Version query
  // ==========================================================================

  private async queryVersionAsync(): Promise<void> {
    if (this.cortexVersion) return;
    const version = await queryCortexVersion(this.getBinaryPath());
    if (version) {
      this.cortexVersion = version;
      this.broadcast({ type: "ready", version });
    }
  }

  // ==========================================================================
  // Configuration
  // ==========================================================================

  private getBinaryPath(): string {
    return (
      vscode.workspace
        .getConfiguration("cortexCodeForVscode")
        .get<string>("binaryPath") || "cortex"
    );
  }

  private getCwd(): string {
    const configured = vscode.workspace
      .getConfiguration("cortexCodeForVscode")
      .get<string>("cwd");
    if (configured && configured.trim().length > 0) return configured;
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    return workspaceRoot ?? process.env.HOME ?? "/";
  }

  private getAutoStart(): boolean {
    return (
      vscode.workspace
        .getConfiguration("cortexCodeForVscode")
        .get<boolean>("autoStart") ?? true
    );
  }

  private getPricingModel(): string {
    return (
      vscode.workspace
        .getConfiguration("cortexCodeForVscode")
        .get<string>("pricingModel") || "claude-sonnet-4-6"
    );
  }

  // ==========================================================================
  // Shutdown
  // ==========================================================================

  public shutdown(): void {
    this.stopSession();
    this.targets.clear();
  }
}

function guessMimeType(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    txt: "text/plain",
    md: "text/markdown",
    json: "application/json",
    js: "text/javascript",
    ts: "text/typescript",
    py: "text/x-python",
    sql: "text/x-sql",
    yml: "text/yaml",
    yaml: "text/yaml",
    html: "text/html",
    css: "text/css",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    svg: "image/svg+xml",
    pdf: "application/pdf",
  };
  return map[ext] ?? "application/octet-stream";
}
