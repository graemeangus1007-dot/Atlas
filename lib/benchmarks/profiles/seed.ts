/**
 * Seeded benchmark profiles — quality references only.
 * No layouts, copy, assets, or brand identities are encoded.
 */

import { profile } from "@/lib/benchmarks/profiles/helpers";
import type { BenchmarkProfile } from "@/lib/benchmarks/types";

/**
 * Premium Modern Service Business
 * Captures execution-quality characteristics associated with top-tier
 * digital service businesses (strong FI, restrained color, trust progression).
 * Does not encode any specific brand, layout, or wording.
 */
export const PREMIUM_MODERN_SERVICE: BenchmarkProfile = profile({
  id: "premium_modern_service",
  name: "Premium Modern Service Business",
  summary:
    "Premium service-business quality: decisive hero, restrained craft, and trust before the ask.",
  industryAffinity: [
    "digital",
    "agency",
    "consult",
    "marketing",
    "software",
    "saas",
    "service",
    "studio",
    "design",
    "web",
  ],
  qualities: [
    "strong first impression",
    "clean typography",
    "disciplined spacing",
    "consistent visual language",
    "trust progression",
    "balanced section rhythm",
    "confident CTA placement",
    "restrained color usage",
    "professional polish",
  ],
  targets: {
    hero_quality: 92,
    trust_progression: 90,
    visual_hierarchy: 91,
    narrative_flow: 88,
    section_rhythm: 90,
    spacing_discipline: 92,
    typography: 91,
    cta_confidence: 90,
    imagery_quality: 88,
    polish: 92,
    professionalism: 93,
  },
  weightOverrides: {
    spacing_discipline: 1.2,
    typography: 1.15,
    polish: 1.2,
    hero_quality: 1.25,
  },
});

export const PREMIUM_LANDSCAPING: BenchmarkProfile = profile({
  id: "premium_landscaping",
  name: "Premium Landscaping",
  summary:
    "Image-led outdoor services with finished-work proof before the quote ask.",
  industryAffinity: [
    "landscap",
    "lawn",
    "garden",
    "outdoor",
    "hardscape",
    "contractor",
    "yard",
  ],
  qualities: [
    "image-led first impression",
    "project photography as proof",
    "trust before the quote",
    "clear outdoor-service offer",
    "calm conversion path",
    "professional local credibility",
  ],
  targets: {
    hero_quality: 90,
    trust_progression: 91,
    visual_hierarchy: 88,
    narrative_flow: 87,
    section_rhythm: 88,
    spacing_discipline: 88,
    typography: 86,
    cta_confidence: 89,
    imagery_quality: 94,
    polish: 88,
    professionalism: 90,
  },
  weightOverrides: {
    imagery_quality: 1.35,
    trust_progression: 1.25,
    hero_quality: 1.2,
  },
});

export const LUXURY_HOME_BUILDER: BenchmarkProfile = profile({
  id: "luxury_home_builder",
  name: "Luxury Home Builder",
  summary:
    "High-craft residential building quality with gallery-led proof and restrained luxury tone.",
  industryAffinity: [
    "builder",
    "home builder",
    "custom home",
    "construction",
    "architect",
    "renovat",
    "luxury home",
  ],
  qualities: [
    "aspirational first impression",
    "project portfolio depth",
    "craft and material credibility",
    "trust through completed work",
    "elegant spacing and hierarchy",
    "confident consultation CTA",
  ],
  targets: {
    hero_quality: 93,
    trust_progression: 92,
    visual_hierarchy: 90,
    narrative_flow: 89,
    section_rhythm: 90,
    spacing_discipline: 91,
    typography: 90,
    cta_confidence: 88,
    imagery_quality: 95,
    polish: 93,
    professionalism: 94,
  },
  weightOverrides: {
    imagery_quality: 1.4,
    polish: 1.25,
    professionalism: 1.2,
  },
});

export const MODERN_LAW_FIRM: BenchmarkProfile = profile({
  id: "modern_law_firm",
  name: "Modern Law Firm",
  summary:
    "Authority-led professional services with clarity, trust, and restrained conversion.",
  industryAffinity: [
    "law",
    "legal",
    "attorney",
    "lawyer",
    "firm",
    "counsel",
  ],
  qualities: [
    "authoritative first impression",
    "clarity over decoration",
    "credibility before contact",
    "disciplined typography",
    "restrained color and polish",
    "confident but calm CTA",
  ],
  targets: {
    hero_quality: 89,
    trust_progression: 93,
    visual_hierarchy: 90,
    narrative_flow: 88,
    section_rhythm: 87,
    spacing_discipline: 90,
    typography: 92,
    cta_confidence: 87,
    imagery_quality: 82,
    polish: 91,
    professionalism: 94,
  },
  weightOverrides: {
    trust_progression: 1.35,
    typography: 1.25,
    professionalism: 1.3,
    imagery_quality: 0.75,
  },
});

export const MODERN_DENTAL: BenchmarkProfile = profile({
  id: "modern_dental",
  name: "Modern Dental Practice",
  summary:
    "Warm, clinical confidence with clear services, trust signals, and easy booking.",
  industryAffinity: [
    "dental",
    "dentist",
    "orthodont",
    "oral",
    "clinic",
    "healthcare",
    "medical",
  ],
  qualities: [
    "welcoming first impression",
    "clear service explanation",
    "patient trust before booking",
    "clean clinical polish",
    "confident appointment CTA",
    "calm visual hierarchy",
  ],
  targets: {
    hero_quality: 90,
    trust_progression: 91,
    visual_hierarchy: 89,
    narrative_flow: 88,
    section_rhythm: 88,
    spacing_discipline: 90,
    typography: 89,
    cta_confidence: 92,
    imagery_quality: 86,
    polish: 90,
    professionalism: 92,
  },
  weightOverrides: {
    cta_confidence: 1.3,
    trust_progression: 1.2,
    polish: 1.15,
  },
});

export const HIGH_END_RESTAURANT: BenchmarkProfile = profile({
  id: "high_end_restaurant",
  name: "High-End Restaurant",
  summary:
    "Atmosphere-led hospitality quality with imagery, rhythm, and an inviting reservation path.",
  industryAffinity: [
    "restaurant",
    "dining",
    "bistro",
    "cafe",
    "hospitality",
    "chef",
    "cuisine",
    "bar",
  ],
  qualities: [
    "atmospheric first impression",
    "imagery that sells the experience",
    "appetite-led narrative",
    "balanced visual rhythm",
    "clear reservation CTA",
    "refined polish without clutter",
  ],
  targets: {
    hero_quality: 93,
    trust_progression: 84,
    visual_hierarchy: 90,
    narrative_flow: 88,
    section_rhythm: 92,
    spacing_discipline: 90,
    typography: 89,
    cta_confidence: 90,
    imagery_quality: 95,
    polish: 92,
    professionalism: 90,
  },
  weightOverrides: {
    imagery_quality: 1.4,
    hero_quality: 1.3,
    section_rhythm: 1.2,
    trust_progression: 0.85,
  },
});

export const SEED_BENCHMARK_PROFILES: BenchmarkProfile[] = [
  PREMIUM_MODERN_SERVICE,
  PREMIUM_LANDSCAPING,
  LUXURY_HOME_BUILDER,
  MODERN_LAW_FIRM,
  MODERN_DENTAL,
  HIGH_END_RESTAURANT,
];
