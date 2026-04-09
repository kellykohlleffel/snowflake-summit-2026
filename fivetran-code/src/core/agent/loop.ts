import type Anthropic from "@anthropic-ai/sdk";
import type {
  ContentBlockParam,
  Tool as AnthropicTool,
  ToolUseBlock,
  ToolResultBlockParam,
  TextBlockParam,
} from "@anthropic-ai/sdk/resources/messages";
import { toolRegistry } from "../tools/index.js";
import { buildSystemPrompt, type SystemPromptOptions } from "./system-prompt.js";
import type { Conversation } from "./conversation.js";
import type { ToolResult } from "../tools/types.js";
import type { SessionTracker, TurnUsage, SessionMetrics } from "./usage-tracker.js";

/**
 * Callbacks for the agent loop — UI-agnostic so both the terminal CLI
 * and VSCode extension can hook in without the core knowing about either.
 */
export interface AgentCallbacks {
  /** Called for each text delta as Claude streams its response. */
  onStreamText: (text: string) => void;
  /** Called when a text block finishes streaming. */
  onStreamEnd: () => void;
  /** Called when Claude wants to execute a tool. */
  onToolCallStart: (name: string, input: Record<string, unknown>) => void;
  /** Called after a tool finishes executing. */
  onToolCallEnd: (name: string, result: ToolResult) => void;
  /**
   * Called when a write tool needs user confirmation before executing.
   * Return true to proceed, false to deny.
   */
  onConfirmationRequired: (
    name: string,
    input: Record<string, unknown>
  ) => Promise<boolean>;
  /** Called when the full response is complete (no more tool calls). */
  onComplete: (fullResponse: string) => void;
  /** Called on error. */
  onError: (error: Error) => void;
  /** Called after each API round with usage data. Optional — frontends that don't need it can omit. */
  onUsageUpdate?: (turnUsage: TurnUsage, sessionMetrics: SessionMetrics) => void;
  /** Called when a tool streams progressive output during execution (e.g., Cortex Agent SSE tokens). */
  onToolProgress?: (toolName: string, text: string) => void;
}

export interface AgentLoopOptions {
  model: string;
  maxToolRounds: number;
  /** Dynamic context for the system prompt (MCP servers, skills, preferences). */
  promptOptions?: SystemPromptOptions;
  /** Execution mode: confirm (default), auto, or plan. */
  mode?: "confirm" | "auto" | "plan";
  /** AbortSignal to cancel the loop mid-execution (e.g., user presses Escape). */
  signal?: AbortSignal;
  /** Session-level token/cost tracker. When provided, usage is extracted and forwarded via onUsageUpdate. */
  sessionTracker?: SessionTracker;
}

/**
 * Core agentic loop — the heart of Fivetran Code.
 *
 * Sends the conversation to Claude with streaming, handles tool_use responses
 * by executing tools and feeding results back, and loops until Claude returns
 * a final text response (stop_reason: "end_turn").
 */
export async function runAgentLoop(
  client: Anthropic,
  conversation: Conversation,
  userMessage: string | ContentBlockParam[],
  callbacks: AgentCallbacks,
  options: AgentLoopOptions
): Promise<void> {
  conversation.addUserMessage(userMessage);
  let toolRounds = 0;

  // Build system prompt base and tools once — they don't change between rounds.
  // Session elapsed time is updated each round so the model has current duration.
  const systemPromptBaseText = buildSystemPrompt({ ...options.promptOptions, model: options.model });

  const systemPrompt: TextBlockParam[] = [
    {
      type: "text",
      text: systemPromptBaseText,
      cache_control: { type: "ephemeral" },
    },
  ];

  const tools = withCacheControl(toolRegistry.getToolDefinitions());

  while (toolRounds < options.maxToolRounds) {
    // Check for abort before each round
    if (options.signal?.aborted) {
      callbacks.onComplete("(Cancelled)");
      return;
    }

    // Stream the response from Claude
    const stream = client.messages.stream({
      model: options.model,
      max_tokens: 8192,
      system: systemPrompt,
      tools,
      messages: conversation.getMessages(),
    });

    // Abort the stream if the signal fires (e.g., user presses Escape)
    const abortHandler = () => stream.abort();
    options.signal?.addEventListener("abort", abortHandler, { once: true });

    let fullText = "";

    // Handle streaming text deltas for live UI updates
    stream.on("text", (text) => {
      fullText += text;
      callbacks.onStreamText(text);
    });

    // Wait for the complete message to extract tool_use blocks correctly
    let finalMessage;
    try {
      finalMessage = await stream.finalMessage();
    } catch (err) {
      // Stream was aborted — clean up and exit
      if (options.signal?.aborted) {
        callbacks.onStreamEnd();
        callbacks.onComplete("(Cancelled)");
        return;
      }
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error("Stream error details:", err);
      throw new Error(`Stream failed: ${errMsg}`);
    } finally {
      options.signal?.removeEventListener("abort", abortHandler);
    }
    callbacks.onStreamEnd();

    console.error(`[Agent Loop] Round ${toolRounds + 1}: stop_reason=${finalMessage.stop_reason}, text_length=${fullText.length}, content_blocks=${finalMessage.content.length}, model=${options.model}`);

    // Extract and forward usage metrics from this API round
    if (options.sessionTracker && finalMessage.usage) {
      const turnUsage: TurnUsage = {
        inputTokens: finalMessage.usage.input_tokens,
        outputTokens: finalMessage.usage.output_tokens,
        cacheCreationTokens: finalMessage.usage.cache_creation_input_tokens ?? 0,
        cacheReadTokens: finalMessage.usage.cache_read_input_tokens ?? 0,
      };
      options.sessionTracker.addTurn(turnUsage);
      callbacks.onUsageUpdate?.(turnUsage, options.sessionTracker.getMetrics());
    }

    // Warn if output was truncated due to max_tokens
    if (finalMessage.stop_reason === "max_tokens") {
      callbacks.onStreamText(
        "\n\n---\n*Output truncated (max tokens reached). " +
        "Try `/compact` for shorter responses, or switch to a model with a larger output window.*"
      );
    }

    // Collect any tool_use blocks from the response
    const toolUseBlocks: ToolUseBlock[] = [];
    for (const block of finalMessage.content) {
      if (block.type === "tool_use") {
        toolUseBlocks.push(block);
      }
    }

    // If the model produced no text and no tool calls on the first round, retry once
    // without adding the empty response to conversation history.
    // This handles the cold-start issue where the model returns an empty response.
    if (fullText.length === 0 && toolUseBlocks.length === 0 && toolRounds === 0) {
      console.error("[Agent Loop] Empty response on first round — retrying");
      toolRounds++;
      continue;
    }

    // Add the full assistant message to conversation history
    conversation.addAssistantMessage(finalMessage.content);

    // If no tool calls, we're done — Claude has provided its final answer
    if (finalMessage.stop_reason !== "tool_use" || toolUseBlocks.length === 0) {
      callbacks.onComplete(fullText);
      return;
    }

    // Execute each tool call and collect results
    const toolResults: ToolResultBlockParam[] = [];

    for (const toolBlock of toolUseBlocks) {
      // Check for abort before each tool execution
      if (options.signal?.aborted) {
        callbacks.onComplete("(Cancelled)");
        return;
      }

      const toolInput = toolBlock.input as Record<string, unknown>;
      const tool = toolRegistry.getTool(toolBlock.name);

      if (!tool) {
        toolResults.push({
          type: "tool_result",
          tool_use_id: toolBlock.id,
          content: JSON.stringify({
            success: false,
            error: `Unknown tool: ${toolBlock.name}`,
          }),
          is_error: true,
        });
        continue;
      }

      const mode = options.mode ?? "confirm";

      // Plan mode: block write tools, let read tools execute normally
      if (mode === "plan" && tool.permission === "write") {
        callbacks.onToolCallStart(toolBlock.name, toolInput);
        const planMsg = `[Plan mode] Would execute ${toolBlock.name} with input: ${JSON.stringify(toolInput)}. No action taken — do not retry this tool.`;
        toolResults.push({
          type: "tool_result",
          tool_use_id: toolBlock.id,
          content: JSON.stringify({
            success: false,
            error: planMsg,
          }),
          is_error: true,
        });
        callbacks.onToolCallEnd(toolBlock.name, { success: false, error: planMsg });
        continue;
      }

      // Write tools require user confirmation (unless auto-execute mode)
      if (tool.permission === "write" && mode !== "auto") {
        const confirmed = await callbacks.onConfirmationRequired(
          toolBlock.name,
          toolInput
        );
        if (!confirmed) {
          toolResults.push({
            type: "tool_result",
            tool_use_id: toolBlock.id,
            content: JSON.stringify({
              success: false,
              error: "User denied this action.",
            }),
            is_error: true,
          });
          continue;
        }
      }

      callbacks.onToolCallStart(toolBlock.name, toolInput);

      const progressCb = callbacks.onToolProgress
        ? (text: string) => callbacks.onToolProgress!(toolBlock.name, text)
        : undefined;

      let result: ToolResult;
      try {
        result = await tool.execute(toolInput, progressCb);
      } catch (err) {
        result = {
          success: false,
          error: err instanceof Error ? err.message : String(err),
        };
      }

      callbacks.onToolCallEnd(toolBlock.name, result);

      toolResults.push({
        type: "tool_result",
        tool_use_id: toolBlock.id,
        content: JSON.stringify(result),
        is_error: !result.success,
      });
    }

    // Feed tool results back into the conversation for the next round
    conversation.addToolResults(toolResults);
    toolRounds++;
  }

  callbacks.onError(
    new Error(`Exceeded maximum tool rounds (${options.maxToolRounds})`)
  );
}

/**
 * Add cache_control breakpoint to the last tool definition.
 * This tells the API to cache everything up to and including the tools,
 * so subsequent rounds in the same conversation pay ~90% less for input tokens.
 */
function withCacheControl(tools: AnthropicTool[]): AnthropicTool[] {
  if (tools.length === 0) return tools;
  const cached = tools.map((t) => ({ ...t }));
  cached[cached.length - 1] = {
    ...cached[cached.length - 1],
    cache_control: { type: "ephemeral" },
  };
  return cached;
}
