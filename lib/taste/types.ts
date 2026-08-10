/**
 * Taste Engine (Phase 1) — professional design taste beyond correctness.
 * Deterministic, explainable. Principles only — never copies benchmarks.
 */

export const TASTE_ENGINE_VERSION = "1.0.0";

/** Scored craft dimensions (0–100). */
export type TasteDimensionId =
  | "spacingHarmony"
  | "typographyHarmony"
  | "visualRhythm"
  | "alignmentQuality"
  | "componentConsistency"
  | "visualWeight"
  | "craftsmanship"
  | "restraint"
  | "proportion"
  | "ctaPresence"
  | "scanability"
  | "polish";

export type TasteDimensionScore = {
  id: TasteDimensionId;
  score: number;
  label: string;
  explanation: string;
  strengths: string[];
  weaknesses: string[];
};

export type TasteRecommendation = {
  owner: "taste";
  domain: import("@/lib/scope/types").RecommendationDomain;
  title: string;
  explanation: string;
  /** Dimensions this recommendation is expected to improve. */
  improves: TasteDimensionId[];
  priority: "high" | "medium" | "low";
  estimatedImpact: number;
  /** Planner theme bridge — never a layout template. */
  theme: "rhythm" | "hierarchy" | "messaging";
};

export type TasteEvaluation = {
  version: string;
  evaluatedAt: string;
  overallTaste: number;
  spacingHarmony: number;
  typographyHarmony: number;
  visualRhythm: number;
  alignmentQuality: number;
  componentConsistency: number;
  visualWeight: number;
  craftsmanship: number;
  restraint: number;
  proportion: number;
  ctaPresence: number;
  scanability: number;
  polish: number;
  dimensions: TasteDimensionScore[];
  strengths: string[];
  weaknesses: string[];
  highestPriorityImprovement: TasteDimensionId | null;
  recommendations: TasteRecommendation[];
  confidence: number;
  /**
   * True when Taste may influence Creative Director scoring.
   * False when structure/function still needs work first.
   */
  eligibleToJudge: boolean;
  /** Short professional assessment. */
  summary: string;
};

/** Deterministic signals collected from project + inventory (no ML). */
export type TasteSignals = {
  spacing: "default" | "comfortable" | "airy" | string;
  visualHierarchy: boolean;
  headingFont: string;
  bodyFont: string;
  buttonStyle: string;
  siteWidth: string;
  templateId: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string;
  heroOverlay: number;
  hasHeroTreatmentGradient: boolean;
  hasHeroTreatmentScrim: boolean;
  heroScrimBlur: number;
  hasHeroImage: boolean;
  hasHeroPattern: boolean;
  motionEnabled: boolean;
  hoverEffects: boolean;
  sectionReveal: boolean;
  serviceIcons: boolean;
  servicesCount: number;
  gallerySlots: number;
  sectionCount: number;
  headlineLength: number;
  subheadlineLength: number;
  primaryCtaLength: number;
  hasSecondaryCta: boolean;
  heroCompositionScore: number | null;
  visualCompositionScore: number | null;
  photographyPreservation: number | null;
  /** Optional CD dimension bridges (when available). */
  cdVisualRhythm: number | null;
  cdWhitespace: number | null;
  cdProfessionalism: number | null;
  cdConsistency: number | null;
  cdScanability: number | null;
  cdFirstImpression: number | null;
  sectionCadence: Array<"heavy" | "medium" | "light">;
  heroVisualWeight: "heavy" | "medium" | "light" | null;
  distinctBrandColors: number;
};

export type TasteDiagnostics = {
  overallTaste: number;
  spacingHarmony: number;
  typographyHarmony: number;
  visualRhythm: number;
  craftsmanship: number;
  visualWeight: number;
  restraint: number;
  highestPriorityImprovement: TasteDimensionId | null;
  recommendationSource: "taste_engine";
  eligibleToJudge: boolean;
};
