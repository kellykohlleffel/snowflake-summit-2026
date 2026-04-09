import * as vscode from "vscode";
import { config as dotenvConfig } from "dotenv";
import { join } from "path";
import { ChatViewProvider } from "./chat-provider.js";
import { ChatPanelManager } from "./chat-panel-manager.js";
import { AgentManager } from "./agent-manager.js";

let agentManager: AgentManager;

export function activate(context: vscode.ExtensionContext) {
  // Load .env — try workspace root first, then extension install directory
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (workspaceRoot) {
    dotenvConfig({ path: join(workspaceRoot, ".env") });
  }
  dotenvConfig({ path: join(context.extensionPath, ".env") });

  // Create the shared agent manager (singleton for this activation)
  agentManager = new AgentManager(context);

  // Create the editor tab manager (PRIMARY UI)
  const chatPanelManager = new ChatPanelManager(
    context.extensionUri,
    agentManager
  );

  // Create the sidebar provider (SECONDARY UI)
  const sidebarProvider = new ChatViewProvider(
    context.extensionUri,
    agentManager
  );

  // Register sidebar webview view provider
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      "fivetran.chatPanel",
      sidebarProvider
    )
  );

  // Register panel serializer for tab restoration on reload
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

  // Command: Open Fivetran Code in editor tab (PRIMARY action)
  context.subscriptions.push(
    vscode.commands.registerCommand("fivetran.openChat", () => {
      chatPanelManager.openOrReveal();
    })
  );

  // Command: Open Fivetran Code in sidebar (secondary action)
  context.subscriptions.push(
    vscode.commands.registerCommand("fivetran.openSidebar", () => {
      vscode.commands.executeCommand("fivetran.chatPanel.focus");
    })
  );
}

export async function deactivate() {
  await agentManager?.shutdown();
}
