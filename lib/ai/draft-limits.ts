/** Maximum field lengths for AI draft → project mapping (Sprint 20.0C). */

export const AI_DRAFT_LIMITS = {
  businessName: 120,
  businessType: 80,
  description: 2000,
  heroEyebrow: 80,
  heroHeadline: 160,
  heroSubheadline: 320,
  primaryCta: 60,
  secondaryCta: 60,
  aboutTitle: 120,
  aboutBody: 4000,
  serviceTitle: 80,
  serviceDescription: 500,
  contactTitle: 120,
  contactDescription: 1000,
  contactPhone: 40,
  contactEmail: 320,
  contactLocation: 200,
  contactButtonText: 60,
  seoTitle: 60,
  seoDescription: 160,
  socialTitle: 70,
  socialDescription: 200,
  socialUrl: 500,
  idempotencyKey: 128,
} as const;

export const AI_DRAFT_MIN_SERVICES = 1;
export const AI_DRAFT_MAX_SERVICES = 6;
