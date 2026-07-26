/** Shared retry + transient-error helpers for deployment providers. */

export type RetryOptions = {
  retries?: number;
  baseDelayMs?: number;
  /** Override sleep (tests). */
  sleep?: (ms: number) => Promise<void>;
  /** Optional predicate — return false to stop retrying. */
  shouldRetry?: (error: unknown, attempt: number) => boolean;
};

function defaultSleep(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/** Heuristic for network / rate-limit / 5xx style failures. */
export function isTransientDeploymentError(error: unknown): boolean {
  if (error == null) return false;

  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : typeof error === "object" &&
            "message" in error &&
            typeof (error as { message: unknown }).message === "string"
          ? (error as { message: string }).message
          : String(error);

  const lower = message.toLowerCase();
  const status =
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    typeof (error as { status: unknown }).status === "number"
      ? (error as { status: number }).status
      : typeof error === "object" &&
          error !== null &&
          "statusCode" in error &&
          typeof (error as { statusCode: unknown }).statusCode === "number"
        ? (error as { statusCode: number }).statusCode
        : null;

  if (status !== null) {
    if (status === 408 || status === 429) return true;
    if (status >= 500 && status <= 599) return true;
  }

  return (
    lower.includes("failed to fetch") ||
    lower.includes("network") ||
    lower.includes("timeout") ||
    lower.includes("temporar") ||
    lower.includes("rate limit") ||
    lower.includes("429") ||
    lower.includes("503") ||
    lower.includes("502") ||
    lower.includes("econnreset") ||
    lower.includes("fetch failed")
  );
}

/**
 * Run `fn` with exponential backoff on transient failures.
 * Attempt 0 is the first try; `retries` is the number of re-attempts.
 */
export async function withRetry<T>(
  fn: (attempt: number) => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const retries = options.retries ?? 3;
  const baseDelayMs = options.baseDelayMs ?? 400;
  const sleep = options.sleep ?? defaultSleep;
  const shouldRetry = options.shouldRetry ?? isTransientDeploymentError;

  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await fn(attempt);
    } catch (error) {
      lastError = error;
      if (attempt >= retries || !shouldRetry(error, attempt)) {
        throw error;
      }
      const delay = baseDelayMs * 2 ** attempt;
      await sleep(delay);
    }
  }

  throw lastError;
}
