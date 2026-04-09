import * as vscode from "vscode";
import { homedir } from "os";
import { join } from "path";
import { existsSync } from "fs";
import { AgentController, type ExtensionMessage } from "./agent-controller.js";
import { loadConfig } from "../core/config/manager.js";
import type { AppConfig } from "../core/config/types.js";
import { DEFAULT_MODEL } from "../core/utils/constants.js";

/**
 * A target that can receive messages from the agent.
 * Both WebviewView (sidebar) and WebviewPanel (editor tab) satisfy this.
 */
export interface WebviewTarget {
  readonly webview: vscode.Webview;
}

/**
 * Shared manager for the AgentController.
 *
 * Multiple webview targets (sidebar, editor tab) register here.
 * The agent broadcasts messages to ALL registered targets.
 * User input from ANY target routes to the single agent.
 */
export class AgentManager {
  private agent?: AgentController;
  private targets = new Set<WebviewTarget>();
  private initPromise?: Promise<void>;

  constructor(private readonly context: vscode.ExtensionContext) {}

  /** Register a webview target to receive agent messages. */
  registerTarget(target: WebviewTarget): void {
    this.targets.add(target);
  }

  /** Unregister a webview target (e.g., when panel/view is disposed). */
  unregisterTarget(target: WebviewTarget): void {
    this.targets.delete(target);
  }

  /** Broadcast a message to all registered webview targets. */
  private broadcastMessage(message: ExtensionMessage): void {
    // Intercept openUrl messages — launch browser instead of forwarding to webview
    if (message.type === "openUrl") {
      vscode.env.openExternal(vscode.Uri.parse(message.url));
      return;
    }
    for (const target of this.targets) {
      target.webview.postMessage(message);
    }
  }

  /** Ensure the agent is initialized. Idempotent — safe to call multiple times. */
  async ensureAgent(): Promise<AgentController | null> {
    if (this.agent) {
      // Re-broadcast metadata to any newly registered targets
      this.broadcastMessage({ type: "ready" });
      const metadata = this.agent.getMetadata();
      this.broadcastMessage({ type: "metadata", ...metadata });
      return this.agent;
    }
    if (this.initPromise) {
      await this.initPromise;
      return this.agent ?? null;
    }

    this.initPromise = this.doInitialize();
    await this.initPromise;
    return this.agent ?? null;
  }

  private async doInitialize(): Promise<void> {
    const config = await this.getConfig();
    if (!config) {
      this.broadcastMessage({
        type: "error",
        message:
          "No Fivetran credentials configured. Set FIVETRAN_API_KEY, FIVETRAN_API_SECRET, and ANTHROPIC_API_KEY as environment variables, or configure them in VSCode settings (fivetran.apiKey, etc.).",
      });
      return;
    }

    const vsConfig = vscode.workspace.getConfiguration("fivetran");
    const model = vsConfig.get<string>("model") ?? DEFAULT_MODEL;

    // The postMessage callback broadcasts to ALL registered targets
    this.agent = new AgentController(config, model, (msg) =>
      this.broadcastMessage(msg)
    );

    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    await this.agent.initialize(workspaceRoot);

    this.broadcastMessage({ type: "ready" });

    const metadata = this.agent.getMetadata();
    this.broadcastMessage({ type: "metadata", ...metadata });
  }

  private async getConfig(): Promise<AppConfig | null> {
    const vsConfig = vscode.workspace.getConfiguration("fivetran");
    return loadConfig({
      fivetranApiKey: vsConfig.get<string>("apiKey") ?? "",
      fivetranApiSecret: vsConfig.get<string>("apiSecret") ?? "",
      anthropicApiKey: vsConfig.get<string>("anthropicApiKey") ?? "",
      anthropicAuthToken: vsConfig.get<string>("anthropicAuthToken") ?? "",
    });
  }

  /** Handle a user message from any webview target. */
  async handleUserMessage(text: string, mode?: string, attachments?: unknown[]): Promise<void> {
    const agent = await this.ensureAgent();
    if (!agent) return;

    try {
      await agent.handleUserMessage(
        text,
        mode as "confirm" | "auto" | "plan" | undefined,
        attachments as import("./agent-controller.js").Attachment[] | undefined,
      );
    } catch (error) {
      this.broadcastMessage({
        type: "error",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /** Forward a confirmation response to the agent. */
  respondToConfirmation(confirmed: boolean): void {
    this.agent?.respondToConfirmation(confirmed);
  }

  /** Switch model at runtime and notify all targets. */
  switchModel(model: string): void {
    this.agent?.setModel(model);
    this.broadcastMessage({ type: "modelChanged", model });
  }

  /** Switch Claude API key by profile label and notify all targets. */
  switchApiKey(label: string): void {
    const success = this.agent?.switchApiKey(label);
    if (success) {
      this.broadcastMessage({ type: "apiKeyChanged", label });
    }
  }

  /** Switch Fivetran account via MCP server and notify all targets. */
  async switchAccount(accountName: string): Promise<void> {
    if (!this.agent) return;
    const success = await this.agent.switchAccount(accountName);
    if (success) {
      this.broadcastMessage({ type: "accountChanged", account: accountName });
    }
  }

  /** Open CLAUDE.md preference and memory files in editor tabs. */
  async openMemory(): Promise<void> {
    const home = homedir();
    const filesToOpen: string[] = [];

    // Global preferences
    const globalPath = join(home, ".claude", "CLAUDE.md");
    if (existsSync(globalPath)) filesToOpen.push(globalPath);

    // Project CLAUDE.md
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (workspaceRoot) {
      const projectPath = join(workspaceRoot, "CLAUDE.md");
      if (existsSync(projectPath)) filesToOpen.push(projectPath);
    }

    // Auto-memory MEMORY.md — only for the CURRENT project
    if (workspaceRoot) {
      const projectSlug = workspaceRoot.replace(/\//g, "-");
      const memoryPath = join(home, ".claude", "projects", projectSlug, "memory", "MEMORY.md");
      if (existsSync(memoryPath)) {
        filesToOpen.push(memoryPath);
      }
    }

    for (const filePath of filesToOpen) {
      const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(filePath));
      await vscode.window.showTextDocument(doc, { preview: false, preserveFocus: false });
    }
  }

  /** Launch the Fivetran Code CLI in a VS Code integrated terminal. */
  openTerminal(): void {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    const terminal = vscode.window.createTerminal({
      name: "Fivetran Code",
      iconPath: new vscode.ThemeIcon("terminal"),
      cwd: workspaceRoot,
    });
    terminal.show();
    terminal.sendText("fivetran", true);
  }

  /** Open VS Code settings filtered to Fivetran configuration. */
  openSettings(): void {
    vscode.commands.executeCommand("workbench.action.openSettings", "fivetran");
  }

  /** Open the project README.md in an editor tab. */
  async openDocs(): Promise<void> {
    const readmePath = join(this.context.extensionPath, "README.md");
    if (existsSync(readmePath)) {
      const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(readmePath));
      await vscode.window.showTextDocument(doc, { preview: false, preserveFocus: false });
    } else {
      vscode.window.showInformationMessage("README.md not found in extension directory.");
    }
  }

  /** Open native file picker, read files, and send data back to webview. */
  async openFilePicker(): Promise<void> {
    const MIME_MAP: Record<string, string> = {
      ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
      ".gif": "image/gif", ".webp": "image/webp", ".pdf": "application/pdf",
      ".txt": "text/plain", ".md": "text/plain", ".csv": "text/plain",
      ".log": "text/plain", ".ts": "text/plain", ".js": "text/plain",
      ".py": "text/plain", ".sql": "text/plain", ".json": "text/plain",
      ".yaml": "text/plain", ".yml": "text/plain", ".xml": "text/plain",
      ".html": "text/plain", ".css": "text/plain", ".sh": "text/plain",
    };
    const IMAGE_LIMIT = 5 * 1024 * 1024;   // 5 MB
    const TEXT_LIMIT = 500 * 1024;          // 500 KB
    const PDF_LIMIT = 25 * 1024 * 1024;     // 25 MB

    const uris = await vscode.window.showOpenDialog({
      canSelectMany: true,
      openLabel: "Attach",
      filters: {
        "Images": ["png", "jpg", "jpeg", "gif", "webp"],
        "Documents": ["pdf", "txt", "md", "csv", "json", "yaml", "yml", "xml"],
        "Code": ["ts", "js", "py", "sql", "sh", "html", "css"],
      },
    });

    if (!uris || uris.length === 0) return;

    const files: { name: string; mimeType: string; encoding: "text" | "base64"; data: string; sizeBytes: number }[] = [];

    for (const uri of uris) {
      const name = uri.path.split("/").pop() ?? "file";
      const ext = "." + name.split(".").pop()?.toLowerCase();
      const mimeType = MIME_MAP[ext];
      if (!mimeType) {
        vscode.window.showWarningMessage(`Unsupported file type: ${ext}`);
        continue;
      }

      const bytes = await vscode.workspace.fs.readFile(uri);
      const sizeBytes = bytes.length;
      const isImage = mimeType.startsWith("image/");
      const isPdf = mimeType === "application/pdf";
      const limit = isImage ? IMAGE_LIMIT : isPdf ? PDF_LIMIT : TEXT_LIMIT;

      if (sizeBytes > limit) {
        const limitMB = (limit / 1024 / 1024).toFixed(0);
        vscode.window.showWarningMessage(`${name} is too large (${(sizeBytes / 1024 / 1024).toFixed(1)} MB, limit ${limitMB} MB)`);
        continue;
      }

      if (isImage || isPdf) {
        files.push({ name, mimeType, encoding: "base64", data: Buffer.from(bytes).toString("base64"), sizeBytes });
      } else {
        files.push({ name, mimeType, encoding: "text", data: Buffer.from(bytes).toString("utf-8"), sizeBytes });
      }
    }

    if (files.length > 0) {
      for (const target of this.targets) {
        target.webview.postMessage({ type: "filesSelected", files });
      }
    }
  }

  /** Voice input is handled in the webview (macOS Dictation tip). No-op on extension host. */
  async toggleVoice(): Promise<void> {
    // Voice UI is entirely in the webview — shows macOS Dictation instructions.
    // Future: implement native STT via sox + Whisper API here.
  }

  /** Cancel the current in-flight request. */
  cancelRequest(): void {
    this.agent?.cancelRequest();
  }

  /** Clear conversation history. */
  clearHistory(): void {
    this.agent?.clearHistory();
  }

  /** Graceful shutdown. */
  async shutdown(): Promise<void> {
    await this.agent?.shutdown();
  }
}
