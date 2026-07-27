/**
 * Prompt builders for website draft generation (Sprint 21.0A).
 * System / developer / user roles — never include secrets, owner IDs, or billing.
 */

import { AI_DRAFT_LIMITS, AI_DRAFT_MAX_SERVICES, AI_DRAFT_MIN_SERVICES } from "@/lib/ai/draft-limits";
import type {
  GenerateWebsiteInput,
  GenerateWebsiteQuestionnaire,
} from "@/lib/ai/types";

/** Atlas expert persona — system role. */
export function buildWebsiteSystemPrompt(): string {
  return [
    "You are Atlas, an expert web designer and conversion-focused copywriter for small businesses.",
    "You create clear, trustworthy homepage copy that helps local and service businesses win customers.",
    "Write in natural English. Avoid lorem ipsum, filler, and generic AI clichés.",
    "Match the requested brand tone. Prefer concrete, benefit-led language over buzzwords.",
  ].join(" ");
}

/**
 * Schema + formatting rules — developer role.
 * Instructs the model to return JSON only (no markdown).
 */
export function buildWebsiteDeveloperPrompt(): string {
  return [
    "Return ONLY a single JSON object. Do not wrap it in markdown fences. Do not include commentary.",
    "Required top-level string fields:",
    "businessName, businessType, description, heroEyebrow, heroHeadline, heroSubheadline,",
    "primaryCta, secondaryCta, aboutTitle, aboutBody.",
    `services: array of ${AI_DRAFT_MIN_SERVICES}–${AI_DRAFT_MAX_SERVICES} objects with title and description.`,
    "contact: object with title, description, phone, email, location, buttonText.",
    "seo: object with siteTitle, metaDescription, socialTitle, socialDescription, robotsIndex (boolean).",
    "Optional: enabledSections (string array), optionalSections (object with testimonials/faq/team/pricing/bookingCta/newsletter when enabled).",
    "Length limits (characters):",
    `businessName≤${AI_DRAFT_LIMITS.businessName}, businessType≤${AI_DRAFT_LIMITS.businessType},`,
    `description≤${AI_DRAFT_LIMITS.description}, heroHeadline≤${AI_DRAFT_LIMITS.heroHeadline},`,
    `heroSubheadline≤${AI_DRAFT_LIMITS.heroSubheadline}, aboutBody≤${AI_DRAFT_LIMITS.aboutBody},`,
    `seo.siteTitle≤${AI_DRAFT_LIMITS.seoTitle}, seo.metaDescription≤${AI_DRAFT_LIMITS.seoDescription}.`,
    "SEO: siteTitle and metaDescription must be unique, readable, and keyword-relevant without stuffing.",
    "Tone: stay consistent with the questionnaire tone across hero, about, services, and CTAs.",
    "Use contact phone/email/address from the questionnaire when provided; otherwise invent realistic placeholders.",
    "Do not include project IDs, owner IDs, billing data, API keys, or internal Atlas fields.",
  ].join(" ");
}

/**
 * Safe questionnaire payload for the model — strips internal identifiers.
 */
export function buildSafeGenerationPayload(
  input: GenerateWebsiteInput,
): Record<string, unknown> {
  const q = input.questionnaire;
  const payload: Record<string, unknown> = {
    businessName: input.businessName.trim() || undefined,
    businessType: input.businessType.trim() || undefined,
    description: input.description.trim() || undefined,
    goals:
      input.goals && input.goals.length > 0 ? input.goals.slice(0, 12) : undefined,
  };

  if (q) {
    const safeQ: GenerateWebsiteQuestionnaire = {
      businessName: q.businessName,
      businessType: q.businessType,
      description: q.description,
      yearsInBusiness: q.yearsInBusiness,
      primaryServices: q.primaryServices?.slice(0, 12),
      secondaryServices: q.secondaryServices?.slice(0, 12),
      targetCustomer: q.targetCustomer,
      serviceArea: q.serviceArea,
      tone: q.tone,
      primaryColor: q.primaryColor,
      accentColor: q.accentColor,
      phone: q.phone,
      email: q.email,
      address: q.address,
      website: q.website,
      facebook: q.facebook,
      instagram: q.instagram,
      optionalSections: q.optionalSections,
    };
    // Drop undefined keys so we do not send empty noise.
    const cleaned = Object.fromEntries(
      Object.entries(safeQ).filter(([, value]) => value !== undefined),
    );
    if (Object.keys(cleaned).length > 0) {
      payload.questionnaire = cleaned;
    }
  }

  return Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== undefined),
  );
}

/** User role — built only from questionnaire / generation fields. */
export function buildWebsiteUserPrompt(input: GenerateWebsiteInput): string {
  const payload = buildSafeGenerationPayload(input);
  return [
    "Generate a complete Atlas website homepage draft for this business.",
    "Use the following JSON as the sole business brief (no other context exists):",
    JSON.stringify(payload),
  ].join("\n");
}

/** @deprecated Alias kept for older imports — prefer buildWebsiteDeveloperPrompt. */
export function buildWebsiteSchemaPrompt(): string {
  return buildWebsiteDeveloperPrompt();
}
