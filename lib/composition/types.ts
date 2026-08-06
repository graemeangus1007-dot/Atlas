/**
 * Visual Composition Engine (Phase 1) — advisory composition analysis.
 * Deterministic, explainable. Future pixel analysis plugs into the same model.
 * Does not replace HeroComposition.
 */

export const VISUAL_COMPOSITION_VERSION = "1.0.0";

export type SubjectRegion =
  | "left"
  | "center"
  | "right"
  | "upper"
  | "lower"
  | "full"
  | "unknown";

export type ContentZoneId =
  | "upper_third"
  | "lower_third"
  | "left"
  | "right"
  | "center"
  | "split_left"
  | "split_right";

export type ContentAlignment = "left" | "center" | "right";
export type HeroHeightRecommendation = "short" | "medium" | "tall" | "viewport";

export type CtaPlacementStyle =
  | "single"
  | "dual"
  | "stacked"
  | "inline"
  | "floating";

export type GradientDirection = "left" | "right" | "top" | "bottom";

export type CompositionTreatmentStep =
  | "analyze"
  | "move_content"
  | "adjust_alignment"
  | "use_whitespace"
  | "local_scrim"
  | "directional_gradient"
  | "small_overlay"
  | "large_overlay"
  | "blur";

export type NegativeSpaceZone = {
  id: ContentZoneId;
  /** Relative quietness 0–100 (higher = safer for text). */
  quietness: number;
  /** Avoid flags for faces/products/logos/focal conflict (heuristic). */
  avoidReasons: string[];
};

export type ContentZoneRecommendation = {
  zone: ContentZoneId;
  alignment: ContentAlignment;
  verticalBias: "top" | "center" | "bottom";
  reason: string;
};

export type GradientRecommendation = {
  direction: GradientDirection;
  strength: number;
  coverage: number;
  reason: string;
} | null;

export type ScrimRecommendation = {
  enabled: boolean;
  opacity: number;
  /** Blur is last-resort; keep null/0 unless unavoidable. */
  blur: number | null;
  reason: string;
} | null;

/**
 * Canonical composition analysis object.
 * Future CV/pixel analysis should enrich these fields — not replace the pipeline.
 */
export type VisualComposition = {
  version: typeof VISUAL_COMPOSITION_VERSION;
  imageQuality: number;
  subjectLocation: SubjectRegion;
  focalPoint: { x: number; y: number };
  negativeSpaceZones: NegativeSpaceZone[];
  recommendedContentZone: ContentZoneRecommendation;
  recommendedCTAZone: ContentZoneRecommendation;
  recommendedAlignment: ContentAlignment;
  recommendedHeight: HeroHeightRecommendation;
  recommendedGradient: GradientRecommendation;
  recommendedScrim: ScrimRecommendation;
  /** Global overlay 0–100 — prefer low when photography can be preserved. */
  overlayStrength: number;
  preservePhotography: boolean;
  /** 0–1 confidence in this analysis (metadata-only analyses are mid-range). */
  confidence: number;
  /** CTA arrangement suggested by available composition space. */
  recommendedCtaPlacement: CtaPlacementStyle;
  /** Treatments selected in preference order (no large blur by default). */
  treatmentLadder: CompositionTreatmentStep[];
  /** Why this composition decision was made (user-safe language). */
  decisionReason: string;
  /**
   * Optional future pixel-analysis hook.
   * When present, analyzers should merge — never discard metadata estimates.
   */
  pixelAnalysis?: VisualCompositionPixelHints | null;
};

/** Pluggable future pixel / CV hints — same pipeline, richer inputs. */
export type VisualCompositionPixelHints = {
  subjectBoundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  } | null;
  quietRegions?: Array<{
    zone: ContentZoneId;
    quietness: number;
  }>;
  faceRegions?: Array<{ x: number; y: number; width: number; height: number }>;
  brightnessMap?: "dark" | "mid" | "bright" | "mixed";
  source: "future_pixel_analysis";
};

export type PhotographyPreservationScore = {
  overall: number;
  visibility: number;
  subjectIntegrity: number;
  croppingQuality: number;
  distraction: number;
  overlayIntrusion: number;
  blurIntrusion: number;
  explanation: string;
};

export type CompositionEvaluation = {
  overall: number;
  imageImpact: number;
  balance: number;
  textRelationship: number;
  ctaRelationship: number;
  negativeSpaceUse: number;
  visualHarmony: number;
  photographyPreservation: PhotographyPreservationScore;
  strengths: string[];
  weaknesses: string[];
  recommendedImprovements: string[];
};

export type CompositionDiagnostics = {
  compositionScore: number;
  negativeSpaceZones: NegativeSpaceZone[];
  recommendedContentZone: ContentZoneId;
  recommendedCTAZone: ContentZoneId;
  overlayBefore: number;
  overlayAfter: number;
  photographyPreservation: number;
  compositionDecision: string;
  treatmentLadder: CompositionTreatmentStep[];
  blurSelected: boolean;
};

export type CompositionAnalysisInput = {
  hasHeroImage: boolean;
  aspectRatio?: number | null;
  focalPoint?: { x: number; y: number } | null;
  imageFit?: "cover" | "contain" | "full" | null;
  imagePosition?: "center" | "top" | "bottom" | "left" | "right" | null;
  zoom?: number | null;
  patternId?: string | null;
  layout?: "full_width" | "split" | "contained" | "floating_card" | null;
  legacyLayoutKey?: "centered" | "split" | "minimal" | "bold-overlay" | null;
  currentOverlay?: number | null;
  currentScrimBlur?: number | null;
  hasSecondaryCta?: boolean;
  headlineLength?: number;
  ctaLength?: number;
  industry?: string | null;
  /** Optional future pixel hints. */
  pixelAnalysis?: VisualCompositionPixelHints | null;
};
