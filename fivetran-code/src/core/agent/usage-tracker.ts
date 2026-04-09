/**
 * Session-level token usage and cost tracking.
 *
 * Captures per-turn metrics from the Anthropic API (input, output, cache tokens)
 * and computes running session totals, estimated cost, cache hit rate, and
 * context window usage percentage.
 */

/** Per-API-call usage snapshot extracted from finalMessage.usage. */
export interface TurnUsage {
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
}

/** Accumulated session metrics — computed fresh on every getMetrics() call. */
export interface SessionMetrics {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCacheCreationTokens: number;
  totalCacheReadTokens: number;
  totalApiCalls: number;
  estimatedCostUsd: number;
  /** 0–1 ratio of cache reads to total input tokens. */
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

const DEFAULT_PRICING: ModelPricing = MODEL_PRICING["claude-sonnet-4-6"];

export class SessionTracker {
  private turns: TurnUsage[] = [];
  private model: string;
  private startTime: number;

  constructor(model: string) {
    this.model = model;
    this.startTime = Date.now();
  }

  setModel(model: string): void {
    this.model = model;
  }

  addTurn(usage: TurnUsage): void {
    this.turns.push(usage);
  }

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

    const pricing = MODEL_PRICING[this.model] ?? DEFAULT_PRICING;

    // Cache hit rate: ratio of cached reads to total input sent to the API
    const totalInputAll = totalInput + totalCacheCreation + totalCacheRead;
    const cacheHitRate = totalInputAll > 0 ? totalCacheRead / totalInputAll : 0;

    // Context usage: the last turn's total input reflects how full the context is
    const lastTurn = this.turns[this.turns.length - 1];
    const lastInputTotal = lastTurn
      ? lastTurn.inputTokens + lastTurn.cacheCreationTokens + lastTurn.cacheReadTokens
      : 0;
    const contextUsagePercent =
      pricing.contextWindow > 0
        ? (lastInputTotal / pricing.contextWindow) * 100
        : 0;

    // Cost estimate using granular cache pricing
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

  reset(): void {
    this.turns = [];
    this.startTime = Date.now();
  }
}
