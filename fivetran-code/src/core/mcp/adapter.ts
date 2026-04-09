import { z } from "zod";
import type { FivetranTool, ToolResult } from "../tools/types.js";
import type { McpToolInfo } from "./types.js";

/**
 * Reference to the McpManager for dispatching tool calls.
 * Set via `setMcpManagerRef()` during initialization to avoid circular imports.
 */
let mcpCallTool: ((serverName: string, toolName: string, args: Record<string, unknown>) => Promise<unknown>) | null = null;

export function setMcpCallToolRef(
  fn: (serverName: string, toolName: string, args: Record<string, unknown>) => Promise<unknown>,
): void {
  mcpCallTool = fn;
}

/**
 * Wrap an MCP tool as a FivetranTool so it can be registered in the tool registry.
 *
 * Naming convention: `mcp__{serverName}__{toolName}` (matching Claude Code's pattern).
 * All MCP tools default to `permission: "read"` — they auto-execute without confirmation,
 * matching Claude Code's behavior since the user already trusts configured MCP servers.
 */
export function adaptMcpTool(mcpTool: McpToolInfo): FivetranTool {
  const qualifiedName = `mcp__${mcpTool.serverName}__${mcpTool.name}`;

  return {
    name: qualifiedName,
    permission: "read", // MCP tools auto-execute (matches Claude Code)
    definition: {
      name: qualifiedName,
      description: `[MCP: ${mcpTool.serverName}] ${mcpTool.description}`,
      input_schema: mcpTool.inputSchema as FivetranTool["definition"]["input_schema"],
    },
    inputSchema: z.record(z.unknown()), // Passthrough — MCP server validates
    async execute(input: Record<string, unknown>): Promise<ToolResult> {
      if (!mcpCallTool) {
        return { success: false, error: "MCP manager not initialized" };
      }
      try {
        const data = await mcpCallTool(mcpTool.serverName, mcpTool.name, input);
        return { success: true, data };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },
  };
}
