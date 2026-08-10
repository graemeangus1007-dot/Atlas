/**
 * Per-owner allowlists / denylists for recommendation domains.
 */

import type {
  IntelligenceOwner,
  RecommendationDomain,
} from "@/lib/scope/types";

export const TASTE_ALLOWED_DOMAINS: readonly RecommendationDomain[] = [
  "spacing",
  "typography_hierarchy",
  "rhythm",
  "alignment",
  "restraint",
  "cta_proportion",
  "button_consistency",
  "visual_polish",
] as const;

export const TASTE_FORBIDDEN_DOMAINS: readonly RecommendationDomain[] = [
  "brand_colors",
  "palette",
  "fonts",
  "faq",
  "testimonials",
  "gallery",
  "motion",
  "section_order",
  "imagery",
  "business_strategy",
  "copy_strategy",
  "pricing",
  "offers",
  "trust",
  "cta",
  "offer",
  "objections",
  "proof",
  "friction",
  "urgency",
  "contact_flow",
  "lead_generation",
  "hero_composition",
  "layout",
  "section_sequencing",
] as const;

export const CREATIVE_DIRECTOR_ALLOWED_DOMAINS: readonly RecommendationDomain[] =
  [
    "visual_direction",
    "section_sequencing",
    "hierarchy",
    "design_language",
    "narrative",
    "layout",
    "rhythm",
    "imagery",
  ] as const;

export const CREATIVE_DIRECTOR_FORBIDDEN_DOMAINS: readonly RecommendationDomain[] =
  [
    "brand_colors",
    "palette",
    "fonts",
    "cta",
    "offer",
    "objections",
    "friction",
    "urgency",
    "contact_flow",
    "lead_generation",
  ] as const;

export const BENCHMARK_ALLOWED_DOMAINS: readonly RecommendationDomain[] = [
  "benchmark_comparison",
] as const;

export const VISUAL_COMPOSITION_ALLOWED_DOMAINS: readonly RecommendationDomain[] =
  ["hero_composition", "imagery", "alignment", "restraint"] as const;

export const TRANSFORMATION_ALLOWED_DOMAINS: readonly RecommendationDomain[] =
  ["transformation_execution"] as const;

export const CONVERSION_DIRECTOR_ALLOWED_DOMAINS: readonly RecommendationDomain[] =
  [
    "trust",
    "cta",
    "offer",
    "objections",
    "proof",
    "friction",
    "urgency",
    "contact_flow",
    "lead_generation",
  ] as const;

export const CONVERSION_DIRECTOR_FORBIDDEN_DOMAINS: readonly RecommendationDomain[] =
  [
    "spacing",
    "typography_hierarchy",
    "rhythm",
    "alignment",
    "restraint",
    "visual_polish",
    "hero_composition",
    "brand_colors",
    "palette",
    "fonts",
    "motion",
    "layout",
    "section_order",
  ] as const;

const ALLOWLIST: Record<IntelligenceOwner, readonly RecommendationDomain[]> = {
  taste: TASTE_ALLOWED_DOMAINS,
  creative_director: CREATIVE_DIRECTOR_ALLOWED_DOMAINS,
  benchmark: BENCHMARK_ALLOWED_DOMAINS,
  visual_composition: VISUAL_COMPOSITION_ALLOWED_DOMAINS,
  transformation: TRANSFORMATION_ALLOWED_DOMAINS,
  conversion_director: CONVERSION_DIRECTOR_ALLOWED_DOMAINS,
};

const DENYLIST: Partial<
  Record<IntelligenceOwner, readonly RecommendationDomain[]>
> = {
  taste: TASTE_FORBIDDEN_DOMAINS,
  creative_director: CREATIVE_DIRECTOR_FORBIDDEN_DOMAINS,
  conversion_director: CONVERSION_DIRECTOR_FORBIDDEN_DOMAINS,
};

export function ownerAllowsDomain(
  owner: IntelligenceOwner,
  domain: RecommendationDomain,
): boolean {
  const denied = DENYLIST[owner];
  if (denied?.includes(domain)) return false;
  return ALLOWLIST[owner].includes(domain);
}

export function domainsForOwner(
  owner: IntelligenceOwner,
): readonly RecommendationDomain[] {
  return ALLOWLIST[owner];
}
