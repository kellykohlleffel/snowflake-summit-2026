import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";

/**
 * Read ~/.snowflake/cortex/mcp.json and return the configured MCP server
 * names. This is the same config file cortex reads at startup — the keys
 * of the `mcpServers` object are the server names (e.g., "fivetran-code",
 * "se-demo", "mcp-cloud").
 *
 * Synchronous so the result is available immediately before the first
 * metadata broadcast — no timing races with async promises.
 *
 * Returns an empty array on any error (file missing, parse failure).
 */
export function discoverMcpServers(): string[] {
  const configPath = join(homedir(), ".snowflake", "cortex", "mcp.json");
  if (!existsSync(configPath)) {
    return [];
  }

  try {
    const raw = readFileSync(configPath, "utf-8");
    const parsed = JSON.parse(raw) as {
      mcpServers?: Record<string, unknown>;
    };

    if (
      parsed.mcpServers &&
      typeof parsed.mcpServers === "object" &&
      !Array.isArray(parsed.mcpServers)
    ) {
      return Object.keys(parsed.mcpServers);
    }

    return [];
  } catch {
    return [];
  }
}
