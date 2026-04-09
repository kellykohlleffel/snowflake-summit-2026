import { readFile } from "fs/promises";
import { join } from "path";
import { homedir } from "os";
import { existsSync } from "fs";
import type { McpServerConfig } from "./types.js";

/**
 * Read MCP server configuration from the Claude Desktop config file.
 * This is the same config that Claude Code and Claude Desktop use,
 * so Fivetran Code connects to the same servers.
 *
 * Location: ~/Library/Application Support/Claude/claude_desktop_config.json
 */
export async function loadMcpConfig(): Promise<Map<string, McpServerConfig>> {
  const configPath = join(
    homedir(),
    "Library",
    "Application Support",
    "Claude",
    "claude_desktop_config.json"
  );

  if (!existsSync(configPath)) {
    return new Map();
  }

  try {
    const raw = await readFile(configPath, "utf-8");
    const parsed = JSON.parse(raw) as {
      mcpServers?: Record<string, McpServerConfig>;
    };

    if (!parsed.mcpServers) return new Map();

    const servers = new Map<string, McpServerConfig>();
    for (const [name, config] of Object.entries(parsed.mcpServers)) {
      // Only include servers with a command (STDIO transport)
      if (config.command) {
        servers.set(name, config);
      }
    }
    return servers;
  } catch {
    return new Map();
  }
}
