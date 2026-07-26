/**
 * Simple in-memory rate limiter extension point for domain API routes.
 * Swap the store for Redis / Upstash in production without changing callers.
 */

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

export type RateLimitStore = {
  hit(key: string, windowMs: number): { count: number; resetAt: number };
};

class MemoryRateLimitStore implements RateLimitStore {
  private readonly buckets = new Map<string, { count: number; resetAt: number }>();

  hit(key: string, windowMs: number) {
    const now = Date.now();
    const existing = this.buckets.get(key);
    if (!existing || existing.resetAt <= now) {
      const next = { count: 1, resetAt: now + windowMs };
      this.buckets.set(key, next);
      return next;
    }
    existing.count += 1;
    return existing;
  }
}

const defaultStore: RateLimitStore = new MemoryRateLimitStore();

/**
 * Fixed-window rate limit check.
 * @example
 * const limit = checkDomainRateLimit(`domains:create:${userId}`, { limit: 10, windowMs: 60_000 });
 */
export function checkDomainRateLimit(
  key: string,
  options: { limit: number; windowMs: number; store?: RateLimitStore },
): RateLimitResult {
  const store = options.store ?? defaultStore;
  const bucket = store.hit(key, options.windowMs);
  const allowed = bucket.count <= options.limit;
  const retryAfterSeconds = Math.max(
    1,
    Math.ceil((bucket.resetAt - Date.now()) / 1000),
  );
  return {
    allowed,
    remaining: Math.max(0, options.limit - bucket.count),
    retryAfterSeconds,
  };
}
