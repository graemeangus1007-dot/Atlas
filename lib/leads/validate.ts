import { sanitizeReferrer } from "@/lib/analytics/sanitize";
import { hashVisitorId, normalizeSessionId } from "@/lib/analytics/hash";
import { checkDomainRateLimit } from "@/lib/domains/rate-limit";
import {
  isValidEmail,
  normalizeEmail,
  sanitizePlainText,
} from "@/lib/leads/sanitize";

export const LEAD_SUBMIT_MAX_BODY_BYTES = 16_384; // 16 KiB
export const LEAD_SUBMIT_RATE_LIMIT = 8;
export const LEAD_SUBMIT_RATE_WINDOW_MS = 60_000;

export type LeadSubmitInput = {
  name?: unknown;
  email?: unknown;
  phone?: unknown;
  company?: unknown;
  message?: unknown;
  /** Reserved honeypot / future CAPTCHA fields — ignored if present. */
  website?: unknown;
  captchaToken?: unknown;
  /** Analytics attribution (optional). */
  sessionId?: unknown;
  visitorId?: unknown;
  landingPage?: unknown;
  referrer?: unknown;
  utmSource?: unknown;
  utmMedium?: unknown;
  utmCampaign?: unknown;
};

export type LeadAttribution = {
  sessionId: string | null;
  visitorIdHash: string | null;
  landingPage: string | null;
  referrer: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
};

export type LeadSubmitValidated = {
  name: string;
  email: string;
  phone: string | null;
  company: string | null;
  message: string;
  attribution: LeadAttribution;
};

export type LeadSubmitValidationError = {
  ok: false;
  status: 400;
  error: string;
  fields?: Record<string, string>;
};

export type LeadSubmitValidationSuccess = {
  ok: true;
  data: LeadSubmitValidated;
};

/**
 * Validate + sanitize a public contact form payload.
 * Rejects honeypot fills silently as spam-shaped 400.
 */
export function validateLeadSubmission(
  input: LeadSubmitInput,
): LeadSubmitValidationSuccess | LeadSubmitValidationError {
  // Honeypot — bots fill hidden "website" fields.
  if (typeof input.website === "string" && input.website.trim()) {
    return { ok: false, status: 400, error: "Invalid submission." };
  }

  const name = sanitizePlainText(input.name, { maxLength: 200 });
  const emailRaw = sanitizePlainText(input.email, { maxLength: 320 });
  const email = normalizeEmail(emailRaw);
  const phone = sanitizePlainText(input.phone, { maxLength: 40 }) || null;
  const company = sanitizePlainText(input.company, { maxLength: 200 }) || null;
  const message = sanitizePlainText(input.message, {
    maxLength: 5000,
    allowNewlines: true,
  });

  const fields: Record<string, string> = {};
  if (!name) fields.name = "Name is required.";
  if (!email) fields.email = "Email is required.";
  else if (!isValidEmail(email)) fields.email = "Enter a valid email address.";
  if (!message) fields.message = "Message is required.";

  if (Object.keys(fields).length > 0) {
    return {
      ok: false,
      status: 400,
      error: "Please fix the highlighted fields.",
      fields,
    };
  }

  const landingRaw = sanitizePlainText(input.landingPage, {
    maxLength: 500,
    trimEnds: true,
  });
  const landingPage =
    landingRaw && !/^[a-z][a-z0-9+.-]*:/i.test(landingRaw)
      ? landingRaw.startsWith("/")
        ? landingRaw
        : `/${landingRaw}`
      : null;

  const attribution: LeadAttribution = {
    sessionId: normalizeSessionId(
      typeof input.sessionId === "string" ? input.sessionId : "",
    ),
    visitorIdHash: hashVisitorId(
      typeof input.visitorId === "string" ? input.visitorId : "",
    ),
    landingPage,
    referrer: sanitizeReferrer(input.referrer) || null,
    utmSource:
      sanitizePlainText(input.utmSource, { maxLength: 120, trimEnds: true })
        .toLowerCase()
        .slice(0, 120) || null,
    utmMedium:
      sanitizePlainText(input.utmMedium, { maxLength: 120, trimEnds: true })
        .toLowerCase()
        .slice(0, 120) || null,
    utmCampaign:
      sanitizePlainText(input.utmCampaign, { maxLength: 200, trimEnds: true })
        .toLowerCase()
        .slice(0, 200) || null,
  };

  return {
    ok: true,
    data: { name, email, phone, company, message, attribution },
  };
}

export function checkLeadSubmitRateLimit(
  key: string,
  options?: { store?: Parameters<typeof checkDomainRateLimit>[1]["store"] },
) {
  return checkDomainRateLimit(key, {
    limit: LEAD_SUBMIT_RATE_LIMIT,
    windowMs: LEAD_SUBMIT_RATE_WINDOW_MS,
    store: options?.store,
  });
}

/** Public Atlas origin used by published static sites for form POST. */
export { getPublicAtlasOrigin } from "@/lib/app-url";
