import * as vscode from "vscode";
import { getWebviewHtml } from "./webview-html.js";
import type { AgentManager } from "./agent-manager.js";

const VIEW_TYPE = "fivetran.chatTab";
const PANEL_TITLE = "Fivetran Code";

/**
 * Manages the editor-tab WebviewPanel for Fivetran Code.
 * This is the PRIMARY UI surface (like Claude Code's editor tab).
 */
export class ChatPanelManager {
  private panel?: vscode.WebviewPanel;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly agentManager: AgentManager
  ) {}

  /** The view type string for panel serialization. */
  static get viewType(): string {
    return VIEW_TYPE;
  }

  /** Open or reveal the editor tab panel. */
  openOrReveal(): void {
    if (this.panel) {
      this.panel.reveal(vscode.ViewColumn.One);
      return;
    }

    this.panel = vscode.window.createWebviewPanel(
      VIEW_TYPE,
      PANEL_TITLE,
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [this.extensionUri],
      }
    );

    // Set the Fivetran icon for the editor tab
    this.panel.iconPath = vscode.Uri.joinPath(
      this.extensionUri,
      "src",
      "vscode",
      "webview",
      "icons",
      "fivetran.svg"
    );

    this.setupPanel(this.panel);
  }

  /** Restore a panel from a previous session (called by the serializer). */
  restorePanel(panel: vscode.WebviewPanel): void {
    this.panel = panel;
    this.setupPanel(panel);
  }

  /** Common setup for both new and restored panels. */
  private setupPanel(panel: vscode.WebviewPanel): void {
    panel.webview.html = getWebviewHtml({
      webview: panel.webview,
      context: "editor",
    });

    // Register this panel as a message target
    this.agentManager.registerTarget(panel);

    // Handle messages from the webview
    panel.webview.onDidReceiveMessage(async (message) => {
      switch (message.type) {
        case "userMessage":
          await this.agentManager.handleUserMessage(
            message.text,
            message.mode,
            message.attachments
          );
          break;
        case "openFilePicker":
          await this.agentManager.openFilePicker();
          break;
        case "confirmResponse":
          this.agentManager.respondToConfirmation(message.confirmed);
          break;
        case "cancelRequest":
          this.agentManager.cancelRequest();
          break;
        case "clearHistory":
          this.agentManager.clearHistory();
          break;
        case "switchModel":
          this.agentManager.switchModel(message.model);
          break;
        case "switchApiKey":
          this.agentManager.switchApiKey(message.label);
          break;
        case "switchAccount":
          await this.agentManager.switchAccount(message.name);
          break;
        case "openMemory":
          await this.agentManager.openMemory();
          break;
        case "openTerminal":
          this.agentManager.openTerminal();
          break;
        case "openSettings":
          this.agentManager.openSettings();
          break;
        case "openDocs":
          await this.agentManager.openDocs();
          break;
        case "toggleVoice":
          await this.agentManager.toggleVoice();
          break;
        case "ready":
          await this.agentManager.ensureAgent();
          break;
      }
    });

    // Cleanup on dispose
    panel.onDidDispose(() => {
      this.agentManager.unregisterTarget(panel);
      this.panel = undefined;
    });
  }

  /** Dispose the panel if it exists. */
  dispose(): void {
    this.panel?.dispose();
  }
}
