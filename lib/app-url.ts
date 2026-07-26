/**
 * Public Atlas application origin for published contact forms and emails.
 *
 * Prefer server-side APP_URL. NEXT_PUBLIC_APP_URL remains supported for
 * client bundles. Localhost is only allowed in local development.
 */

export type AppUrlSource =
  | "APP_URL"
  | "NEXT_PUBLIC_APP_URL"
  | "NEXT_PUBLIC_ATLAS_URL"
  | "VERCEL_URL"
  | "development-localhost";

export type ResolvedAppUrl = {
  origin: string;
  source: AppUrlSource;
  isLocalhost: boolean;
};

const ABSOLUTE_HTTP_ORIGIN =
  /^https?:\/\/[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+(?::\d+)?$/i;

const LOCALHOST_ORIGIN =
  /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i;

let missingWarned = false;
let localhostWarned = false;

export function isLocalhostOrigin(value: string): boolean {
  try {
    const url = new URL(value.trim());
    return (
      url.hostname === "localhost" ||
      url.hostname === "127.0.0.1" ||
      url.hostname === "[::1]"
    );
  } catch {
    return LOCALHOST_ORIGIN.test(value.trim());
  }
}

/** Local `next dev` (not a Vercel deployment of Atlas). */
export function isLocalDevelopmentRuntime(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  if (env.VERCEL === "1") return false;
  return (env.NODE_ENV || "development") === "development";
}

export function isValidAppOrigin(value: string): boolean {
  const trimmed = value.trim().replace(/\/+$/, "");
  if (!trimmed || trimmed.length > 2048) return false;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "http:" && url.protocol !== "https:") return false;
    if (url.username || url.password) return false;
    if (url.pathname && url.pathname !== "/") return false;
    if (url.search || url.hash) return false;
    // Allow localhost in validation (usage gated separately).
    if (isLocalhostOrigin(trimmed)) return true;
    return ABSOLUTE_HTTP_ORIGIN.test(trimmed);
  } catch {
    return false;
  }
}

function normalizeOrigin(value: string): string {
  return value.trim().replace(/\/+$/, "");
}

function readConfiguredOrigin(
  env: NodeJS.ProcessEnv,
): { origin: string; source: AppUrlSource } | null {
  const candidates: Array<{ key: AppUrlSource; value: string | undefined }> = [
    { key: "APP_URL", value: env.APP_URL },
    { key: "NEXT_PUBLIC_APP_URL", value: env.NEXT_PUBLIC_APP_URL },
    { key: "NEXT_PUBLIC_ATLAS_URL", value: env.NEXT_PUBLIC_ATLAS_URL },
  ];

  for (const candidate of candidates) {
    const raw = candidate.value?.trim();
    if (!raw) continue;
    const origin = normalizeOrigin(raw);
    if (!isValidAppOrigin(origin)) {
      console.warn(
        `[atlas] Ignoring invalid ${candidate.key}=${JSON.stringify(raw)}. Expected absolute http(s) origin (no path).`,
      );
      continue;
    }
    return { origin, source: candidate.key };
  }

  return null;
}

function warnMissingAppUrl(context: string): void {
  if (missingWarned) return;
  missingWarned = true;
  console.warn(
    `[atlas] ${context}: APP_URL (or NEXT_PUBLIC_APP_URL) is not set. ` +
      `Published contact forms will not work on deployed preview/production sites. ` +
      `Set APP_URL to your Atlas app origin (e.g. https://app.example.com).`,
  );
}

/**
 * Resolve the public Atlas origin used in published HTML form endpoints.
 *
 * - Configured APP_URL / NEXT_PUBLIC_* wins
 * - On Vercel, falls back to https://VERCEL_URL (never localhost)
 * - Local development may use http://localhost:3000
 * - Non-dev without config returns null (caller must not embed localhost)
 */
export function resolvePublicAppUrl(
  env: NodeJS.ProcessEnv = process.env,
): ResolvedAppUrl | null {
  const configured = readConfiguredOrigin(env);
  if (configured) {
    return {
      origin: configured.origin,
      source: configured.source,
      isLocalhost: isLocalhostOrigin(configured.origin),
    };
  }

  if (env.VERCEL === "1") {
    const vercel = env.VERCEL_URL?.trim();
    if (vercel) {
      const host = vercel.replace(/^https?:\/\//, "").replace(/\/+$/, "");
      const origin = `https://${host}`;
      if (isValidAppOrigin(origin) && !isLocalhostOrigin(origin)) {
        return { origin, source: "VERCEL_URL", isLocalhost: false };
      }
    }
    warnMissingAppUrl("Vercel runtime");
    return null;
  }

  if (isLocalDevelopmentRuntime(env)) {
    if (!localhostWarned) {
      localhostWarned = true;
      console.warn(
        `[atlas] Using http://localhost:3000 for form API origin (development). ` +
          `Set APP_URL before publishing sites that must submit to a deployed Atlas app.`,
      );
    }
    return {
      origin: "http://localhost:3000",
      source: "development-localhost",
      isLocalhost: true,
    };
  }

  warnMissingAppUrl("production/preview runtime");
  return null;
}

/**
 * Origin string for published sites / emails.
 * Localhost only in local development; never invents localhost in deploy runtimes.
 */
export function getPublicAtlasOrigin(
  env: NodeJS.ProcessEnv = process.env,
): string {
  return resolvePublicAppUrl(env)?.origin ?? "";
}

/**
 * Origin allowed inside a deployable static artifact.
 * Never returns localhost — published preview/production HTML must not POST
 * to the publisher's machine. Set APP_URL to the deployed Atlas origin.
 */
export function getPublishableAtlasOrigin(
  env: NodeJS.ProcessEnv = process.env,
): string {
  const resolved = resolvePublicAppUrl(env);
  if (!resolved) return "";

  if (resolved.isLocalhost) {
    if (!missingWarned) {
      missingWarned = true;
      console.warn(
        `[atlas] Refusing to embed localhost in published sites. ` +
          `Set APP_URL to your deployed Atlas origin (e.g. https://your-atlas-app.vercel.app).`,
      );
    }
    return "";
  }

  return resolved.origin;
}

/** Startup check — warn when deploy runtimes lack a public origin. */
export function validateAppUrlAtStartup(
  env: NodeJS.ProcessEnv = process.env,
): void {
  const resolved = resolvePublicAppUrl(env);
  if (resolved && !resolved.isLocalhost) return;

  if (isLocalDevelopmentRuntime(env)) {
    // Localhost fallback already warned inside resolvePublicAppUrl.
    return;
  }

  warnMissingAppUrl("startup");
}

/** Reset warn-once flags (tests). */
export function resetAppUrlWarningStateForTests(): void {
  missingWarned = false;
  localhostWarned = false;
}
