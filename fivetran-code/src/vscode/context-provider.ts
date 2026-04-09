import * as vscode from "vscode";

/**
 * Reads workspace context to inform the agent about the user's environment.
 * Detects dbt projects, SQL files, and Fivetran configuration files.
 */
export async function getWorkspaceContext(): Promise<string[]> {
  const context: string[] = [];

  if (!vscode.workspace.workspaceFolders?.length) {
    return context;
  }

  // Check for dbt project
  const dbtFiles = await vscode.workspace.findFiles(
    "**/dbt_project.yml",
    "**/node_modules/**",
    1
  );
  if (dbtFiles.length > 0) {
    context.push(`dbt project detected at: ${dbtFiles[0].fsPath}`);
  }

  // Check for SQL files
  const sqlFiles = await vscode.workspace.findFiles(
    "**/*.sql",
    "**/node_modules/**",
    10
  );
  if (sqlFiles.length > 0) {
    context.push(`${sqlFiles.length} SQL files found in workspace`);
  }

  // Check for Fivetran connector config
  const fivetranFiles = await vscode.workspace.findFiles(
    "**/connector.json",
    "**/node_modules/**",
    1
  );
  if (fivetranFiles.length > 0) {
    context.push(
      `Fivetran connector config detected at: ${fivetranFiles[0].fsPath}`
    );
  }

  return context;
}
