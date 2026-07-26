import { isValidEmail, sanitizePlainText } from "@/lib/leads/sanitize";
import {
  SEO_DESCRIPTION_MAX,
  SEO_DESCRIPTION_MIN,
  SEO_TITLE_MAX,
  type ProjectSeo,
  type SeoWarning,
} from "@/lib/seo/types";

const ABSOLUTE_HTTP_URL =
  /^https?:\/\/[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+(?:[/:?#][^\s]*)?$/i;

export function isValidAbsoluteHttpUrl(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 2048) return false;
  if (!ABSOLUTE_HTTP_URL.test(trimmed)) return false;
  try {
    const url = new URL(trimmed);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function sanitizeSeoText(
  value: unknown,
  maxLength: number,
  options?: { trimEnds?: boolean },
): string {
  return sanitizePlainText(value, {
    maxLength,
    allowNewlines: false,
    trimEnds: options?.trimEnds,
  });
}

/**
 * Validate SEO fields and return non-blocking warnings for the editor.
 */
export function validateProjectSeo(
  seo: ProjectSeo,
  options?: { knownCanonicals?: string[] },
): SeoWarning[] {
  const warnings: SeoWarning[] = [];
  const title = seo.siteTitle.trim();
  const description = seo.metaDescription.trim();

  if (!title) {
    warnings.push({
      code: "title_empty",
      field: "siteTitle",
      message: "Add a site title for search results.",
    });
  } else if (title.length > SEO_TITLE_MAX) {
    warnings.push({
      code: "title_too_long",
      field: "siteTitle",
      message: `Site title is ${title.length} characters (aim for ${SEO_TITLE_MAX} or less).`,
    });
  }

  if (!description) {
    warnings.push({
      code: "description_empty",
      field: "metaDescription",
      message: "Add a meta description for search snippets.",
    });
  } else if (description.length < SEO_DESCRIPTION_MIN) {
    warnings.push({
      code: "description_too_short",
      field: "metaDescription",
      message: `Meta description is short (${description.length} chars). Aim for ${SEO_DESCRIPTION_MIN}–${SEO_DESCRIPTION_MAX}.`,
    });
  } else if (description.length > SEO_DESCRIPTION_MAX) {
    warnings.push({
      code: "description_too_long",
      field: "metaDescription",
      message: `Meta description is ${description.length} characters (aim for ${SEO_DESCRIPTION_MAX} or less).`,
    });
  }

  if (!seo.socialImageAssetId) {
    warnings.push({
      code: "missing_social_image",
      field: "socialImageAssetId",
      message: "Add a social share image for Facebook, LinkedIn, and X.",
    });
  }

  const canonical = seo.canonicalUrl.trim();
  if (canonical) {
    if (!isValidAbsoluteHttpUrl(canonical)) {
      warnings.push({
        code: "invalid_canonical",
        field: "canonicalUrl",
        message: "Canonical URL must be a valid http(s) URL.",
      });
    } else {
      const normalized = canonical.replace(/\/+$/, "").toLowerCase();
      const dupes = (options?.knownCanonicals ?? [])
        .map((u) => u.replace(/\/+$/, "").toLowerCase())
        .filter((u) => u === normalized);
      if (dupes.length > 1) {
        warnings.push({
          code: "duplicate_canonical",
          field: "canonicalUrl",
          message: "This canonical URL is used more than once.",
        });
      }
    }
  }

  const email = seo.localBusiness.email.trim();
  if (email && !isValidEmail(email)) {
    warnings.push({
      code: "invalid_url",
      field: "localBusiness.email",
      message: "Business email looks invalid.",
    });
  }

  return warnings;
}

export type SanitizeProjectSeoOptions = {
  /**
   * Trim leading/trailing whitespace. Default true for publish/blur.
   * Use false while typing so Space works in controlled inputs.
   */
  trimEnds?: boolean;
};

/** Sanitize a SEO patch before writing into project state. */
export function sanitizeProjectSeo(
  seo: ProjectSeo,
  options: SanitizeProjectSeoOptions = {},
): ProjectSeo {
  const trimEnds = options.trimEnds !== false;
  const text = (value: unknown, maxLength: number) =>
    sanitizeSeoText(value, maxLength, { trimEnds });

  return {
    siteTitle: text(seo.siteTitle, 120),
    metaDescription: text(seo.metaDescription, 320),
    canonicalUrl: text(seo.canonicalUrl, 2048),
    socialTitle: text(seo.socialTitle, 120),
    socialDescription: text(seo.socialDescription, 320),
    socialImageAssetId: seo.socialImageAssetId ?? null,
    robotsIndex: seo.robotsIndex !== false,
    faviconAssetId: seo.faviconAssetId ?? null,
    localBusiness: {
      name: text(seo.localBusiness.name, 200),
      phone: text(seo.localBusiness.phone, 40),
      email: text(seo.localBusiness.email, 320).toLowerCase(),
      streetAddress: text(seo.localBusiness.streetAddress, 200),
      addressLocality: text(seo.localBusiness.addressLocality, 120),
      addressRegion: text(seo.localBusiness.addressRegion, 120),
      postalCode: text(seo.localBusiness.postalCode, 32),
      addressCountry: text(seo.localBusiness.addressCountry, 80),
      openingHours: (seo.localBusiness.openingHours ?? []).map((row) => ({
        day: text(row.day, 20),
        opens: text(row.opens, 8),
        closes: text(row.closes, 8),
        closed: Boolean(row.closed),
      })),
      logoAssetId: seo.localBusiness.logoAssetId ?? null,
    },
  };
}
