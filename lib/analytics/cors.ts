/**
 * CORS helpers for public analytics collect (published sites → Atlas API).
 * Reflects specific allowed origins — never uses credentials + `*`.
 */

import type { Database } from "@/lib/supabase/types";
import type { SupabaseClient } from "@supabase/supabase-js";

export const ANALYTICS_CORS_METHODS = "POST, OPTIONS";
export const ANALYTICS_CORS_HEADERS = "Content-Type";
export const ANALYTICS_CORS_MAX_AGE = "86400";

export type AnalyticsCorsDecision =
  | { allowed: true; origin: string; reason: "vercel_preview" | "custom_domain" }
  | { allowed: false; reason: "missing_origin" | "invalid_origin" | "blocked" };

export type AnalyticsDomainClient = {
  findVerifiedHostname: (input: {
    hostname: string;
    projectId?: string | null;
  }) => Promise<boolean>;
};

/** Parse Origin header into a canonical origin (scheme + host [+ port]). */
export function parseRequestOrigin(
  originHeader: string | null | undefined,
): string | null {
  const raw = originHeader?.trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (url.username || url.password) return null;
    return url.origin;
  } catch {
    return null;
  }
}

/** Published Atlas sites on Vercel (e.g. atlas-sites-….vercel.app). */
export function isAtlasVercelPreviewOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    if (url.protocol !== "https:") return false;
    const host = url.hostname.toLowerCase();
    if (host === "vercel.app") return false;
    return host.endsWith(".vercel.app");
  } catch {
    return false;
  }
}

export function hostnameFromOrigin(origin: string): string | null {
  try {
    return new URL(origin).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Sync allowlist check (preview hosts). Custom domains need a DB lookup.
 */
export function evaluateAnalyticsOriginSync(
  originHeader: string | null | undefined,
): AnalyticsCorsDecision {
  const origin = parseRequestOrigin(originHeader);
  if (!origin) {
    return { allowed: false, reason: "missing_origin" };
  }
  if (isAtlasVercelPreviewOrigin(origin)) {
    return { allowed: true, origin, reason: "vercel_preview" };
  }
  return { allowed: false, reason: "blocked" };
}

/** Supabase-backed lookup for verified/active custom domains. */
export function createSupabaseAnalyticsDomainClient(
  client: Pick<SupabaseClient<Database>, "from">,
): AnalyticsDomainClient {
  return {
    async findVerifiedHostname(input) {
      const hostname = input.hostname.trim().toLowerCase();
      if (!hostname) return false;

      let query = client
        .from("project_domains")
        .select("id")
        .eq("normalized_hostname", hostname)
        .in("status", ["active", "verified"])
        .limit(1);

      if (input.projectId) {
        query = query.eq("project_id", input.projectId);
      }

      const { data, error } = await query.maybeSingle();
      if (error) return false;
      return Boolean(data);
    },
  };
}

/**
 * Full origin decision for POST (project-scoped custom domains) or OPTIONS.
 */
export async function resolveAnalyticsCorsOrigin(
  originHeader: string | null | undefined,
  options: {
    projectId?: string | null;
    domainClient?: AnalyticsDomainClient | null;
  } = {},
): Promise<AnalyticsCorsDecision> {
  const sync = evaluateAnalyticsOriginSync(originHeader);
  if (sync.allowed) return sync;

  const origin = parseRequestOrigin(originHeader);
  if (!origin) {
    return { allowed: false, reason: "missing_origin" };
  }

  const hostname = hostnameFromOrigin(origin);
  if (!hostname || !options.domainClient) {
    return { allowed: false, reason: "blocked" };
  }

  const ok = await options.domainClient.findVerifiedHostname({
    hostname,
    projectId: options.projectId,
  });
  if (ok) {
    return { allowed: true, origin, reason: "custom_domain" };
  }

  return { allowed: false, reason: "blocked" };
}

/** Headers to attach when the origin is allowed. */
export function analyticsCorsHeaderRecord(
  allowedOrigin: string,
): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": ANALYTICS_CORS_METHODS,
    "Access-Control-Allow-Headers": ANALYTICS_CORS_HEADERS,
    "Access-Control-Max-Age": ANALYTICS_CORS_MAX_AGE,
    Vary: "Origin",
  };
}

/** Apply CORS headers onto a NextResponse-like headers bag. */
export function applyAnalyticsCorsHeaders(
  headers: Headers,
  allowedOrigin: string | null,
): void {
  if (!allowedOrigin) return;
  const record = analyticsCorsHeaderRecord(allowedOrigin);
  for (const [key, value] of Object.entries(record)) {
    headers.set(key, value);
  }
}
