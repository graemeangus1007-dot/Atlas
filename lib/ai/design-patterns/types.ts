/**
 * Atlas Design Pattern Engine (v1.3 foundation).
 * Structured, composable homepage patterns — judgment data, not edit ops.
 */

import type { DesignAgencyTone } from "@/lib/ai/design-strategy-types";

export const DESIGN_PATTERN_CATEGORIES = [
  "hero",
  "trust",
  "services",
  "gallery",
  "cta",
] as const;

export type DesignPatternCategory = (typeof DESIGN_PATTERN_CATEGORIES)[number];

export const DESIGN_PATTERN_PURPOSES = [
  "first_impression",
  "build_trust",
  "explain_offer",
  "show_work",
  "drive_conversion",
  "local_proof",
  "premium_positioning",
  "urgency",
] as const;

export type DesignPatternPurpose = (typeof DESIGN_PATTERN_PURPOSES)[number];

/** Industry affinity tags — free keywords matched against strategy industry blob. */
export type IndustryAffinityTag =
  | "landscaping"
  | "contractor"
  | "restaurant"
  | "luxury"
  | "coastal"
  | "professional_services"
  | "retail"
  | "salon"
  | "real_estate"
  | "general"
  | "local_service"
  | "portfolio";

export type DesignPatternAssetNeed =
  | "hero_photo"
  | "aerial_photo"
  | "project_photos"
  | "before_after"
  | "team_photo"
  | "logo"
  | "none";

export type DesignPatternContentNeed =
  | "headline"
  | "subheadline"
  | "primary_cta"
  | "services"
  | "testimonials"
  | "reviews"
  | "faq"
  | "contact"
  | "process_steps"
  | "awards";

/**
 * Reusable design pattern — composable unit of agency homepage design.
 * No prompt text; selectors/explain derive natural language from these fields.
 */
export type DesignPattern = {
  id: string;
  category: DesignPatternCategory;
  /** Short human label (never shown as an ID). */
  name: string;
  industryAffinity: IndustryAffinityTag[];
  brandAffinity: DesignAgencyTone[];
  tone: DesignAgencyTone[];
  purpose: DesignPatternPurpose[];
  requiredAssets: DesignPatternAssetNeed[];
  requiredContent: DesignPatternContentNeed[];
  strengths: string[];
  avoidWhen: string[];
  compatiblePatterns: string[];
  /** Machine layout / composition hints — not user-facing copy. */
  layoutInstructions: string[];
  /** 0–1 conversion strength. */
  conversionStrength: number;
  /** 0–1 visual weight (hero high, footer low). */
  visualWeight: number;
};

export type DesignPatternSelectionContext = {
  industry?: string;
  businessType?: string;
  businessDescription?: string;
  audience?: string;
  primaryGoal?: string;
  designLanguage?: string;
  businessTone?: string;
  agencyTones?: DesignAgencyTone[];
  hasHeroImage?: boolean;
  hasTestimonials?: boolean;
  galleryFilledSlots?: number;
  libraryCount?: number;
  enabledSections?: string[];
  request?: string;
};

export type DesignPatternScoreDimensions = {
  visualHierarchy: number;
  trust: number;
  readability: number;
  conversion: number;
  imageUse: number;
  brandConsistency: number;
  spacing: number;
  balance: number;
  originality: number;
  mobileSuitability: number;
};

export type DesignPatternComposition = {
  /** Ordered section slots with selected pattern ids. */
  slots: Array<{
    section: "hero" | "trust" | "services" | "gallery" | "cta" | "contact" | "footer";
    patternId: string | null;
  }>;
  patternIds: string[];
  score: number;
  dimensions: DesignPatternScoreDimensions;
  /** Internal — never surface raw to users. */
  rationaleTags: string[];
};

/** Advisory summary attached to Design Strategy (does not rewrite the site). */
export type DesignPatternStrategyAttachment = {
  patternIds: string[];
  compositionScore: number;
  dimensions: DesignPatternScoreDimensions;
  /** Natural-language explanation — no pattern IDs. */
  explanation: string;
  sectionFlow: string[];
};
