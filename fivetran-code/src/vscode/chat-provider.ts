import * as vscode from "vscode";
import { getWebviewHtml } from "./webview-html.js";
import type { AgentManager } from "./agent-manager.js";

/**
 * VSCode WebviewViewProvider for the sidebar panel.
 * Secondary UI — delegates everything to the shared AgentManager.
 */
export class ChatViewProvider implements vscode.WebviewViewProvider {
  private view?: vscode.WebviewView;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly agentManager: AgentManager
  ) {}

  async resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): Promise<void> {
    this.view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri],
    };

    webviewView.webview.html = getWebviewHtml({
      webview: webviewView.webview,
      context: "sidebar",
    });

    // Register as a message target
    this.agentManager.registerTarget(webviewView);

    // Handle messages from the webview
    webviewView.webview.onDidReceiveMessage(async (message) => {
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
    webviewView.onDidDispose(() => {
      this.agentManager.unregisterTarget(webviewView);
      this.view = undefined;
    });

    // If user prefers the editor tab, auto-open it when the sidebar activates
    const vsConfig = vscode.workspace.getConfiguration("fivetran");
    if (vsConfig.get<boolean>("preferEditorTab", true)) {
      vscode.commands.executeCommand("fivetran.openChat");
    }
  }
}
