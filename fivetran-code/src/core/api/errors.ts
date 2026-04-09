export class FivetranApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly code?: string
  ) {
    super(message);
    this.name = "FivetranApiError";
  }
}

export class RateLimitError extends FivetranApiError {
  constructor(message: string) {
    super(message, 429, "RateLimited");
    this.name = "RateLimitError";
  }
}
