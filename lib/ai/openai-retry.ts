/**
 * Transient-error detection + retry for OpenAI calls (Sprint 21.0A).
 * Validation / malformed-response errors must NOT be retried.
 */

import { AiError, isAiError } from "@/lib/ai/errors";

export type AiRetryOptions = {
  retries?: number;
  baseDelayMs?: number;
  sleep?: (ms: number) => Promise<void>;
  shouldRetry?: (error: unknown, attempt: number) => boolean;
};

function defaultSleep(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/** True for rate limits, timeouts, and 5xx / network failures. */
export function isTransientAiError(error: unknown): boolean {
  if (isAiError(error)) {
    if (
      error.code === "invalid_response" ||
      error.code === "bad_request" ||
      error.code === "not_configured" ||
      error.code === "unauthorized" ||
      error.code === "forbidden"
    ) {
      return false;
    }
    if (error.code === "rate_limited") return true;
    if (error.code === "provider_error") {
      // Timeouts / network-ish provider errors may be transient.
      return /timeout|temporar|network|econnreset|fetch failed|503|502|504/i.test(
        error.message,
      );
    }
    return false;
  }

  const status =
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    typeof (error as { status: unknown }).status === "number"
      ? (error as { status: number }).status
      : null;

  if (status === 408 || status === 429) return true;
  if (status !== null && status >= 500 && status <= 599) return true;

  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : String(error);
  const lower = message.toLowerCase();
  return (
    lower.includes("timeout") ||
    lower.includes("timed out") ||
    lower.includes("aborted") ||
    lower.includes("network") ||
    lower.includes("econnreset") ||
    lower.includes("fetch failed") ||
    lower.includes("rate limit") ||
    lower.includes("overloaded") ||
    lower.includes("503") ||
    lower.includes("502") ||
    lower.includes("504")
  );
}

/**
 * Run `fn` with exponential backoff on transient failures only.
 * Attempt 0 is the first try; `retries` is additional attempts.
 */
export async function withAiRetry<T>(
  fn: (attempt: number) => Promise<T>,
  options: AiRetryOptions = {},
): Promise<T> {
  const retries = options.retries ?? 2;
  const baseDelayMs = options.baseDelayMs ?? 500;
  const sleep = options.sleep ?? defaultSleep;
  const shouldRetry = options.shouldRetry ?? isTransientAiError;

  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await fn(attempt);
    } catch (error) {
      lastError = error;
      if (attempt >= retries || !shouldRetry(error, attempt)) {
        throw error;
      }
      await sleep(baseDelayMs * 2 ** attempt);
    }
  }

  if (lastError instanceof Error) throw lastError;
  throw new AiError("provider_error", "AI request failed after retries.");
}
