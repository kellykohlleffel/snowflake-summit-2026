import Anthropic from "@anthropic-ai/sdk";

/** Tracks which auth method is active for the current session. */
export type AuthMethod = "oauth" | "api-key";
let _activeAuthMethod: AuthMethod = "api-key";

/** Returns the auth method currently in use. */
export function getActiveAuthMethod(): AuthMethod {
  return _activeAuthMethod;
}

/**
 * Create an Anthropic client instance with automatic auth fallback.
 *
 * Priority:
 * 1. Try OAuth auth token first (Claude Max subscription — $0 cost)
 * 2. If OAuth fails at runtime, fall back to API key
 * 3. If neither works, throw
 *
 * This ensures the Max subscription is used whenever possible,
 * with API key as a fallback for contexts where OAuth doesn't work
 * (e.g., subprocess execution from Claude Code).
 */
export function createClaudeClient(apiKey: string, authToken?: string): Anthropic {
  if (authToken && apiKey) {
    _activeAuthMethod = "oauth";
    return createFallbackClient(apiKey, authToken);
  }
  if (authToken) {
    _activeAuthMethod = "oauth";
    return new Anthropic({ authToken } as ConstructorParameters<typeof Anthropic>[0]);
  }
  _activeAuthMethod = "api-key";
  return new Anthropic({ apiKey });
}

/**
 * Creates a client that tries OAuth first. If any API call fails with an
 * auth error, transparently recreates the client with the API key.
 */
function createFallbackClient(apiKey: string, authToken: string): Anthropic {
  let apiKeyClient: Anthropic | null = null;
  let useApiKey = false;

  const primaryClient = new Anthropic({ authToken } as ConstructorParameters<typeof Anthropic>[0]);

  const originalMessages = primaryClient.messages;
  const wrappedMessages = Object.create(originalMessages);

  wrappedMessages.stream = function (...args: Parameters<typeof originalMessages.stream>) {
    if (useApiKey) {
      if (!apiKeyClient) apiKeyClient = new Anthropic({ apiKey });
      return apiKeyClient.messages.stream(...args);
    }

    const oauthStream = originalMessages.stream.apply(originalMessages, args);
    const originalFinalMessage = oauthStream.finalMessage.bind(oauthStream);

    oauthStream.finalMessage = async function () {
      try {
        return await originalFinalMessage();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("OAuth") || msg.includes("authentication") || msg.includes("401") || msg.includes("403")) {
          useApiKey = true;
          _activeAuthMethod = "api-key";
          if (!apiKeyClient) apiKeyClient = new Anthropic({ apiKey });
          process.stderr.write("[fivetran] ⚠ OAuth failed — falling back to API key (costs credits)\n");

          const retryStream = apiKeyClient.messages.stream(...args);
          return retryStream.finalMessage();
        }
        throw err;
      }
    };

    return oauthStream;
  };

  primaryClient.messages = wrappedMessages;
  return primaryClient;
}
