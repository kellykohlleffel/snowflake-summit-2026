import type { FivetranTool } from "../tools/types.js";
import type { McpToolInfo } from "./types.js";
import { loadMcpConfig } from "./config.js";
import {
  connectToServer,
  callTool,
  disconnect,
  type McpServerConnection,
} from "./client.js";
import { adaptMcpTool, setMcpCallToolRef } from "./adapter.js";

/**
 * McpManager — singleton that manages all MCP server connections.
 *
 * Lifecycle:
 *   1. initialize() — reads config, connects to all servers, discovers tools
 *   2. getTools()   — returns adapted FivetranTool[] for the tool registry
 *   3. shutdown()   — gracefully disconnects all servers
 */
class McpManager {
  private connections: Map<string, McpServerConnection> = new Map();
  private adaptedTools: FivetranTool[] = [];
  private initialized = false;

  /**
   * Read MCP config, connect to all configured STDIO servers, and discover tools.
   * Servers that fail to connect are skipped with a warning (non-blocking).
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Wire the adapter's callTool reference to this manager
    setMcpCallToolRef(this.callToolOnServer.bind(this));

    const configs = await loadMcpConfig();
    if (configs.size === 0) {
      this.initialized = true;
      return;
    }

    // Connect to all servers in parallel
    const results = await Promise.allSettled(
      Array.from(configs.entries()).map(async ([name, config]) => {
        const connection = await connectToServer(name, config);
        return connection;
      }),
    );

    for (const result of results) {
      if (result.status === "fulfilled") {
        const conn = result.value;
        this.connections.set(conn.name, conn);
      }
      // Rejected connections are silently skipped — don't block startup
    }

    // Build adapted tools from all connected servers
    const allMcpTools: McpToolInfo[] = [];
    for (const conn of this.connections.values()) {
      allMcpTools.push(...conn.tools);
    }

    this.adaptedTools = allMcpTools.map(adaptMcpTool);
    this.initialized = true;
  }

  /**
   * Get all MCP tools adapted as FivetranTool[] for the tool registry.
   */
  getTools(): FivetranTool[] {
    return this.adaptedTools;
  }

  /**
   * Get names of all connected MCP servers.
   */
  getConnectedServerNames(): string[] {
    return Array.from(this.connections.keys());
  }

  /**
   * Get the number of connected servers.
   */
  getServerCount(): number {
    return this.connections.size;
  }

  /**
   * Call a tool on a specific MCP server.
   */
  private async callToolOnServer(
    serverName: string,
    toolName: string,
    args: Record<string, unknown>,
  ): Promise<unknown> {
    const conn = this.connections.get(serverName);
    if (!conn || !conn.connected) {
      throw new Error(`MCP server "${serverName}" is not connected`);
    }
    return callTool(conn.client, toolName, args);
  }

  /**
   * Gracefully disconnect from all MCP servers.
   */
  async shutdown(): Promise<void> {
    const disconnects = Array.from(this.connections.values()).map((conn) =>
      disconnect(conn),
    );
    await Promise.allSettled(disconnects);
    this.connections.clear();
    this.adaptedTools = [];
    this.initialized = false;
  }
}

/** Singleton MCP manager instance. */
export const mcpManager = new McpManager();
