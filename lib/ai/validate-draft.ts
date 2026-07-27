/**
 * Validate + sanitize AI website drafts before project creation.
 */

import { AiError } from "@/lib/ai/errors";
import {
  AI_DRAFT_LIMITS,
  AI_DRAFT_MAX_SERVICES,
  AI_DRAFT_MIN_SERVICES,
} from "@/lib/ai/draft-limits";
import { layoutPresetFromTone } from "@/lib/ai/layout-presets";
import { buildMediaPlaceholders } from "@/lib/ai/media-placeholders";
import {
  AI_OPTIONAL_SECTION_IDS,
  enabledOptionalSections,
  normalizeOptionalSections,
  type AiOptionalSectionId,
} from "@/lib/ai/optional-sections";
import type {
  GeneratedContact,
  GeneratedOptionalSections,
  GeneratedSeo,
  GeneratedService,
  GeneratedWebsiteDraft,
} from "@/lib/ai/types";
import { isValidEmail, sanitizePlainText } from "@/lib/leads/sanitize";

function requireNonEmpty(
  value: unknown,
  field: string,
  maxLength: number,
  options?: { allowNewlines?: boolean },
): string {
  const cleaned = sanitizePlainText(value, {
    maxLength,
    allowNewlines: options?.allowNewlines,
  });
  if (!cleaned) {
    throw new AiError("bad_request", `Draft field "${field}" is required.`);
  }
  return cleaned;
}

function optionalText(
  value: unknown,
  maxLength: number,
  options?: { allowNewlines?: boolean },
): string {
  return sanitizePlainText(value, {
    maxLength,
    allowNewlines: options?.allowNewlines,
  });
}

function validateService(raw: unknown, index: number): GeneratedService {
  if (!raw || typeof raw !== "object") {
    throw new AiError(
      "bad_request",
      `Draft service at index ${index} is malformed.`,
    );
  }
  const row = raw as Record<string, unknown>;
  return {
    title: requireNonEmpty(
      row.title,
      `services[${index}].title`,
      AI_DRAFT_LIMITS.serviceTitle,
    ),
    description: requireNonEmpty(
      row.description,
      `services[${index}].description`,
      AI_DRAFT_LIMITS.serviceDescription,
      { allowNewlines: true },
    ),
  };
}

function validateContact(raw: unknown): GeneratedContact {
  if (!raw || typeof raw !== "object") {
    throw new AiError("bad_request", "Draft contact is required.");
  }
  const row = raw as Record<string, unknown>;
  const email = requireNonEmpty(
    row.email,
    "contact.email",
    AI_DRAFT_LIMITS.contactEmail,
  );
  if (!isValidEmail(email)) {
    throw new AiError("bad_request", "Draft contact.email is invalid.");
  }
  return {
    title: requireNonEmpty(
      row.title,
      "contact.title",
      AI_DRAFT_LIMITS.contactTitle,
    ),
    description: requireNonEmpty(
      row.description,
      "contact.description",
      AI_DRAFT_LIMITS.contactDescription,
      { allowNewlines: true },
    ),
    phone: requireNonEmpty(
      row.phone,
      "contact.phone",
      AI_DRAFT_LIMITS.contactPhone,
    ),
    email,
    location: requireNonEmpty(
      row.location,
      "contact.location",
      AI_DRAFT_LIMITS.contactLocation,
    ),
    buttonText: requireNonEmpty(
      row.buttonText,
      "contact.buttonText",
      AI_DRAFT_LIMITS.contactButtonText,
    ),
  };
}

function validateSeo(raw: unknown): GeneratedSeo {
  if (!raw || typeof raw !== "object") {
    throw new AiError("bad_request", "Draft seo is required.");
  }
  const row = raw as Record<string, unknown>;
  return {
    siteTitle: requireNonEmpty(
      row.siteTitle,
      "seo.siteTitle",
      AI_DRAFT_LIMITS.seoTitle,
    ),
    metaDescription: requireNonEmpty(
      row.metaDescription,
      "seo.metaDescription",
      AI_DRAFT_LIMITS.seoDescription,
    ),
    socialTitle: requireNonEmpty(
      row.socialTitle,
      "seo.socialTitle",
      AI_DRAFT_LIMITS.socialTitle,
    ),
    socialDescription: requireNonEmpty(
      row.socialDescription,
      "seo.socialDescription",
      AI_DRAFT_LIMITS.socialDescription,
    ),
    robotsIndex: typeof row.robotsIndex === "boolean" ? row.robotsIndex : true,
  };
}

/**
 * Reject incomplete / malformed drafts and return a sanitized copy.
 */
export function validateGeneratedWebsiteDraft(
  raw: unknown,
): GeneratedWebsiteDraft {
  if (!raw || typeof raw !== "object") {
    throw new AiError("bad_request", "Website draft is required.");
  }
  const row = raw as Record<string, unknown>;

  if (!Array.isArray(row.services)) {
    throw new AiError("bad_request", "Draft services must be an array.");
  }
  if (
    row.services.length < AI_DRAFT_MIN_SERVICES ||
    row.services.length > AI_DRAFT_MAX_SERVICES
  ) {
    throw new AiError(
      "bad_request",
      `Draft must include ${AI_DRAFT_MIN_SERVICES}–${AI_DRAFT_MAX_SERVICES} services.`,
    );
  }

  const services = row.services.map((service, index) =>
    validateService(service, index),
  );

  const heroEyebrow =
    optionalText(row.heroEyebrow, AI_DRAFT_LIMITS.heroEyebrow) ||
    requireNonEmpty(
      row.businessName,
      "businessName",
      AI_DRAFT_LIMITS.businessName,
    );

  const secondaryCta =
    optionalText(row.secondaryCta, AI_DRAFT_LIMITS.secondaryCta) ||
    "Learn more";

  const businessName = requireNonEmpty(
    row.businessName,
    "businessName",
    AI_DRAFT_LIMITS.businessName,
  );
  const businessType = requireNonEmpty(
    row.businessType,
    "businessType",
    AI_DRAFT_LIMITS.businessType,
  );

  const layoutPreset =
    row.layoutPreset && typeof row.layoutPreset === "object"
      ? layoutPresetFromTone(
          (row.layoutPreset as { id?: string }).id ||
            (row.brand as { layoutPresetId?: string } | undefined)
              ?.layoutPresetId,
        )
      : layoutPresetFromTone(
          (row.brand as { layoutPresetId?: string } | undefined)
            ?.layoutPresetId,
        );

  const brandRaw =
    row.brand && typeof row.brand === "object"
      ? (row.brand as Record<string, unknown>)
      : {};
  const brand = {
    primaryColor:
      optionalText(brandRaw.primaryColor, 7) || layoutPreset.secondaryColor,
    accentColor: optionalText(brandRaw.accentColor, 7) || "#3db8a8",
    secondaryColor:
      optionalText(brandRaw.secondaryColor, 7) || layoutPreset.secondaryColor,
    backgroundColor:
      optionalText(brandRaw.backgroundColor, 7) || layoutPreset.backgroundColor,
    headingFont:
      optionalText(brandRaw.headingFont, 40) || layoutPreset.headingFont,
    bodyFont: optionalText(brandRaw.bodyFont, 40) || layoutPreset.bodyFont,
    buttonStyle:
      optionalText(brandRaw.buttonStyle, 40) || layoutPreset.buttonStyle,
    layoutPresetId: layoutPreset.id,
  };

  const enabledSections: AiOptionalSectionId[] = Array.isArray(
    row.enabledSections,
  )
    ? AI_OPTIONAL_SECTION_IDS.filter((id) =>
        (row.enabledSections as unknown[]).includes(id),
      )
    : enabledOptionalSections(normalizeOptionalSections(null));

  const optionalState = Object.fromEntries(
    AI_OPTIONAL_SECTION_IDS.map((id) => [id, enabledSections.includes(id)]),
  ) as Record<AiOptionalSectionId, boolean>;

  const optionalSections =
    row.optionalSections && typeof row.optionalSections === "object"
      ? (row.optionalSections as GeneratedOptionalSections)
      : {};

  const placeholders = buildMediaPlaceholders({
    businessName,
    businessType,
  });
  const mediaPlaceholders =
    row.mediaPlaceholders && typeof row.mediaPlaceholders === "object"
      ? (row.mediaPlaceholders as GeneratedWebsiteDraft["mediaPlaceholders"])
      : {
          hero: placeholders.hero,
          gallery: optionalState.gallery ? placeholders.gallery : [],
        };

  const contrastWarnings = Array.isArray(row.contrastWarnings)
    ? (row.contrastWarnings as GeneratedWebsiteDraft["contrastWarnings"])
    : [];

  return {
    businessName,
    businessType,
    description: requireNonEmpty(
      row.description,
      "description",
      AI_DRAFT_LIMITS.description,
      { allowNewlines: true },
    ),
    heroEyebrow,
    heroHeadline: requireNonEmpty(
      row.heroHeadline,
      "heroHeadline",
      AI_DRAFT_LIMITS.heroHeadline,
    ),
    heroSubheadline: requireNonEmpty(
      row.heroSubheadline,
      "heroSubheadline",
      AI_DRAFT_LIMITS.heroSubheadline,
    ),
    primaryCta: requireNonEmpty(
      row.primaryCta,
      "primaryCta",
      AI_DRAFT_LIMITS.primaryCta,
    ),
    secondaryCta,
    aboutTitle: requireNonEmpty(
      row.aboutTitle,
      "aboutTitle",
      AI_DRAFT_LIMITS.aboutTitle,
    ),
    aboutBody: requireNonEmpty(
      row.aboutBody,
      "aboutBody",
      AI_DRAFT_LIMITS.aboutBody,
      { allowNewlines: true },
    ),
    services,
    contact: validateContact(row.contact),
    seo: validateSeo(row.seo),
    enabledSections,
    optionalSections,
    layoutPreset,
    brand,
    mediaPlaceholders,
    contrastWarnings,
  };
}

/** Idempotency keys: opaque client UUID / token, max length enforced. */
export function normalizeIdempotencyKey(value: unknown): string {
  if (typeof value !== "string") {
    throw new AiError("bad_request", "idempotencyKey is required.");
  }
  const key = value.trim();
  if (!key) {
    throw new AiError("bad_request", "idempotencyKey is required.");
  }
  if (key.length > AI_DRAFT_LIMITS.idempotencyKey) {
    throw new AiError("bad_request", "idempotencyKey is too long.");
  }
  if (!/^[A-Za-z0-9._:-]+$/.test(key)) {
    throw new AiError("bad_request", "idempotencyKey has invalid characters.");
  }
  return key;
}
