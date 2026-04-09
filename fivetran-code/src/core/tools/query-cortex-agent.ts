import { z } from "zod";
import type { FivetranTool, ToolResult, ToolProgressCallback } from "./types.js";

const inputSchema = z.object({
  agent_name: z
    .string()
    .describe(
      "Fully qualified Cortex Agent name: DB.SCHEMA.AGENT (e.g., HOL_DATABASE_1.PHARMA_SEMANTIC.PHARMA_CLINICAL_TRIALS_AGENT)"
    ),
  question: z.string().describe("Natural language question to ask the Cortex Agent"),
});

/** Module-level Snowflake config, set at startup via initSnowflakeConfig(). */
let snowflakeAccount = "";
let snowflakePatToken = "";

/** Initialize Snowflake config for the Cortex Agent tool. */
export function initSnowflakeConfig(account: string, patToken: string): void {
  snowflakeAccount = account;
  snowflakePatToken = patToken;
}

/**
 * Parse SSE lines from a streaming response body.
 * Yields parsed JSON objects from `data: {...}` lines.
 */
async function* parseSSE(
  body: ReadableStream<Uint8Array>
): AsyncGenerator<Record<string, unknown>> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // Process complete lines
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? ""; // Keep incomplete last line in buffer

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith("data:")) continue;
        const dataStr = trimmed.slice(5).trim();
        if (dataStr === "[DONE]") return;
        try {
          yield JSON.parse(dataStr) as Record<string, unknown>;
        } catch {
          // Skip malformed JSON
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

export const queryCortexAgentTool: FivetranTool = {
  name: "query_cortex_agent",
  permission: "read",
  definition: {
    name: "query_cortex_agent",
    description:
      "Ask a question to a Snowflake Cortex Agent. The agent uses Cortex Analyst to translate " +
      "natural language questions into SQL queries against semantic views, then returns interpreted " +
      "results. Use this for analytical questions about data in Snowflake. Results stream progressively. " +
      "Requires a fully qualified agent name (DB.SCHEMA.AGENT).",
    input_schema: {
      type: "object" as const,
      properties: {
        agent_name: {
          type: "string",
          description:
            "Fully qualified Cortex Agent name: DB.SCHEMA.AGENT",
        },
        question: {
          type: "string",
          description: "Natural language question to ask the Cortex Agent",
        },
      },
      required: ["agent_name", "question"],
    },
  },
  inputSchema,

  async execute(
    input: Record<string, unknown>,
    onProgress?: ToolProgressCallback
  ): Promise<ToolResult> {
    if (!snowflakeAccount || !snowflakePatToken) {
      return {
        success: false,
        error:
          "Snowflake Cortex Agent not configured. Add snowflakeAccount and snowflakePatToken to ~/.fivetran-code/config.json, or set SNOWFLAKE_ACCOUNT and SNOWFLAKE_PAT_TOKEN environment variables.",
      };
    }

    const parsed = inputSchema.parse(input);

    // Parse fully qualified agent name: DB.SCHEMA.AGENT
    const parts = parsed.agent_name.split(".");
    if (parts.length !== 3) {
      return {
        success: false,
        error: `Agent name must be fully qualified: DB.SCHEMA.AGENT (got "${parsed.agent_name}")`,
      };
    }
    const [db, schema, agentName] = parts;

    // Build the Cortex Agent REST API URL
    const accountHost = snowflakeAccount.replace(/\./g, "-");
    const url = `https://${accountHost}.snowflakecomputing.com/api/v2/databases/${db}/schemas/${schema}/agents/${agentName}:run`;

    const payload = {
      messages: [
        {
          role: "user",
          content: [{ type: "text", text: parsed.question }],
        },
      ],
      tool_choice: { type: "auto" },
      stream: true,
    };

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${snowflakePatToken}`,
          "Content-Type": "application/json",
          Accept: "text/event-stream",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorBody = await response.text().catch(() => "");
        if (response.status === 401) {
          return {
            success: false,
            error: "Snowflake PAT token expired or invalid. Generate a new one in Snowflake UI and update your config.",
          };
        }
        return {
          success: false,
          error: `Cortex Agent HTTP ${response.status}: ${errorBody.slice(0, 300)}`,
        };
      }

      if (!response.body) {
        return { success: false, error: "No response body from Cortex Agent" };
      }

      // Stream SSE events and pipe tokens to the UI
      let fullResponse = "";
      let emittedText = ""; // Per-turn dedup tracker

      for await (const event of parseSSE(response.body)) {
        // Streaming text tokens: { text: "...", sequence_number: N }
        if (typeof event.text === "string" && "sequence_number" in event) {
          const token = event.text;
          if (token) {
            // Dedup: skip tokens > 20 chars that are already in emitted text
            if (token.length > 20 && emittedText.includes(token)) {
              continue;
            }
            emittedText += token;
            fullResponse += token;
            onProgress?.(token);
          }
          continue;
        }

        // Status events (thinking indicators)
        if (typeof event.status === "string" && event.message) {
          // Skip status events — they're internal agent reasoning
          continue;
        }

        // Content array (tool_use, tool_results, text)
        const content = event.content;
        if (Array.isArray(content)) {
          for (const item of content) {
            const part = item as Record<string, unknown>;
            if (part.type === "text" && typeof part.text === "string") {
              const text = part.text;
              if (text && !(text.length > 20 && emittedText.includes(text))) {
                emittedText += text;
                fullResponse += text;
                onProgress?.(text);
              }
            } else if (part.type === "tool_use") {
              // Tool call boundary — reset dedup tracker
              emittedText = "";
            } else if (part.type === "tool_results") {
              const toolResults = part.tool_results as Record<string, unknown> | undefined;
              const resultContent = toolResults?.content;
              if (Array.isArray(resultContent)) {
                for (const rc of resultContent) {
                  const rPart = rc as Record<string, unknown>;
                  if (rPart.type === "text" && typeof rPart.text === "string") {
                    fullResponse += rPart.text;
                    onProgress?.(rPart.text);
                  }
                }
              }
            }
          }
          continue;
        }

        // Delta format: { delta: { content: [...] } }
        const delta = event.delta as Record<string, unknown> | undefined;
        if (delta) {
          const deltaContent = delta.content;
          if (typeof deltaContent === "string" && deltaContent) {
            if (!(deltaContent.length > 20 && emittedText.includes(deltaContent))) {
              emittedText += deltaContent;
              fullResponse += deltaContent;
              onProgress?.(deltaContent);
            }
          }
        }
      }

      if (!fullResponse.trim()) {
        return { success: false, error: "No content returned from Cortex Agent" };
      }

      return {
        success: true,
        data: {
          response: fullResponse.trim(),
          agent_name: parsed.agent_name,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Cortex Agent error: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },
};
