import * as vscode from "vscode";
import { getWebviewHtml } from "./webview-html.js";
import type { CortexSessionManager } from "./session-manager.js";
import type { WebviewToHost } from "./message-protocol.js";

/**
 * WebviewViewProvider for the sidebar panel.
 * Secondary UI — delegates everything to the shared CortexSessionManager.
 */
export class ChatViewProvider implements vscode.WebviewViewProvider {
  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly sessionManager: CortexSessionManager
  ) {}

  async resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): Promise<void> {
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri],
    };

    webviewView.webview.html = getWebviewHtml({ webview: webviewView.webview });

    this.sessionManager.registerTarget(webviewView);

    webviewView.webview.onDidReceiveMessage(async (message: WebviewToHost) => {
      await this.sessionManager.handleWebviewMessage(message);
    });

    webviewView.onDidDispose(() => {
      this.sessionManager.unregisterTarget(webviewView);
    });

    // If user prefers the editor tab, auto-open it when the sidebar activates
    const vsConfig = vscode.workspace.getConfiguration("cortexCodeForVscode");
    if (vsConfig.get<boolean>("preferEditorTab", true)) {
      vscode.commands.executeCommand("cortex-code-for-vscode.openTab");
    }
  }

  public restartSession(): void {
    this.sessionManager.handleWebviewMessage({ type: "restartSession" });
  }

  public clearChat(): void {
    this.sessionManager.handleWebviewMessage({ type: "clearChat" });
  }
}
