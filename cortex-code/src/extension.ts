import * as vscode from "vscode";
import { ChatViewProvider } from "./chat-provider.js";
import { ChatPanelManager } from "./chat-panel-manager.js";
import { CortexSessionManager } from "./session-manager.js";

let sessionManager: CortexSessionManager | undefined;

export function activate(context: vscode.ExtensionContext): void {
  sessionManager = new CortexSessionManager(context);

  const chatPanelManager = new ChatPanelManager(
    context.extensionUri,
    sessionManager
  );

  const sidebarProvider = new ChatViewProvider(
    context.extensionUri,
    sessionManager
  );

  // Register sidebar webview view provider
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      "cortex-code-for-vscode.panel",
      sidebarProvider
    )
  );

  // Register panel serializer for editor-tab restoration on reload
  context.subscriptions.push(
    vscode.window.registerWebviewPanelSerializer(
      ChatPanelManager.viewType,
      {
        async deserializeWebviewPanel(
          panel: vscode.WebviewPanel,
          _state: unknown
        ) {
          chatPanelManager.restorePanel(panel);
        },
      }
    )
  );

  // Command: Open Cortex Code in editor tab (PRIMARY action)
  context.subscriptions.push(
    vscode.commands.registerCommand("cortex-code-for-vscode.openTab", () => {
      chatPanelManager.openOrReveal();
    })
  );

  // Command: Open Cortex Code in sidebar
  context.subscriptions.push(
    vscode.commands.registerCommand("cortex-code-for-vscode.open", () => {
      vscode.commands.executeCommand("cortex-code-for-vscode.panel.focus");
    })
  );

  // Command: Restart session
  context.subscriptions.push(
    vscode.commands.registerCommand("cortex-code-for-vscode.restart", () => {
      sessionManager?.handleWebviewMessage({ type: "restartSession" });
    })
  );

  // Command: Clear chat
  context.subscriptions.push(
    vscode.commands.registerCommand("cortex-code-for-vscode.clear", () => {
      sessionManager?.handleWebviewMessage({ type: "clearChat" });
    })
  );
}

export function deactivate(): void {
  sessionManager?.shutdown();
  sessionManager = undefined;
}
