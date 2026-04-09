export interface McpServerConfig {
  /** Executable command (for STDIO transport). */
  command?: string;
  /** Command-line arguments. */
  args?: string[];
  /** Environment variables for the spawned process. */
  env?: Record<string, string>;
  /** Working directory for the spawned process. */
  cwd?: string;
}

export interface McpToolInfo {
  /** Name of the MCP server this tool belongs to. */
  serverName: string;
  /** Tool name as reported by the MCP server. */
  name: string;
  /** Tool description. */
  description: string;
  /** JSON Schema for tool input. */
  inputSchema: Record<string, unknown>;
}
