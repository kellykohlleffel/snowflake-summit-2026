import { homedir } from "os";
import { join } from "path";
import { readFile, writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import type { AppConfig, ApiKeyProfile } from "./types.js";
import { CONFIG_DIR_NAME, CONFIG_FILE_NAME } from "../utils/constants.js";

const CONFIG_DIR = join(homedir(), CONFIG_DIR_NAME);
const CONFIG_FILE = join(CONFIG_DIR, CONFIG_FILE_NAME);

/**
 * Load configuration by merging all sources.
 * Each field uses the highest-priority source that provides it:
 *   env vars > config file > vscodeSettings
 * This ensures e.g. an auth token in the config file is picked up
 * even when env vars provide the API key.
 */
export async function loadConfig(
  vscodeSettings?: Partial<AppConfig>
): Promise<AppConfig | null> {
  const envConfig = loadFromEnv();
  const fileConfig = await loadFromFile();

  // Merge: env > file > vscode settings. First truthy value wins per field.
  const merged: Partial<AppConfig> = {};
  const sources = [envConfig, fileConfig, vscodeSettings].filter(Boolean) as Partial<AppConfig>[];

  for (const src of sources) {
    if (!merged.fivetranApiKey && src.fivetranApiKey) merged.fivetranApiKey = src.fivetranApiKey;
    if (!merged.fivetranApiSecret && src.fivetranApiSecret) merged.fivetranApiSecret = src.fivetranApiSecret;
    if (!merged.anthropicApiKey && src.anthropicApiKey) merged.anthropicApiKey = src.anthropicApiKey;
    if (!merged.anthropicAuthToken && src.anthropicAuthToken) merged.anthropicAuthToken = src.anthropicAuthToken;
    if (!merged.anthropicApiKeys && src.anthropicApiKeys?.length) merged.anthropicApiKeys = src.anthropicApiKeys;
    if (!merged.snowflakeAccount && src.snowflakeAccount) merged.snowflakeAccount = src.snowflakeAccount;
    if (!merged.snowflakePatToken && src.snowflakePatToken) merged.snowflakePatToken = src.snowflakePatToken;
  }

  if (merged.fivetranApiKey && merged.fivetranApiSecret && (merged.anthropicApiKey || merged.anthropicAuthToken)) {
    return {
      fivetranApiKey: merged.fivetranApiKey,
      fivetranApiSecret: merged.fivetranApiSecret,
      anthropicApiKey: merged.anthropicApiKey ?? "",
      anthropicAuthToken: merged.anthropicAuthToken,
      anthropicApiKeys: merged.anthropicApiKeys,
      snowflakeAccount: merged.snowflakeAccount,
      snowflakePatToken: merged.snowflakePatToken,
    };
  }

  return null;
}

function loadFromEnv(): AppConfig | null {
  const fivetranApiKey = process.env.FIVETRAN_API_KEY;
  const fivetranApiSecret = process.env.FIVETRAN_API_SECRET;
  const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
  const anthropicAuthToken = process.env.ANTHROPIC_AUTH_TOKEN;
  const snowflakeAccount = process.env.SNOWFLAKE_ACCOUNT;
  const snowflakePatToken = process.env.SNOWFLAKE_PAT_TOKEN;

  // Accept either API key or OAuth token for Anthropic auth
  if (fivetranApiKey && fivetranApiSecret && (anthropicApiKey || anthropicAuthToken)) {
    return {
      fivetranApiKey,
      fivetranApiSecret,
      anthropicApiKey: anthropicApiKey ?? "",
      anthropicAuthToken,
      snowflakeAccount,
      snowflakePatToken,
    };
  }
  return null;
}

async function loadFromFile(): Promise<AppConfig | null> {
  if (!existsSync(CONFIG_FILE)) return null;

  try {
    const raw = await readFile(CONFIG_FILE, "utf-8");
    const parsed = JSON.parse(raw) as Partial<AppConfig>;

    // Parse named API key profiles if present
    let apiKeys: ApiKeyProfile[] | undefined;
    if (Array.isArray(parsed.anthropicApiKeys)) {
      apiKeys = parsed.anthropicApiKeys.filter(
        (p): p is ApiKeyProfile => typeof p.label === "string" && typeof p.key === "string"
      );
      if (apiKeys.length === 0) apiKeys = undefined;
    }

    if (parsed.fivetranApiKey && parsed.fivetranApiSecret && (parsed.anthropicApiKey || parsed.anthropicAuthToken || apiKeys?.length)) {
      return {
        fivetranApiKey: parsed.fivetranApiKey,
        fivetranApiSecret: parsed.fivetranApiSecret,
        anthropicApiKey: parsed.anthropicApiKey ?? apiKeys?.[0]?.key ?? "",
        anthropicAuthToken: parsed.anthropicAuthToken,
        anthropicApiKeys: apiKeys,
        snowflakeAccount: parsed.snowflakeAccount,
        snowflakePatToken: parsed.snowflakePatToken,
      };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Save configuration to ~/.fivetran-code/config.json with restricted permissions.
 */
export async function saveConfig(config: AppConfig): Promise<void> {
  if (!existsSync(CONFIG_DIR)) {
    await mkdir(CONFIG_DIR, { recursive: true });
  }
  await writeFile(CONFIG_FILE, JSON.stringify(config, null, 2), {
    mode: 0o600, // Owner read/write only — protects API keys
  });
}

/**
 * Get the config file path (for display purposes).
 */
export function getConfigPath(): string {
  return CONFIG_FILE;
}
