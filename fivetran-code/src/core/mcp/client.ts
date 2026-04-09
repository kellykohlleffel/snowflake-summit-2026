import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import type { McpServerConfig, McpToolInfo } from "./types.js";

/** Timeout for connecting to an MCP server (ms). */
const CONNECT_TIMEOUT_MS = 10_000;

export interface McpServerConnection {
  name: string;
  config: McpServerConfig;
  client: Client;
  transport: Transport;
  tools: McpToolInfo[];
  connected: boolean;
}

/**
 * Connect to a single MCP server over STDIO.
 * Spawns the process, performs the MCP handshake, and discovers tools.
 */
export async function connectToServer(
  name: string,
  config: McpServerConfig,
): Promise<McpServerConnection> {
  if (!config.command) {
    throw new Error(`MCP server "${name}" has no command configured`);
  }

  const transport = new StdioClientTransport({
    command: config.command,
    args: config.args,
    env: config.env
      ? { ...process.env, ...config.env } as Record<string, string>
      : undefined,
    cwd: config.cwd,
    stderr: "pipe", // capture stderr instead of inheriting to keep UI clean
  });

  const client = new Client(
    { name: "fivetran-code", version: "0.2.0" },
    { capabilities: {} },
  );

  // Connect with a timeout to avoid hanging on broken servers
  await Promise.race([
    client.connect(transport),
    new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error(`Timeout connecting to MCP server "${name}"`)),
        CONNECT_TIMEOUT_MS,
      ),
    ),
  ]);

  const tools = await discoverTools(name, client);

  return { name, config, client, transport, tools, connected: true };
}

/**
 * Discover all tools exposed by a connected MCP server.
 */
async function discoverTools(
  serverName: string,
  client: Client,
): Promise<McpToolInfo[]> {
  const result = await client.listTools();
  return result.tools.map((t) => ({
    serverName,
    name: t.name,
    description: t.description ?? "",
    inputSchema: t.inputSchema as Record<string, unknown>,
  }));
}

/**
 * Call a tool on a connected MCP server and return the text content.
 */
export async function callTool(
  client: Client,
  toolName: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  const result = await client.callTool({ name: toolName, arguments: args });

  // MCP returns content as an array of content blocks — extract text
  if (Array.isArray(result.content)) {
    const textParts = result.content
      .filter((c): c is { type: "text"; text: string } => c.type === "text")
      .map((c) => c.text);
    if (textParts.length === 1) return textParts[0];
    if (textParts.length > 1) return textParts.join("\n");
  }

  return result.content;
}

/**
 * Gracefully disconnect from an MCP server.
 */
export async function disconnect(connection: McpServerConnection): Promise<void> {
  try {
    await connection.transport.close();
  } catch {
    // Best-effort shutdown — ignore errors
  }
  connection.connected = false;
}
