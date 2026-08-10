/**
 * Scope Enforcement — ownership contracts for Atlas intelligence systems.
 * Every recommendation declares an owner + domain; cross-lane advice is rejected.
 */

export const SCOPE_ENFORCEMENT_VERSION = "1.0.0";

export type IntelligenceOwner =
  | "taste"
  | "creative_director"
  | "benchmark"
  | "visual_composition"
  | "transformation"
  | "conversion_director";

/** Canonical recommendation domains. */
export type RecommendationDomain =
  | "spacing"
  | "typography_hierarchy"
  | "rhythm"
  | "alignment"
  | "restraint"
  | "cta_proportion"
  | "button_consistency"
  | "visual_polish"
  | "visual_direction"
  | "section_sequencing"
  | "hierarchy"
  | "design_language"
  | "narrative"
  | "layout"
  | "benchmark_comparison"
  | "hero_composition"
  | "transformation_execution"
  | "trust"
  | "cta"
  | "offer"
  | "objections"
  | "proof"
  | "friction"
  | "urgency"
  | "contact_flow"
  | "lead_generation"
  | "brand_colors"
  | "palette"
  | "fonts"
  | "faq"
  | "testimonials"
  | "gallery"
  | "motion"
  | "section_order"
  | "imagery"
  | "business_strategy"
  | "copy_strategy"
  | "pricing"
  | "offers";

export type ScopeViolation = {
  owner: IntelligenceOwner;
  requestedOperation: string;
  violatedDomain: RecommendationDomain | string;
  reason: string;
};

/** Contract every recommendation must declare. */
export type ScopedRecommendationContract = {
  owner: IntelligenceOwner;
  domain: RecommendationDomain;
  title: string;
  explanation: string;
};

export type ScopeValidationResult = {
  ok: boolean;
  allowed: ScopedRecommendationContract[];
  blocked: ScopedRecommendationContract[];
  violations: ScopeViolation[];
};
