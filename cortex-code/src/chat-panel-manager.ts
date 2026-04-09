import * as vscode from "vscode";
import { getWebviewHtml } from "./webview-html.js";
import type { CortexSessionManager } from "./session-manager.js";
import type { WebviewToHost } from "./message-protocol.js";

const VIEW_TYPE = "cortex-code-for-vscode.chatTab";
const PANEL_TITLE = "Cortex Code";

/**
 * Manages the editor-tab WebviewPanel for Cortex Code for VSCode.
 * Modeled on fivetran-code's ChatPanelManager. Shares state with the
 * sidebar ChatViewProvider via the CortexSessionManager.
 */
export class ChatPanelManager {
  private panel?: vscode.WebviewPanel;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly sessionManager: CortexSessionManager
  ) {}

  static get viewType(): string {
    return VIEW_TYPE;
  }

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

    this.panel.iconPath = vscode.Uri.joinPath(
      this.extensionUri,
      "images",
      "snowflake-activity-bar.svg"
    );

    this.setupPanel(this.panel);
  }

  restorePanel(panel: vscode.WebviewPanel): void {
    this.panel = panel;
    this.setupPanel(panel);
  }

  private setupPanel(panel: vscode.WebviewPanel): void {
    panel.webview.html = getWebviewHtml({ webview: panel.webview });

    this.sessionManager.registerTarget(panel);

    panel.webview.onDidReceiveMessage(async (message: WebviewToHost) => {
      await this.sessionManager.handleWebviewMessage(message);
    });

    panel.onDidDispose(() => {
      this.sessionManager.unregisterTarget(panel);
      this.panel = undefined;
    });
  }

  dispose(): void {
    this.panel?.dispose();
  }
}
