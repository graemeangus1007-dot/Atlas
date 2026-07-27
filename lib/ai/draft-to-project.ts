/**
 * Strongly typed AI draft → BusinessProject mapper (Sprint 20.0C).
 */

import { DEFAULT_BRANDING } from "@/data/design-options";
import { DEFAULT_MEDIA } from "@/data/media";
import type { AiQuestionnaireAnswers } from "@/components/ai/ai-types";
import { designFromTone } from "@/lib/ai/tone-design";
import { AI_DRAFT_LIMITS } from "@/lib/ai/draft-limits";
import { validateGeneratedWebsiteDraft } from "@/lib/ai/validate-draft";
import type {
  GenerateWebsiteQuestionnaire,
  GeneratedWebsiteDraft,
} from "@/lib/ai/types";
import { defaultOpeningHours } from "@/lib/seo/defaults";
import type { ProjectSeo } from "@/lib/seo/types";
import { SEO_DESCRIPTION_MAX, SEO_TITLE_MAX } from "@/lib/seo/types";
import { coalesceNonEmpty } from "@/lib/ai/resolve-generate-input";
import "@/lib/templates";
import { getTemplate } from "@/lib/templates";
import { sanitizePlainText } from "@/lib/leads/sanitize";
import {
  BUSINESS_TYPES,
  type BusinessType,
  type WebsiteGoal,
} from "@/types/business";
import type { BusinessProject } from "@/types/business-project";
import { DEFAULT_PROJECT_PAGES } from "@/types/business-project";

const HEX_COLOR_RE = /^#[0-9A-Fa-f]{6}$/;

const INDUSTRY_ALIASES: Array<{ match: RegExp; type: BusinessType }> = [
  { match: /\b(coffee|cafe|café|bakery|espresso)\b/i, type: "Coffee Shop" },
  { match: /\b(restaurant|diner|bistro|eatery)\b/i, type: "Restaurant" },
  { match: /\b(retail|boutique|shop|store)\b/i, type: "Retail Store" },
  { match: /\b(salon|spa|barber|beauty)\b/i, type: "Salon" },
  { match: /\b(gym|fitness|yoga|crossfit)\b/i, type: "Gym" },
  {
    match: /\b(contractor|plumber|electrician|hvac|builder)\b/i,
    type: "Contractor",
  },
  { match: /\b(real\s*estate|realtor|property)\b/i, type: "Real Estate" },
];

export type DraftToProjectInput = {
  draft: unknown;
  /** Optional questionnaire enrichment (colors, tone, socials, goals context). */
  questionnaire?: Partial<AiQuestionnaireAnswers> | GenerateWebsiteQuestionnaire | null;
  /** Opaque key stored on content for audit / duplicate detection. */
  idempotencyKey?: string;
  /** Context project only — never overwritten by this mapper. */
  sourceProjectId?: string | null;
};

export type AiProjectSocialLinks = {
  website: string;
  facebook: string;
  instagram: string;
};

export type AiProjectMeta = {
  idempotencyKey?: string;
  sourceProjectId?: string | null;
  tone?: string;
  socialLinks: AiProjectSocialLinks;
};

function normalizeHexColor(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return HEX_COLOR_RE.test(trimmed) ? trimmed.toLowerCase() : fallback;
}

/** Map free-text industry to Atlas BusinessType union. */
export function mapIndustryToBusinessType(industry: string): BusinessType {
  const trimmed = industry.trim();
  if (!trimmed) return "Other";
  const exact = BUSINESS_TYPES.find(
    (type) => type.toLowerCase() === trimmed.toLowerCase(),
  );
  if (exact) return exact;
  for (const alias of INDUSTRY_ALIASES) {
    if (alias.match.test(trimmed)) return alias.type;
  }
  return "Other";
}

function defaultGoals(): WebsiteGoal[] {
  return ["Get more customers", "Collect leads"];
}

function parseAddressParts(address: string): {
  streetAddress: string;
  addressLocality: string;
  addressRegion: string;
  postalCode: string;
} {
  const parts = address
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length >= 3) {
    const regionPostal = parts[2] ?? "";
    const postalMatch = regionPostal.match(/\b(\d{5}(?:-\d{4})?)\b/);
    return {
      streetAddress: parts[0] ?? "",
      addressLocality: parts[1] ?? "",
      addressRegion: regionPostal.replace(/\b\d{5}(?:-\d{4})?\b/, "").trim(),
      postalCode: postalMatch?.[1] ?? "",
    };
  }
  if (parts.length === 2) {
    return {
      streetAddress: parts[0] ?? "",
      addressLocality: parts[1] ?? "",
      addressRegion: "",
      postalCode: "",
    };
  }
  return {
    streetAddress: "",
    addressLocality: address,
    addressRegion: "",
    postalCode: "",
  };
}

function readQuestionnaireField(
  questionnaire: DraftToProjectInput["questionnaire"],
  key: string,
): string {
  if (!questionnaire || typeof questionnaire !== "object") return "";
  const value = (questionnaire as Record<string, unknown>)[key];
  return typeof value === "string" ? value : "";
}

function secondaryCtaFromTone(tone: string): string {
  switch (tone) {
    case "luxury":
      return "Explore our work";
    case "friendly":
      return "Meet the team";
    case "bold":
      return "See how it works";
    case "modern":
      return "View services";
    case "professional":
    default:
      return "Learn more";
  }
}

/** Build LocalBusiness + technical SEO from a validated draft + contact. */
export function mapDraftToProjectSeo(
  draft: GeneratedWebsiteDraft,
  options?: { address?: string },
): ProjectSeo {
  const address = sanitizePlainText(options?.address ?? draft.contact.location, {
    maxLength: AI_DRAFT_LIMITS.contactLocation,
  });
  const parts = parseAddressParts(address);
  const siteTitle = draft.seo.siteTitle.slice(0, SEO_TITLE_MAX);
  const metaDescription = draft.seo.metaDescription.slice(0, SEO_DESCRIPTION_MAX);

  return {
    siteTitle,
    metaDescription,
    canonicalUrl: "",
    socialTitle: draft.seo.socialTitle.slice(0, 70),
    socialDescription: draft.seo.socialDescription.slice(0, 200),
    socialImageAssetId: null,
    robotsIndex: draft.seo.robotsIndex,
    faviconAssetId: null,
    localBusiness: {
      name: draft.businessName,
      phone: draft.contact.phone,
      email: draft.contact.email,
      streetAddress: parts.streetAddress,
      addressLocality: parts.addressLocality,
      addressRegion: parts.addressRegion,
      postalCode: parts.postalCode,
      addressCountry: "US",
      openingHours: defaultOpeningHours(),
      logoAssetId: null,
    },
  };
}

export type MappedAiProject = {
  project: BusinessProject;
  meta: AiProjectMeta;
};

/**
 * Convert a validated AI draft into a full BusinessProject with safe defaults.
 * Does not write to Supabase — creation is handled by the create-project API.
 */
export function mapDraftToBusinessProject(
  input: DraftToProjectInput,
): MappedAiProject {
  const draft = validateGeneratedWebsiteDraft(input.draft);
  const q = input.questionnaire;
  const toneRaw = readQuestionnaireField(q, "tone");
  const design = designFromTone(toneRaw);
  const template = getTemplate(design.templateId);

  const primaryFromQ = normalizeHexColor(
    readQuestionnaireField(q, "primaryColor"),
    "",
  );
  const accentFromQ = normalizeHexColor(
    readQuestionnaireField(q, "accentColor"),
    "",
  );

  const primaryColor =
    primaryFromQ ||
    template.colorDefaults.primaryColor ||
    DEFAULT_BRANDING.primaryColor;
  const accentColor =
    accentFromQ ||
    primaryFromQ ||
    template.colorDefaults.accentColor ||
    DEFAULT_BRANDING.accentColor;

  // Questionnaire / explicit fields always beat draft placeholders.
  const businessName = sanitizePlainText(
    coalesceNonEmpty(
      readQuestionnaireField(q, "businessName"),
      draft.businessName,
    ),
    { maxLength: AI_DRAFT_LIMITS.businessName },
  );
  const industryOrType = coalesceNonEmpty(
    readQuestionnaireField(q, "industry"),
    readQuestionnaireField(q, "businessType"),
    draft.businessType,
  );
  const businessType = mapIndustryToBusinessType(industryOrType);
  const oneLiner = sanitizePlainText(
    coalesceNonEmpty(
      readQuestionnaireField(q, "oneSentenceDescription"),
      readQuestionnaireField(q, "description"),
      draft.description,
    ),
    { maxLength: AI_DRAFT_LIMITS.description, allowNewlines: true },
  );

  const addressHint = coalesceNonEmpty(
    readQuestionnaireField(q, "address"),
    draft.contact.location,
  );
  const contactPhone = coalesceNonEmpty(
    readQuestionnaireField(q, "phone"),
    draft.contact.phone,
  );
  const contactEmail = coalesceNonEmpty(
    readQuestionnaireField(q, "email"),
    draft.contact.email,
  );
  const contactLocation = coalesceNonEmpty(
    readQuestionnaireField(q, "address"),
    draft.contact.location,
  );

  const rewriteName = (value: string) =>
    draft.businessName &&
    businessName &&
    draft.businessName !== businessName &&
    value.includes(draft.businessName)
      ? value.split(draft.businessName).join(businessName)
      : value;

  const heroEyebrow = sanitizePlainText(
    rewriteName(
      draft.heroEyebrow ||
        businessName ||
        draft.businessName,
    ),
    { maxLength: AI_DRAFT_LIMITS.heroEyebrow },
  );
  const secondaryCta =
    draft.secondaryCta || secondaryCtaFromTone(design.tone);

  const socialLinks: AiProjectSocialLinks = {
    website: sanitizePlainText(readQuestionnaireField(q, "website"), {
      maxLength: AI_DRAFT_LIMITS.socialUrl,
    }),
    facebook: sanitizePlainText(readQuestionnaireField(q, "facebook"), {
      maxLength: AI_DRAFT_LIMITS.socialUrl,
    }),
    instagram: sanitizePlainText(readQuestionnaireField(q, "instagram"), {
      maxLength: AI_DRAFT_LIMITS.socialUrl,
    }),
  };

  const draftForSeo = {
    ...draft,
    businessName,
    businessType: industryOrType || draft.businessType,
    description: oneLiner || draft.description,
    contact: {
      ...draft.contact,
      phone: contactPhone,
      email: contactEmail,
      location: contactLocation,
    },
  };
  const seo = mapDraftToProjectSeo(draftForSeo, { address: addressHint });

  const project: BusinessProject = {
    businessName,
    businessType,
    description: sanitizePlainText(rewriteName(draft.aboutBody || oneLiner), {
      maxLength: AI_DRAFT_LIMITS.aboutBody,
      allowNewlines: true,
    }),
    goals: defaultGoals(),
    heroEyebrow,
    heroHeadline: sanitizePlainText(rewriteName(draft.heroHeadline), {
      maxLength: AI_DRAFT_LIMITS.heroHeadline,
    }),
    heroSubheadline: sanitizePlainText(rewriteName(draft.heroSubheadline), {
      maxLength: AI_DRAFT_LIMITS.heroSubheadline,
    }),
    primaryCta: draft.primaryCta,
    secondaryCta,
    aboutTitle: sanitizePlainText(rewriteName(draft.aboutTitle), {
      maxLength: AI_DRAFT_LIMITS.aboutTitle,
    }),
    services: draft.services.map((service) => ({
      title: service.title,
      description: service.description,
    })),
    contact: {
      title: draft.contact.title,
      description: sanitizePlainText(rewriteName(draft.contact.description), {
        maxLength: AI_DRAFT_LIMITS.contactDescription,
        allowNewlines: true,
      }),
      phone: contactPhone,
      email: contactEmail,
      location: contactLocation,
      formId: null,
      buttonText: draft.contact.buttonText,
      successMessage:
        "Thanks — we received your message and will get back to you soon.",
      showPhoneField: true,
      showCompanyField: false,
      formEnabled: true,
    },
    seo,
    templateId: design.templateId,
    pages: DEFAULT_PROJECT_PAGES.map((page) => ({ ...page })),
    primaryColor,
    secondaryColor:
      design.secondaryColor || template.colorDefaults.secondaryColor,
    accentColor,
    backgroundColor:
      design.backgroundColor || template.colorDefaults.backgroundColor,
    headingFont: design.headingFont,
    bodyFont: design.bodyFont,
    buttonStyle: design.buttonStyle,
    heroOverlay: design.heroOverlay,
    siteWidth: design.siteWidth,
    theme: design.theme,
    logo: null,
    mediaLibrary: [],
    heroImageId: DEFAULT_MEDIA.heroImageId,
    galleryImageIds: [...DEFAULT_MEDIA.galleryImageIds],
    status: "ready",
    publish: null,
  };

  return {
    project,
    meta: {
      idempotencyKey: input.idempotencyKey,
      sourceProjectId: input.sourceProjectId ?? null,
      tone: design.tone,
      socialLinks,
    },
  };
}
