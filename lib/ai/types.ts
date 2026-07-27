/**
 * Atlas AI website generation contracts (Sprint 20.0A / 20.1).
 * Server-only providers — never import OpenAI clients into client bundles.
 */

import type { AiLayoutPreset } from "@/lib/ai/layout-presets";
import type { ContrastWarning } from "@/lib/ai/contrast";
import type { AiMediaPlaceholder } from "@/lib/ai/media-placeholders";
import type { AiOptionalSectionId } from "@/lib/ai/optional-sections";

export type AiProviderId = "mock" | "openai";

/** Optional questionnaire enrichment from Sprint 20.0B / 20.1. */
export type GenerateWebsiteQuestionnaire = {
  businessName?: string;
  businessType?: string;
  description?: string;
  yearsInBusiness?: string;
  primaryServices?: string[];
  secondaryServices?: string[];
  targetCustomer?: string;
  serviceArea?: string;
  tone?: string;
  primaryColor?: string;
  accentColor?: string;
  phone?: string;
  email?: string;
  address?: string;
  website?: string;
  facebook?: string;
  instagram?: string;
  /** Optional page sections selected in the questionnaire. */
  optionalSections?: Partial<Record<AiOptionalSectionId, boolean>>;
};

/** Input for full-site draft generation. */
export type GenerateWebsiteInput = {
  projectId: string;
  businessName: string;
  businessType: string;
  description: string;
  goals?: string[];
  questionnaire?: GenerateWebsiteQuestionnaire;
};

export type GeneratedService = {
  title: string;
  description: string;
};

export type GeneratedContact = {
  title: string;
  description: string;
  phone: string;
  email: string;
  location: string;
  buttonText: string;
};

export type GeneratedSeo = {
  siteTitle: string;
  metaDescription: string;
  socialTitle: string;
  socialDescription: string;
  robotsIndex: boolean;
};

export type GeneratedTestimonial = {
  quote: string;
  author: string;
  role: string;
};

export type GeneratedFaqItem = {
  question: string;
  answer: string;
};

export type GeneratedTeamMember = {
  name: string;
  role: string;
  bio: string;
};

export type GeneratedPricingPlan = {
  name: string;
  price: string;
  description: string;
  features: string[];
};

export type GeneratedOptionalSections = {
  testimonials?: GeneratedTestimonial[];
  faq?: GeneratedFaqItem[];
  team?: GeneratedTeamMember[];
  pricing?: GeneratedPricingPlan[];
  bookingCta?: { title: string; body: string; buttonText: string };
  newsletter?: { title: string; body: string; buttonText: string };
};

export type GeneratedBrand = {
  primaryColor: string;
  accentColor: string;
  secondaryColor: string;
  backgroundColor: string;
  headingFont: string;
  bodyFont: string;
  buttonStyle: string;
  layoutPresetId: string;
};

/**
 * Realistic website draft shaped for editor mapping.
 */
export type GeneratedWebsiteDraft = {
  businessName: string;
  businessType: string;
  description: string;
  heroEyebrow: string;
  heroHeadline: string;
  heroSubheadline: string;
  primaryCta: string;
  secondaryCta: string;
  aboutTitle: string;
  aboutBody: string;
  services: GeneratedService[];
  contact: GeneratedContact;
  seo: GeneratedSeo;
  /** Selected optional section ids. */
  enabledSections: AiOptionalSectionId[];
  optionalSections: GeneratedOptionalSections;
  layoutPreset: AiLayoutPreset;
  brand: GeneratedBrand;
  mediaPlaceholders: {
    hero: AiMediaPlaceholder;
    gallery: AiMediaPlaceholder[];
  };
  contrastWarnings: ContrastWarning[];
};

export type AiRegenerateSection = "hero" | "about" | "services";

export type GenerateWebsiteSuccess = {
  ok: true;
  provider: AiProviderId;
  draft: GeneratedWebsiteDraft;
  durationMs: number;
};

export type GenerateWebsiteFailure = {
  ok: false;
  provider: AiProviderId;
  code: AiErrorCode;
  message: string;
};

export type GenerateWebsiteResult =
  | GenerateWebsiteSuccess
  | GenerateWebsiteFailure;

export type RegenerateSectionSuccess = {
  ok: true;
  provider: AiProviderId;
  section: AiRegenerateSection;
  /** Partial patch for the requested section only. */
  patch: Partial<GeneratedWebsiteDraft>;
  durationMs: number;
};

export type RegenerateSectionResult =
  | RegenerateSectionSuccess
  | GenerateWebsiteFailure;

export type AiErrorCode =
  | "unauthorized"
  | "forbidden"
  | "bad_request"
  | "rate_limited"
  | "not_configured"
  | "not_implemented"
  | "provider_error"
  | "invalid_response";

export interface AiProvider {
  readonly id: AiProviderId;

  generateWebsite(
    input: GenerateWebsiteInput,
  ): Promise<GenerateWebsiteResult>;

  regenerateSection?(
    input: GenerateWebsiteInput & {
      section: AiRegenerateSection;
      currentDraft: GeneratedWebsiteDraft;
      /** Bump to force a different mock variation. */
      variation?: number;
    },
  ): Promise<RegenerateSectionResult>;
}
