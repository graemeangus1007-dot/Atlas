export {
  TASTE_ENGINE_VERSION,
  type TasteDimensionId,
  type TasteDimensionScore,
  type TasteDiagnostics,
  type TasteEvaluation,
  type TasteRecommendation,
  type TasteSignals,
} from "@/lib/taste/types";

export {
  TASTE_DIMENSIONS,
  tasteDimensionLabel,
  tasteDimensionMeta,
} from "@/lib/taste/registry";

export { scoreSpacingHarmony } from "@/lib/taste/spacing";
export { scoreTypographyHarmony } from "@/lib/taste/typography";
export { scoreAlignmentQuality } from "@/lib/taste/alignment";
export { scoreProportion } from "@/lib/taste/proportion";
export { scoreVisualRhythm } from "@/lib/taste/rhythm";
export { scoreContrastCraft } from "@/lib/taste/contrast";
export { scoreComponentConsistency } from "@/lib/taste/consistency";
export { scoreRestraint } from "@/lib/taste/restraint";
export { scoreVisualWeight } from "@/lib/taste/visual-weight";
export { scoreCraftsmanship } from "@/lib/taste/craftsmanship";

export {
  collectTasteSignals,
  evaluateTaste,
  isTasteEligibleToJudge,
  blendTasteIntoDesignScore,
} from "@/lib/taste/evaluation";

export {
  buildTasteRecommendations,
  applyTasteRefinement,
  verifyTasteImprovement,
} from "@/lib/taste/recommendations";

export {
  formatTasteSummary,
  buildTasteDiagnostics,
  logTasteDiagnostics,
  tasteTextSoundsLikeCopying,
} from "@/lib/taste/presentation";

export {
  TASTE_POLISH_VERSION,
  TASTE_POLISH_DIMENSIONS,
  type TastePolishDimension,
  type TastePolishPlan,
  type TastePolishEligibility,
  type TastePolishResult,
  type TastePolishVerdict,
  type TastePolishDiagnostics,
} from "@/lib/taste/polish-types";

export { assessTastePolishEligibility } from "@/lib/taste/polish-eligibility";
export {
  TASTE_POLISH_ALLOWED_ROOTS,
  TASTE_POLISH_FORBIDDEN_ROOTS,
  tastePolishScopeViolations,
  tastePolishOperationsInScope,
} from "@/lib/taste/polish-scope";
export { planTastePolish } from "@/lib/taste/polish-plan";
export {
  executeTastePolish,
  logTastePolishDiagnostics,
} from "@/lib/taste/polish-execute";
export {
  formatTastePolishExplanation,
  formatTastePolishIneligibleExplanation,
  isTastePolishRequest,
  tastePolishMentionsInternalIds,
} from "@/lib/taste/polish-presentation";
