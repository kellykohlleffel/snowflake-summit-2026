/** A named Anthropic API key profile for switching between keys at runtime. */
export interface ApiKeyProfile {
  label: string;
  key: string;
}

export interface AppConfig {
  fivetranApiKey: string;
  fivetranApiSecret: string;
  anthropicApiKey: string;
  /** OAuth auth token for Claude Max subscription (alternative to API key). */
  anthropicAuthToken?: string;
  /** Named API key profiles for runtime switching (optional). */
  anthropicApiKeys?: ApiKeyProfile[];
  defaultModel?: string;
  defaultGroupId?: string;
  /** Snowflake account identifier (e.g., "a3209653506471-sales-eng-hands-on-lab"). */
  snowflakeAccount?: string;
  /** Snowflake Personal Access Token for Cortex Agent REST API. */
  snowflakePatToken?: string;
}
