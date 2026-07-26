import { createHash, randomUUID } from "node:crypto";

/** Hash a client-generated visitor UUID — never store the raw id. */
export function hashVisitorId(
  rawVisitorId: string | null | undefined,
): string | null {
  const value = rawVisitorId?.trim();
  if (!value || value.length < 8 || value.length > 200) return null;
  const salt =
    process.env.ANALYTICS_VISITOR_SALT?.trim() ||
    process.env.LEAD_IP_HASH_SALT?.trim() ||
    "atlas-analytics-v1";
  return createHash("sha256").update(`visitor:${salt}:${value}`).digest("hex");
}

/** Normalize opaque session ids (keep as opaque tokens, capped). */
export function normalizeSessionId(
  raw: string | null | undefined,
): string | null {
  const value = raw?.trim();
  if (!value || value.length < 8 || value.length > 128) return null;
  if (!/^[a-zA-Z0-9_-]+$/.test(value)) return null;
  return value;
}

export function newClientVisitorId(): string {
  return randomUUID();
}

export function newClientSessionId(): string {
  return randomUUID().replace(/-/g, "");
}
