import { sanitizePlainText } from "@/lib/leads/sanitize";
import type {
  AnalyticsCollectEvent,
  AnalyticsCollectPayload,
  DeviceType,
} from "@/lib/analytics/types";
import { detectBrowser, detectDeviceType, detectOperatingSystem } from "@/lib/analytics/ua";
import { hashVisitorId, normalizeSessionId } from "@/lib/analytics/hash";

const MAX_BODY_BYTES = 8_192;

export const ANALYTICS_COLLECT_MAX_BODY_BYTES = MAX_BODY_BYTES;
export const ANALYTICS_COLLECT_RATE_LIMIT = 60;
export const ANALYTICS_COLLECT_RATE_WINDOW_MS = 60_000;

export type ValidatedAnalyticsCollect = {
  event: AnalyticsCollectEvent;
  projectId: string;
  sessionId: string;
  visitorIdHash: string;
  pagePath: string;
  referrer: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  language: string;
  screenSize: string;
  durationSeconds: number;
  deviceType: DeviceType;
  browser: string;
  operatingSystem: string;
};

function sanitizePath(value: unknown): string {
  const raw = sanitizePlainText(value, { maxLength: 500, trimEnds: true });
  if (!raw) return "/";
  // Block scheme-relative / javascript URLs; keep path-like values.
  if (/^[a-z][a-z0-9+.-]*:/i.test(raw)) return "/";
  if (raw.startsWith("//")) return "/";
  const path = raw.startsWith("/") ? raw : `/${raw}`;
  return path.slice(0, 500);
}

/** Strip tracking noise and keep host+path only for referrers. */
export function sanitizeReferrer(value: unknown): string {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw || raw.length > 2000) return "";
  if (/^(javascript|data|vbscript):/i.test(raw)) return "";
  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") return "";
    // Drop userinfo and fragments; keep origin + pathname (no query — PII risk).
    return `${url.origin}${url.pathname}`.slice(0, 1000);
  } catch {
    return "";
  }
}

function sanitizeUtm(value: unknown, max: number): string {
  return sanitizePlainText(value, { maxLength: max, trimEnds: true })
    .toLowerCase()
    .replace(/[^a-z0-9_\-.+]/g, "")
    .slice(0, max);
}

function sanitizeScreenSize(value: unknown): string {
  const raw = sanitizePlainText(value, { maxLength: 40, trimEnds: true });
  if (!/^\d{2,5}x\d{2,5}$/.test(raw)) return "";
  return raw;
}

function parseDuration(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(86_400, Math.floor(n));
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function validateAnalyticsCollect(
  body: AnalyticsCollectPayload,
  options: { userAgentHeader?: string | null } = {},
): { ok: true; data: ValidatedAnalyticsCollect } | { ok: false; error: string } {
  const eventRaw = typeof body.event === "string" ? body.event.trim() : "";
  if (
    eventRaw !== "pageview" &&
    eventRaw !== "heartbeat" &&
    eventRaw !== "unload"
  ) {
    return { ok: false, error: "Invalid event." };
  }

  const projectId =
    typeof body.projectId === "string" ? body.projectId.trim() : "";
  if (!UUID_RE.test(projectId)) {
    return { ok: false, error: "Invalid project." };
  }

  const sessionId = normalizeSessionId(
    typeof body.sessionId === "string" ? body.sessionId : "",
  );
  if (!sessionId) {
    return { ok: false, error: "Invalid session." };
  }

  const visitorIdHash = hashVisitorId(
    typeof body.visitorId === "string" ? body.visitorId : "",
  );
  if (!visitorIdHash) {
    return { ok: false, error: "Invalid visitor." };
  }

  const ua =
    (typeof body.userAgent === "string" ? body.userAgent : "") ||
    options.userAgentHeader ||
    "";
  const uaSafe = sanitizePlainText(ua, { maxLength: 400, trimEnds: true });

  return {
    ok: true,
    data: {
      event: eventRaw,
      projectId,
      sessionId,
      visitorIdHash,
      pagePath: sanitizePath(body.pagePath),
      referrer: sanitizeReferrer(body.referrer),
      utmSource: sanitizeUtm(body.utmSource, 120),
      utmMedium: sanitizeUtm(body.utmMedium, 120),
      utmCampaign: sanitizeUtm(body.utmCampaign, 200),
      language: sanitizePlainText(body.language, {
        maxLength: 40,
        trimEnds: true,
      }).slice(0, 40),
      screenSize: sanitizeScreenSize(body.screenSize),
      durationSeconds: parseDuration(body.durationSeconds),
      deviceType: detectDeviceType(uaSafe),
      browser: detectBrowser(uaSafe),
      operatingSystem: detectOperatingSystem(uaSafe),
    },
  };
}

/** Bounce: single-page session under 15s (or still marked bounced). */
export function computeBounced(input: {
  pageViewCount: number;
  durationSeconds: number;
}): boolean {
  if (input.pageViewCount > 1) return false;
  return input.durationSeconds < 15;
}
