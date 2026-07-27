/**
 * Atlas AI website generation contracts (Sprint 20.0A).
 * Server-only providers — never import OpenAI clients into client bundles.
 */

export type AiProviderId = "mock" | "openai";

/** Optional questionnaire enrichment from Sprint 20.0B. */
export type GenerateWebsiteQuestionnaire = {
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
};

/** Input for full-site draft generation. */
export type GenerateWebsiteInput = {
  /** Atlas project id — ownership verified by the API route. */
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

/**
 * Realistic website draft shaped for future editor mapping
 * (BusinessProject field names).
 */
export type GeneratedWebsiteDraft = {
  businessName: string;
  businessType: string;
  description: string;
  /** Short label above the hero headline. */
  heroEyebrow: string;
  heroHeadline: string;
  heroSubheadline: string;
  primaryCta: string;
  /** Secondary hero CTA (e.g. Learn more). */
  secondaryCta: string;
  aboutTitle: string;
  aboutBody: string;
  services: GeneratedService[];
  contact: GeneratedContact;
  seo: GeneratedSeo;
};

export type GenerateWebsiteSuccess = {
  ok: true;
  provider: AiProviderId;
  draft: GeneratedWebsiteDraft;
  /** Wall-clock ms for observability (never secrets). */
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
}
