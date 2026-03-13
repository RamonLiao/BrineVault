// ========== Retry Utility with Exponential Backoff ==========

import { DEFAULT_UPLOAD_RETRY, type RetryConfig } from "./config.js";

/** Error thrown when a Walrus API call fails */
export class WalrusApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body?: string,
  ) {
    super(message);
    this.name = "WalrusApiError";
  }

  /** Whether this error is retryable */
  get retryable(): boolean {
    return this.status === 503 || this.status >= 500;
  }

  /** Whether the request should switch to chunked upload */
  get shouldChunk(): boolean {
    return this.status === 413;
  }
}

/** Non-retryable status codes */
const NON_RETRYABLE = new Set([400, 401, 402, 404, 413]);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Execute `fn` with exponential backoff retry.
 *
 * - 503 / 5xx: retry
 * - 404, 400, 413: throw immediately (non-retryable)
 * - 413: caller can inspect `WalrusApiError.shouldChunk`
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  config: RetryConfig = DEFAULT_UPLOAD_RETRY,
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;

      // Don't retry non-retryable errors
      if (err instanceof WalrusApiError && NON_RETRYABLE.has(err.status)) {
        throw err;
      }

      // Last attempt — throw
      if (attempt === config.maxAttempts) {
        throw err;
      }

      // Exponential backoff
      const delay = Math.min(
        config.baseDelay * Math.pow(config.backoffFactor, attempt - 1),
        config.maxDelay,
      );
      await sleep(delay);
    }
  }

  // Should not reach here, but TypeScript needs it
  throw lastError;
}
