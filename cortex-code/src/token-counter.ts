import Anthropic from "@anthropic-ai/sdk";
import { readFile } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";

/**
 * Thin wrapper around Anthropic's `POST /v1/messages/count_tokens` endpoint.
 *
 * IMPORTANT: count_tokens is NOT model invocation. It does not run a model,
 * does not generate a response, and is explicitly free with its own rate
 * limit separate from the messages API. Authentication uses an Anthropic
 * API key but no LLM work is performed — the server just runs its BPE
 * tokenizer over the messages array and returns the count.
 *
 * Why we need this: Snowflake Cortex Complete (the backend cortex uses)
 * does not surface per-call token counts to the cortex CLI in stream-json
 * mode. Every `result.usage` field comes back as zero. To show real token
 * counts in our footer, we tokenize the content we observe flowing through
 * the stream-json stream using Claude's actual BPE tokenizer — the same
 * one the backend uses — via this endpoint.
 *
 * Known gap: cortex prepends its own system prompt and registers tool
 * schemas that are invisible in the stream-json output. So the input
 * counts we get will be a lower bound on real billing, typically 3–15K
 * tokens short depending on how many tools cortex registered. Output
 * counts are exact because we see the full assistant text.
 */

export interface TokenCount {
  inputTokens: number;
}

/** Minimal message shape matching Anthropic's Messages API. */
export interface CountTokensMessage {
  role: "user" | "assistant";
  content: string;
}

export class TokenCounter {
  private client: Anthropic | null = null;
  private loadPromise: Promise<void>;

  constructor() {
    this.loadPromise = this.loadApiKey();
  }

  /**
   * Resolves true once the API key has been loaded (whether successfully
   * or not). Use this to know when to start attempting count_tokens calls.
   */
  async ready(): Promise<void> {
    await this.loadPromise;
  }

  /** Whether the token counter has a valid API key and can make calls. */
  isAvailable(): boolean {
    return this.client !== null;
  }

  /**
   * Tokenize a messages array using Claude's BPE tokenizer via
   * count_tokens. Returns zero if the API key isn't available or the
   * call fails — never throws.
   */
  async countTokens(
    model: string,
    messages: CountTokensMessage[]
  ): Promise<TokenCount> {
    await this.loadPromise;
    if (!this.client) {
      return { inputTokens: 0 };
    }

    // Empty message list can't be counted — skip the API call
    if (messages.length === 0) {
      return { inputTokens: 0 };
    }

    try {
      const result = await this.client.messages.countTokens({
        model,
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
      });
      return { inputTokens: result.input_tokens };
    } catch (err) {
      // Network error, rate limit, invalid model, etc. — log to stderr
      // (visible in the Extension Dev Host debug console) and degrade
      // to zero counts. We never surface errors to the user — the footer
      // just doesn't update that turn.
      const msg = err instanceof Error ? err.message : String(err);
      process.stderr.write(`[TokenCounter] countTokens failed: ${msg}\n`);
      return { inputTokens: 0 };
    }
  }

  /**
   * Load the Anthropic API key from ~/.fivetran-code/config.json.
   *
   * This is the same config file Fivetran Code itself uses, containing
   * either a single `anthropicApiKey` field or a profile-based
   * `anthropicApiKeys` array (for the Claude API key switcher feature).
   * We prefer the explicit `anthropicApiKey` field; if absent, we fall
   * back to the first profile in `anthropicApiKeys`.
   *
   * If neither is present (or the config file doesn't exist), we leave
   * `this.client` as null and all count calls degrade to zero.
   */
  private async loadApiKey(): Promise<void> {
    const configPath = join(homedir(), ".fivetran-code", "config.json");
    if (!existsSync(configPath)) {
      return;
    }

    try {
      const raw = await readFile(configPath, "utf-8");
      const parsed = JSON.parse(raw) as {
        anthropicApiKey?: string;
        anthropicApiKeys?: Array<{ label: string; key: string }>;
      };

      let apiKey = parsed.anthropicApiKey;
      if (!apiKey && Array.isArray(parsed.anthropicApiKeys) && parsed.anthropicApiKeys.length > 0) {
        apiKey = parsed.anthropicApiKeys[0]?.key;
      }

      if (apiKey && apiKey.length > 0) {
        this.client = new Anthropic({ apiKey });
      }
    } catch {
      // Can't read config file — leave client null, degrade gracefully
    }
  }
}
