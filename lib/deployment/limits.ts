/**
 * Operational limits for deployment (Sprint 19.0A).
 * Keep route maxDuration above provider poll timeout + upload headroom.
 */

/** Next.js route segment config (seconds). */
export const DEPLOYMENT_ROUTE_MAX_DURATION_SECONDS = 120;

/** Vercel deployment readiness poll timeout. */
export const DEPLOYMENT_POLL_TIMEOUT_MS = 90_000;

/** Default poll interval while waiting for READY. */
export const DEPLOYMENT_POLL_INTERVAL_MS = 1_200;

/** Transient HTTP retries for Vercel API calls. */
export const DEPLOYMENT_HTTP_RETRIES = 3;

/** Max artifact fingerprint reuse window is implicit — same fingerprint skips redeploy. */
export const DEPLOYMENT_IDEMPOTENCY_HEADER = "idempotency-key";
