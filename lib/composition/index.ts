export {
  VISUAL_COMPOSITION_VERSION,
  type VisualComposition,
  type PhotographyPreservationScore,
  type CompositionEvaluation,
  type CompositionDiagnostics,
  type CompositionAnalysisInput,
  type CompositionTreatmentStep,
  type ContentZoneId,
  type CtaPlacementStyle,
  type NegativeSpaceZone,
  type VisualCompositionPixelHints,
} from "@/lib/composition/types";

export {
  analyzeImageComposition,
  classifyAspectRatio,
  type ImageAnalysisEstimate,
  type ImageAspectClass,
} from "@/lib/composition/image-analysis";

export {
  resolveCompositionFocalPoint,
  focalConflictsWithZone,
} from "@/lib/composition/focal-point";

export {
  estimateNegativeSpaceZones,
  pickQuietestZone,
} from "@/lib/composition/negative-space";

export { determineSafeZones } from "@/lib/composition/safe-zones";

export { planContrastTreatments } from "@/lib/composition/contrast-zones";

export {
  recommendHeroHeight,
  recommendCtaPlacement,
  ctaArrangementFromPlacement,
} from "@/lib/composition/content-placement";

export {
  buildVisualComposition,
  compositionInputFromProject,
  analyzeProjectVisualComposition,
} from "@/lib/composition/layout-selector";

export {
  evaluateVisualComposition,
  scorePhotographyPreservation,
} from "@/lib/composition/evaluator";

export {
  applyVisualCompositionToHero,
  refineHeroWithVisualComposition,
  logCompositionDiagnostics,
  type ApplyVisualCompositionResult,
} from "@/lib/composition/refinement";

export {
  explainCompositionDecision,
  explainCompositionEvaluation,
  formatCompositionSummary,
  compositionTextSoundsLikeOverlayDefault,
} from "@/lib/composition/presentation";
