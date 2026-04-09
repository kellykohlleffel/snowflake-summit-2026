import { FivetranApiError, RateLimitError } from "./errors.js";
import type { FivetranResponse, PaginatedData } from "./types.js";
import {
  FIVETRAN_API_BASE_URL,
  FIVETRAN_API_ACCEPT_HEADER,
  MAX_RETRIES,
  INITIAL_RETRY_DELAY_MS,
  DEFAULT_PAGE_LIMIT,
} from "../utils/constants.js";

/**
 * Fivetran REST API v1 client.
 *
 * Uses HTTP Basic Auth (api_key:api_secret), automatic retry with
 * exponential backoff on 429 rate limits, and cursor-based pagination.
 */
export class FivetranApiClient {
  private authHeader: string;

  constructor(apiKey: string, apiSecret: string) {
    const credentials = Buffer.from(`${apiKey}:${apiSecret}`).toString(
      "base64"
    );
    this.authHeader = `Basic ${credentials}`;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: Record<string, unknown>,
    retryCount = 0
  ): Promise<FivetranResponse<T>> {
    const url = `${FIVETRAN_API_BASE_URL}${path}`;
    const headers: Record<string, string> = {
      Authorization: this.authHeader,
      Accept: FIVETRAN_API_ACCEPT_HEADER,
    };
    if (body) {
      headers["Content-Type"] = "application/json";
    }

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    // Handle rate limiting with exponential backoff
    if (response.status === 429) {
      if (retryCount >= MAX_RETRIES) {
        throw new RateLimitError("Rate limit exceeded after max retries");
      }
      const retryAfter = response.headers.get("retry-after");
      const delay = retryAfter
        ? parseInt(retryAfter, 10) * 1000
        : INITIAL_RETRY_DELAY_MS * Math.pow(2, retryCount);
      await new Promise((resolve) => setTimeout(resolve, delay));
      return this.request<T>(method, path, body, retryCount + 1);
    }

    const json = (await response.json()) as FivetranResponse<T> & {
      message?: string;
      code?: string;
    };

    if (!response.ok) {
      throw new FivetranApiError(
        json.message || `API request failed: ${response.status}`,
        response.status,
        json.code
      );
    }

    return json;
  }

  async get<T>(path: string): Promise<FivetranResponse<T>> {
    return this.request<T>("GET", path);
  }

  async post<T>(
    path: string,
    body?: Record<string, unknown>
  ): Promise<FivetranResponse<T>> {
    return this.request<T>("POST", path, body);
  }

  async patch<T>(
    path: string,
    body: Record<string, unknown>
  ): Promise<FivetranResponse<T>> {
    return this.request<T>("PATCH", path, body);
  }

  async delete<T>(path: string): Promise<FivetranResponse<T>> {
    return this.request<T>("DELETE", path);
  }

  /**
   * Auto-paginate: fetches all pages and returns combined items.
   * Use with caution on large accounts — prefer single-page requests
   * for tool calls so Claude can paginate explicitly.
   */
  async getAllPages<T>(
    path: string,
    limit = DEFAULT_PAGE_LIMIT
  ): Promise<T[]> {
    const allItems: T[] = [];
    let cursor: string | undefined;

    do {
      const params = new URLSearchParams({ limit: String(limit) });
      if (cursor) params.set("cursor", cursor);
      const separator = path.includes("?") ? "&" : "?";
      const response = await this.get<PaginatedData<T>>(
        `${path}${separator}${params.toString()}`
      );
      allItems.push(...response.data.items);
      cursor = response.data.next_cursor;
    } while (cursor);

    return allItems;
  }
}

/** Singleton instance — initialized during config loading. */
let _apiClient: FivetranApiClient | null = null;

export function initFivetranApi(apiKey: string, apiSecret: string): void {
  _apiClient = new FivetranApiClient(apiKey, apiSecret);
}

export function getFivetranApi(): FivetranApiClient {
  if (!_apiClient) {
    throw new Error(
      "Fivetran API client not initialized. Call initFivetranApi() first."
    );
  }
  return _apiClient;
}
