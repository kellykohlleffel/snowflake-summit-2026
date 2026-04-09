#!/usr/bin/env node
/**
 * Fivetran Code MCP Server — third frontend alongside src/cli/ and src/vscode/.
 *
 * Exposes the 25 native Fivetran tools from src/core/tools/ as an MCP server
 * over stdio transport. Designed for consumption by Cortex Code, Claude Code,
 * Claude Desktop, or any other MCP client that speaks stdio JSON-RPC.
 *
 * Credential scope: Fivetran API key + secret ONLY. Destination credentials
 * (Snowflake, Databricks, etc.) are the responsibility of the destination-specific
 * MCP servers the client also connects to — this server only talks to the
 * Fivetran REST API.
 *
 * Write-tool confirmation: NOT enforced here by design. The MCP client's agent
 * loop is the confirmation owner. Skills consuming this server should include
 * explicit approval prompts (AskUserQuestion) before calling write tools.
 *
 * Runtime: stdin/stdout reserved for JSON-RPC. All logging goes to stderr.
 */

import { homedir } from "os";
import { join } from "path";
import { readFile } from "fs/promises";
import { existsSync } from "fs";

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import { initFivetranApi } from "../core/api/client.js";
import { toolRegistry } from "../core/tools/index.js";
import { initSnowflakeConfig } from "../core/tools/query-cortex-agent.js";
import { CONFIG_DIR_NAME, CONFIG_FILE_NAME } from "../core/utils/constants.js";
import type { ToolProgressCallback } from "../core/tools/types.js";

const SERVER_NAME = "fivetran-code";
const SERVER_VERSION = "0.3.3";

/** Log to stderr (stdout is reserved for MCP JSON-RPC). */
function log(msg: string): void {
  process.stderr.write(`[${SERVER_NAME}] ${msg}\n`);
}

interface McpCredentials {
  fivetranApiKey: string;
  fivetranApiSecret: string;
  // Snowflake creds are optional — only needed for query_cortex_agent.
  snowflakeAccount?: string;
  snowflakePatToken?: string;
}

/**
 * Load Fivetran credentials (required) and Snowflake credentials (optional).
 * Unlike src/core/config/manager.ts loadConfig(), this does NOT require
 * Anthropic credentials — the MCP server never talks to Claude directly.
 *
 * Priority: env vars > ~/.fivetran-code/config.json (per-field merge)
 */
async function loadMcpCredentials(): Promise<McpCredentials | null> {
  // Start with env vars
  let fivetranApiKey = process.env.FIVETRAN_API_KEY;
  let fivetranApiSecret = process.env.FIVETRAN_API_SECRET;
  let snowflakeAccount = process.env.SNOWFLAKE_ACCOUNT;
  let snowflakePatToken = process.env.SNOWFLAKE_PAT_TOKEN;

  // Fill any gaps from the config file
  const configPath = join(homedir(), CONFIG_DIR_NAME, CONFIG_FILE_NAME);
  if (existsSync(configPath)) {
    try {
      const raw = await readFile(configPath, "utf-8");
      const parsed = JSON.parse(raw) as {
        fivetranApiKey?: string;
        fivetranApiSecret?: string;
        snowflakeAccount?: string;
        snowflakePatToken?: string;
      };
      fivetranApiKey = fivetranApiKey ?? parsed.fivetranApiKey;
      fivetranApiSecret = fivetranApiSecret ?? parsed.fivetranApiSecret;
      snowflakeAccount = snowflakeAccount ?? parsed.snowflakeAccount;
      snowflakePatToken = snowflakePatToken ?? parsed.snowflakePatToken;
      log(`Config file read from ${configPath}`);
    } catch (err) {
      log(
        `Failed to read config file: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  if (!fivetranApiKey || !fivetranApiSecret) {
    return null;
  }

  return {
    fivetranApiKey,
    fivetranApiSecret,
    snowflakeAccount,
    snowflakePatToken,
  };
}

async function main(): Promise<void> {
  // Step 1: Load credentials (Fivetran required, Snowflake optional)
  const creds = await loadMcpCredentials();
  if (!creds) {
    log(
      "Error: Fivetran credentials not found. Set FIVETRAN_API_KEY and FIVETRAN_API_SECRET " +
        "environment variables, or configure them in ~/.fivetran-code/config.json."
    );
    process.exit(1);
  }

  // Step 2: Initialize the Fivetran API client (singleton used by all tools)
  initFivetranApi(creds.fivetranApiKey, creds.fivetranApiSecret);

  // Step 2b: Initialize Snowflake Cortex Agent config if credentials are present.
  // Without this, mcp__fivetran-code__query_cortex_agent returns a configuration
  // error. Fivetran-only clients can omit these fields; the other 25 tools still work.
  if (creds.snowflakeAccount && creds.snowflakePatToken) {
    initSnowflakeConfig(creds.snowflakeAccount, creds.snowflakePatToken);
    log(`Snowflake Cortex Agent configured (account: ${creds.snowflakeAccount})`);
  } else {
    log(
      "Snowflake Cortex Agent credentials not configured — query_cortex_agent will " +
        "return an error if called. Set snowflakeAccount and snowflakePatToken in config.json " +
        "or SNOWFLAKE_ACCOUNT and SNOWFLAKE_PAT_TOKEN env vars to enable."
    );
  }

  // Step 3: Collect the 25 native tools. Explicitly filter out any dynamic MCP
  // tools — clients consuming this server should load other MCP servers directly
  // via their own config, not proxy through us.
  const tools = toolRegistry
    .getAllTools()
    .filter((t) => !t.name.startsWith("mcp__"));
  log(`Registered ${tools.length} native Fivetran tools`);

  // Step 4: Build the MCP server
  const server = new Server(
    {
      name: SERVER_NAME,
      version: SERVER_VERSION,
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // Step 5: Handle tools/list — return every tool with its JSON Schema definition.
  // The existing AnthropicTool.input_schema is already a valid JSON Schema,
  // so we can pass it through directly without conversion.
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: tools.map((tool) => ({
        name: tool.name,
        description: tool.definition.description ?? "",
        inputSchema: tool.definition.input_schema as Record<string, unknown>,
      })),
    };
  });

  // Step 6: Handle tools/call — look up the tool, validate input with Zod,
  // execute, and wrap ToolResult as MCP content blocks.
  //
  // Progress notifications: if the client sends a progressToken in _meta, we
  // pipe any streaming output from the tool's onProgress callback to the
  // client via extra.sendNotification. Whether the client renders these as
  // live text depends on its MCP implementation (e.g. Cortex Code, Claude
  // Desktop, Claude Code) — but emitting them is harmless if the client
  // ignores them, so we always wire it up when a progressToken is provided.
  server.setRequestHandler(CallToolRequestSchema, async (request, extra) => {
    const { name, arguments: args } = request.params;

    const tool = tools.find((t) => t.name === name);
    if (!tool) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: false,
              error: `Unknown tool: ${name}`,
            }),
          },
        ],
        isError: true,
      };
    }

    // Validate input with the tool's Zod schema. If validation fails, return
    // the error as an MCP error result rather than throwing.
    let validInput: Record<string, unknown>;
    try {
      validInput = tool.inputSchema.parse(args ?? {}) as Record<string, unknown>;
    } catch (err) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: false,
              error: `Input validation failed for ${name}: ${
                err instanceof Error ? err.message : String(err)
              }`,
            }),
          },
        ],
        isError: true,
      };
    }

    // Build an optional progress callback. Only query_cortex_agent currently
    // emits progress (SSE token streaming); other tools ignore onProgress.
    // If the client didn't supply a progressToken, onProgress is undefined
    // and the tool runs without any streaming overhead.
    const progressToken = request.params._meta?.progressToken;
    let onProgress: ToolProgressCallback | undefined;
    if (progressToken !== undefined) {
      let progress = 0;
      onProgress = (text: string) => {
        progress += 1;
        // Fire and forget. If sendNotification fails (e.g., transport closed),
        // we swallow the error rather than abort the tool call — the final
        // result still comes back through the request/response path.
        extra
          .sendNotification({
            method: "notifications/progress",
            params: {
              progressToken,
              progress,
              message: text,
            },
          })
          .catch((err) => {
            log(
              `Progress notification send failed: ${
                err instanceof Error ? err.message : String(err)
              }`
            );
          });
      };
    }

    // Execute the tool. Tools are pure API-call executors; the optional
    // onProgress callback is only used by streaming tools like query_cortex_agent.
    try {
      const result = await tool.execute(validInput, onProgress);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result),
          },
        ],
        isError: !result.success,
      };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      log(`Tool ${name} threw: ${errorMsg}`);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: false,
              error: errorMsg,
            }),
          },
        ],
        isError: true,
      };
    }
  });

  // Step 7: Connect the stdio transport and run until stdin closes
  const transport = new StdioServerTransport();
  await server.connect(transport);
  log(`${SERVER_NAME} v${SERVER_VERSION} ready on stdio`);
}

main().catch((err) => {
  log(`Fatal: ${err instanceof Error ? err.stack ?? err.message : String(err)}`);
  process.exit(1);
});
