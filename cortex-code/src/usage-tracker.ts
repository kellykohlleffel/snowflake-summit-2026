import type { TokenCounter, CountTokensMessage } from "./token-counter.js";

/**
 * Session-level token usage and cost tracking for Cortex Code sessions.
 *
 * Modeled on fivetran-cli/src/core/agent/usage-tracker.ts but adapted for
 * the different data-source model:
 *
 *   - Fivetran Code reads `finalMessage.usage` directly from Anthropic
 *     API responses (exact counts from the server).
 *
 *   - Cortex Code for VSCode has no direct access to the LLM — cortex
 *     owns the backend call, and Snowflake Cortex Complete doesn't
 *     surface usage. Instead, we accumulate per-turn content as we
 *     observe it flowing through cortex's stream-json stream, then
 *     call Anthropic's count_tokens endpoint (free, non-invocation) to
 *     tokenize the content and get real BPE token counts.
 *
 * Turn lifecycle:
 *
 *   1. User submits a message → startTurn(userText)
 *   2. Cortex streams deltas → recordAssistantText(delta) * N
 *   3. Cortex emits tool_use → recordToolUse(name, input)
 *   4. Cortex executes tool, emits tool_result → recordToolResult(body)
 *   5. (Steps 2–4 can repeat if cortex does multiple tool rounds)
 *   6. Cortex emits result event → endTurn() → async count_tokens call
 *   7. Resolved metrics land in sessionMetrics, consumer re-emits as a
 *      usageUpdate webview message
 *
 * The message array we hand to count_tokens is built from the turn's
 * user text plus assistant text plus serialized tool calls and results.
 * Output tokens are counted exactly from the assistant text we observe
 * (same content the backend generated). Input tokens are a lower bound
 * on real billing because cortex's hidden system prompt and tool schemas
 * are invisible to us.
 */

export interface TurnUsage {
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
}

export interface SessionMetrics {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCacheCreationTokens: number;
  totalCacheReadTokens: number;
  totalApiCalls: number;
  estimatedCostUsd: number;
  /** 0–1 ratio of cache reads to total input tokens. Always 0 for cortex. */
  cacheHitRate: number;
  /** 0–100 estimated percentage of context window used (from last turn). */
  contextUsagePercent: number;
  /** Seconds since session started. */
  elapsedSeconds: number;
}

interface ModelPricing {
  inputPerMillion: number;
  outputPerMillion: number;
  cacheWritePerMillion: number;
  cacheReadPerMillion: number;
  contextWindow: number;
}

/**
 * Pricing table ported verbatim from
 * fivetran-cli/src/core/agent/usage-tracker.ts. Numbers match Anthropic's
 * published per-model rates for Claude 4.5/4.6 Sonnet, Opus, and Haiku.
 * These are used to compute a USD cost estimate from the observed token
 * counts — they do NOT match Snowflake Cortex Complete's credit-based
 * pricing, so the displayed cost is an approximation for budget awareness
 * rather than a precise billing figure.
 */
const MODEL_PRICING: Record<string, ModelPricing> = {
  "claude-haiku-4-5-20251001": {
    inputPerMillion: 1.0,
    outputPerMillion: 5.0,
    cacheWritePerMillion: 1.25,
    cacheReadPerMillion: 0.1,
    contextWindow: 200_000,
  },
  "claude-sonnet-4-6": {
    inputPerMillion: 3.0,
    outputPerMillion: 15.0,
    cacheWritePerMillion: 3.75,
    cacheReadPerMillion: 0.3,
    contextWindow: 200_000,
  },
  "claude-opus-4-6": {
    inputPerMillion: 5.0,
    outputPerMillion: 25.0,
    cacheWritePerMillion: 6.25,
    cacheReadPerMillion: 0.5,
    contextWindow: 200_000,
  },
};

const DEFAULT_PRICING_MODEL = "claude-sonnet-4-6";

/**
 * Current-turn accumulator. Populated incrementally as cortex emits
 * content events, then drained on endTurn().
 */
interface PendingTurn {
  userText: string;
  assistantText: string;
  toolUses: Array<{ name: string; inputJson: string }>;
  toolResults: string[];
}

export class CortexUsageTracker {
  private turns: TurnUsage[] = [];
  private pricingModel: string;
  private startTime: number;
  private pending: PendingTurn | null = null;

  constructor(
    private readonly tokenCounter: TokenCounter,
    pricingModel: string = DEFAULT_PRICING_MODEL
  ) {
    this.pricingModel = this.normalizeModel(pricingModel);
    this.startTime = Date.now();
  }

  /** Switch which pricing row to use (e.g., when user changes the setting). */
  setPricingModel(model: string): void {
    this.pricingModel = this.normalizeModel(model);
  }

  /** Begin a new turn. Captures the user text and clears per-turn state. */
  startTurn(userText: string): void {
    this.pending = {
      userText,
      assistantText: "",
      toolUses: [],
      toolResults: [],
    };
  }

  /** Accumulate a piece of assistant text delta. */
  recordAssistantText(text: string): void {
    if (!this.pending) return;
    this.pending.assistantText += text;
  }

  /** Record a tool_use block emitted by the assistant. */
  recordToolUse(name: string, inputJson: string): void {
    if (!this.pending) return;
    this.pending.toolUses.push({ name, inputJson });
  }

  /** Record a tool_result that came back from executing a tool. */
  recordToolResult(body: string): void {
    if (!this.pending) return;
    this.pending.toolResults.push(body);
  }

  /**
   * End the current turn — build a messages array from the accumulated
   * content and call count_tokens to get real BPE token counts. Adds the
   * result to the session history. Non-blocking: callers await this
   * promise if they want updated metrics, but can fire-and-forget if
   * they don't.
   *
   * If no pending turn is active (e.g., cortex emits a spurious result
   * event), silently returns.
   */
  async endTurn(): Promise<void> {
    const turn = this.pending;
    this.pending = null;
    if (!turn) return;

    // Build an Anthropic Messages array from the observed content.
    //
    // For input tokenization we want: the user's prompt plus any tool
    // results from this turn (since those get fed back to the assistant
    // as context on the next backend call). Assistant text and tool_use
    // blocks are OUTPUT from this turn's perspective, so they go into
    // their own counting pass.
    //
    // We keep this simple: concatenate strings rather than build a
    // full structured messages array with tool_use / tool_result content
    // blocks. The approximation is fine because count_tokens tokenizes
    // whatever text we give it — the BPE count is the same whether
    // tool_use is a structured block or a stringified representation.
    const inputMessage: CountTokensMessage = {
      role: "user",
      content: [
        turn.userText,
        ...turn.toolResults.map((r, i) => `[tool_result ${i}]\n${r}`),
      ].join("\n\n"),
    };

    const outputParts = [
      turn.assistantText,
      ...turn.toolUses.map(
        (t, i) => `[tool_use ${i}: ${t.name}]\n${t.inputJson}`
      ),
    ].filter((s) => s.length > 0);

    // Count tokens for input and output separately. Two API calls per
    // turn (~400ms total) but each call is free and independent.
    const [inputResult, outputResult] = await Promise.all([
      this.tokenCounter.countTokens(this.pricingModel, [inputMessage]),
      outputParts.length > 0
        ? this.tokenCounter.countTokens(this.pricingModel, [
            { role: "assistant", content: outputParts.join("\n\n") },
          ])
        : Promise.resolve({ inputTokens: 0 }),
    ]);

    this.turns.push({
      inputTokens: inputResult.inputTokens,
      outputTokens: outputResult.inputTokens,
      cacheCreationTokens: 0,
      cacheReadTokens: 0,
    });
  }

  /** Compute and return current session metrics. */
  getMetrics(): SessionMetrics {
    let totalInput = 0;
    let totalOutput = 0;
    let totalCacheCreation = 0;
    let totalCacheRead = 0;

    for (const t of this.turns) {
      totalInput += t.inputTokens;
      totalOutput += t.outputTokens;
      totalCacheCreation += t.cacheCreationTokens;
      totalCacheRead += t.cacheReadTokens;
    }

    const pricing = MODEL_PRICING[this.pricingModel] ?? MODEL_PRICING[DEFAULT_PRICING_MODEL];
    if (!pricing) {
      // Should never happen — DEFAULT_PRICING_MODEL is always in MODEL_PRICING
      return this.emptyMetrics();
    }

    // Cache hit rate: always 0 for cortex since Snowflake Cortex Complete
    // doesn't report cache metrics. Webview renders this as "—".
    const totalInputAll = totalInput + totalCacheCreation + totalCacheRead;
    const cacheHitRate = totalInputAll > 0 ? totalCacheRead / totalInputAll : 0;

    // Context usage: accumulate all input + output tokens across turns as
    // an approximation of cortex's internal context window. Unlike Fivetran
    // Code where each turn sends the full history, cortex manages context
    // internally — so we estimate by summing everything observed so far.
    const contextTokens = totalInput + totalOutput;
    const contextUsagePercent =
      pricing.contextWindow > 0
        ? (contextTokens / pricing.contextWindow) * 100
        : 0;

    const estimatedCostUsd =
      (totalInput / 1_000_000) * pricing.inputPerMillion +
      (totalOutput / 1_000_000) * pricing.outputPerMillion +
      (totalCacheCreation / 1_000_000) * pricing.cacheWritePerMillion +
      (totalCacheRead / 1_000_000) * pricing.cacheReadPerMillion;

    return {
      totalInputTokens: totalInput,
      totalOutputTokens: totalOutput,
      totalCacheCreationTokens: totalCacheCreation,
      totalCacheReadTokens: totalCacheRead,
      totalApiCalls: this.turns.length,
      estimatedCostUsd,
      cacheHitRate,
      contextUsagePercent,
      elapsedSeconds: Math.floor((Date.now() - this.startTime) / 1000),
    };
  }

  /** Clear all session state (e.g., on session restart). */
  reset(): void {
    this.turns = [];
    this.pending = null;
    this.startTime = Date.now();
  }

  private normalizeModel(model: string): string {
    // Cortex reports "auto" which isn't in our pricing table; default to Sonnet.
    if (!model || model === "auto" || !MODEL_PRICING[model]) {
      return DEFAULT_PRICING_MODEL;
    }
    return model;
  }

  private emptyMetrics(): SessionMetrics {
    return {
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalCacheCreationTokens: 0,
      totalCacheReadTokens: 0,
      totalApiCalls: 0,
      estimatedCostUsd: 0,
      cacheHitRate: 0,
      contextUsagePercent: 0,
      elapsedSeconds: Math.floor((Date.now() - this.startTime) / 1000),
    };
  }
}
