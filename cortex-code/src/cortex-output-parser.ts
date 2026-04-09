import type { HostToWebview } from "./message-protocol.js";

/**
 * Parses cortex stream-json events into Fivetran Code-style webview messages.
 *
 * Cortex Code's stream-json output format emits newline-delimited JSON events
 * that mirror the Anthropic Messages API structure:
 *
 *   {"type":"system","subtype":"init",...}           session start
 *   {"type":"assistant","message":{"content":[{"type":"text","text":"..."}]}}    assistant text
 *   {"type":"assistant","message":{"content":[{"type":"tool_use","name":"...","input":{}}]}}  tool call
 *   {"type":"user","message":{"content":[{"type":"tool_result","tool_use_id":"...","content":"..."}]}}  tool result
 *   {"type":"result","subtype":"success",...}        turn complete
 *
 * We map each event to our existing webview message protocol:
 *   - assistant text    → streamText + streamEnd (rendered as assistant bubble)
 *   - assistant tool_use → toolCallStart (rendered as tool card with spinner)
 *   - user tool_result  → toolCallEnd (updates the tool card with ✓/✗ and body)
 *   - result            → (ignored — turn boundary marker)
 *
 * For Summit HOL v1 we do NOT try to handle interrupted/partial tool calls or
 * multiple concurrent tool uses in a single assistant message (we just render
 * each tool_use block sequentially). These are edge cases that can be added
 * in a v0.2 iteration if they come up in real HOL runs.
 */

export type EmitFn = (event: HostToWebview) => void;

/** Internal state mapping tool_use_id to the displayed tool name. */
interface PendingTool {
  id: string;
  name: string;
}

export class CortexOutputParser {
  /** Tools that have been started but not yet completed. Maps tool_use_id → name. */
  private pendingTools: Map<string, PendingTool> = new Map();
  /**
   * Are we currently streaming assistant text via stream_event deltas?
   * When true, we skip the final consolidated `assistant` text message
   * because we've already rendered it incrementally.
   */
  private streamingText = false;
  /** Current model name from the latest init event. */
  private currentModel = "unknown";

  /**
   * Feed a single complete line from cortex stdout.
   *
   * Lines come from CortexHost which buffers stdout and splits on newlines.
   * Each line should be a complete JSON object (cortex's stream-json format
   * guarantees one JSON event per line).
   */
  feed(line: string, emit: EmitFn): void {
    // Handle stderr lines from the CortexHost wrapper — they're prefixed
    // so we can distinguish them from JSON events.
    if (line.startsWith("[stderr]")) {
      emit({ type: "rawOutput", text: line });
      return;
    }

    // Try to parse the line as JSON
    let event: unknown;
    try {
      event = JSON.parse(line);
    } catch {
      // Not JSON — could be pre-init output or a parse error. Surface it
      // so the user at least sees what cortex emitted.
      emit({ type: "rawOutput", text: line });
      return;
    }

    if (!isObject(event) || typeof event.type !== "string") {
      emit({ type: "rawOutput", text: line });
      return;
    }

    switch (event.type) {
      case "system":
        this.handleSystem(event, emit);
        break;
      case "assistant":
        this.handleAssistant(event, emit);
        break;
      case "user":
        this.handleUser(event, emit);
        break;
      case "stream_event":
        this.handleStreamEvent(event, emit);
        break;
      case "result":
        // Turn complete — clear thinking indicator, reset streaming state,
        // and extract usage metrics to emit a usageUpdate for the footer.
        emit({ type: "thinkingEnd" });
        this.streamingText = false;
        this.handleResult(event, emit);
        break;
      default:
        // Unknown event type — surface as raw output for visibility
        emit({ type: "rawOutput", text: `[unknown event: ${event.type}] ${line}` });
    }
  }

  /** Reset all state on session restart. */
  reset(): void {
    this.pendingTools.clear();
    this.streamingText = false;
    this.currentModel = "unknown";
  }

  /** Get the current model name (captured from the init event). */
  getCurrentModel(): string {
    return this.currentModel;
  }

  /** Compatibility no-op — kept for interface parity with earlier parser. */
  notifyUserInput(_text: string): void {
    // User bubbles are rendered client-side in the webview immediately on
    // send; we don't need to observe echoes in cortex's output stream.
  }

  /** Flush any pending state (no-op with the JSON parser). */
  flush(_emit: EmitFn): void {
    // no pending state to flush — the parser is stateless across lines
    // except for the pending-tool map, which we leave alone
  }

  // --------------------------------------------------------------------------

  private handleSystem(event: Record<string, unknown>, emit: EmitFn): void {
    if (event.subtype === "init") {
      const model = typeof event.model === "string" ? event.model : "unknown";
      this.currentModel = model;
      // Extract MCP servers list if cortex emits it in the init event
      const mcpServers: string[] = [];
      if (Array.isArray(event.mcp_servers)) {
        for (const srv of event.mcp_servers) {
          if (typeof srv === "string") {
            mcpServers.push(srv);
          } else if (isObject(srv) && typeof srv.name === "string") {
            mcpServers.push(srv.name);
          }
        }
      }
      // Emit a metadata message that the footer and slash menu can consume.
      // The chat-provider augments this metadata with locally-scanned skills.
      emit({
        type: "metadata",
        model,
        version: "",
        skills: [], // populated by chat-provider before forwarding to webview
        mcpServers,
      });
    }
  }

  /**
   * Handle cortex's result event — emits a turn-boundary signal so the
   * consumer (chat-provider) can end its usage tracker's current turn
   * and trigger the count_tokens call that produces the real footer
   * metrics.
   *
   * We no longer read cortex's result.usage fields here because they're
   * always zero in Snowflake Cortex Complete stream-json mode. Instead,
   * chat-provider owns the usage lifecycle via CortexUsageTracker, which
   * tokenizes the observed content (user text + assistant text + tool
   * inputs/results) using Anthropic's count_tokens endpoint.
   *
   * The emit below is a zero-payload `usageUpdate` that chat-provider
   * intercepts as a "turn ended" signal. Chat-provider then calls
   * tracker.endTurn() and re-emits its own enriched usageUpdate with
   * real BPE token counts.
   */
  private handleResult(_event: Record<string, unknown>, emit: EmitFn): void {
    emit({
      type: "usageUpdate",
      metrics: {
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalCacheCreationTokens: 0,
        totalCacheReadTokens: 0,
        totalTurns: 0,
        totalDurationMs: 0,
        contextUsagePercent: 0,
        cacheHitRate: 0,
        estimatedCostUsd: 0,
      },
      model: this.currentModel,
    });
  }

  private handleAssistant(event: Record<string, unknown>, emit: EmitFn): void {
    const message = event.message;
    if (!isObject(message)) return;

    const content = message.content;
    if (!Array.isArray(content)) return;

    for (const item of content) {
      if (!isObject(item) || typeof item.type !== "string") continue;

      if (item.type === "text") {
        // SKIP the full text message if we already streamed it via
        // stream_event deltas. Otherwise cortex sends both the incremental
        // deltas (via stream_event) AND a final consolidated text message
        // (via assistant), causing the whole response to appear twice.
        if (this.streamingText) {
          continue;
        }
        const text = typeof item.text === "string" ? item.text : "";
        if (text.length > 0) {
          emit({ type: "thinkingEnd" });
          emit({ type: "streamText", text });
          emit({ type: "streamEnd" });
        }
      } else if (item.type === "tool_use") {
        const toolId = typeof item.id === "string" ? item.id : "";
        const toolName = typeof item.name === "string" ? item.name : "unknown_tool";
        const toolInput = item.input;
        const inputPreview =
          toolInput && Object.keys(toolInput as object).length > 0
            ? JSON.stringify(toolInput).slice(0, 200)
            : undefined;
        this.pendingTools.set(toolId, { id: toolId, name: toolName });
        // Tool use is non-streaming (comes as a complete block), so clear
        // the thinking indicator here too.
        emit({ type: "thinkingEnd" });
        emit({ type: "toolCallStart", name: toolName, input: inputPreview });
      }
    }
  }

  /**
   * Handle Anthropic-style streaming events when --include-partial-messages
   * is enabled. Cortex wraps each event in a {type:"stream_event", event:{...}}
   * envelope. Inside, we look for content_block_start / content_block_delta /
   * content_block_stop events to drive incremental assistant text rendering.
   */
  private handleStreamEvent(outer: Record<string, unknown>, emit: EmitFn): void {
    const inner = outer.event;
    if (!isObject(inner) || typeof inner.type !== "string") return;

    switch (inner.type) {
      case "content_block_start": {
        const block = inner.content_block;
        if (isObject(block) && block.type === "text") {
          // Start of a text content block. Mark that we're now in streaming
          // mode so we skip the final full assistant text message when it
          // arrives later. Also clear the thinking indicator.
          this.streamingText = true;
          emit({ type: "thinkingEnd" });
          // Don't emit anything for the webview yet — wait for the first
          // text_delta to avoid creating an empty bubble.
        }
        // content_block_start for tool_use blocks is ignored; the full
        // assistant message with tool_use is handled by handleAssistant.
        break;
      }
      case "content_block_delta": {
        const delta = inner.delta;
        if (isObject(delta) && delta.type === "text_delta") {
          const text = typeof delta.text === "string" ? delta.text : "";
          if (text.length > 0) {
            emit({ type: "streamText", text });
          }
        }
        break;
      }
      case "content_block_stop": {
        if (this.streamingText) {
          emit({ type: "streamEnd" });
          // Keep streamingText=true until the full assistant message arrives
          // and we skip it. The flag is cleared in the result event handler.
        }
        break;
      }
      case "message_start":
      case "message_delta":
      case "message_stop":
      case "ping":
        // These are lifecycle events we don't need to act on
        break;
      default:
        // Unknown stream_event subtype — ignore silently (don't spam raw output)
        break;
    }
  }

  private handleUser(event: Record<string, unknown>, emit: EmitFn): void {
    // User events in cortex's stream represent tool_result messages coming
    // back from tool executions. They have the same shape as assistant
    // messages but with content items of type tool_result.
    const message = event.message;
    if (!isObject(message)) return;

    const content = message.content;
    if (!Array.isArray(content)) return;

    for (const item of content) {
      if (!isObject(item) || item.type !== "tool_result") continue;

      const toolUseId = typeof item.tool_use_id === "string" ? item.tool_use_id : "";
      const pending = this.pendingTools.get(toolUseId);
      const toolName = pending?.name ?? "tool";
      this.pendingTools.delete(toolUseId);

      // Extract the result body — can be a string or an array of content blocks
      let body = "";
      const resultContent = item.content;
      if (typeof resultContent === "string") {
        body = resultContent;
      } else if (Array.isArray(resultContent)) {
        for (const rc of resultContent) {
          if (isObject(rc) && rc.type === "text" && typeof rc.text === "string") {
            body += rc.text;
          }
        }
      }

      // Detect success/error by checking is_error field or looking for the
      // "Permission denied" / error patterns in the body text
      let success = true;
      if (item.is_error === true) {
        success = false;
      } else if (body.includes('"success":false') || body.toLowerCase().includes("permission denied")) {
        success = false;
      }

      emit({
        type: "toolCallEnd",
        name: toolName,
        success,
        body,
      });
    }
  }
}

function isObject(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}
