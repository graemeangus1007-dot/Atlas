import { createHash } from "node:crypto";

/** Hash a client IP — never store raw addresses. */
export function hashIp(ip: string | null | undefined): string | null {
  const value = ip?.trim();
  if (!value) return null;
  const salt = process.env.LEAD_IP_HASH_SALT?.trim() || "atlas-leads-v1";
  return createHash("sha256").update(`${salt}:${value}`).digest("hex");
}

/** Best-effort client IP from common proxy headers. */
export function extractClientIp(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first.slice(0, 128);
  }
  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp.slice(0, 128);
  return null;
}
