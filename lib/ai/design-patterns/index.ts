/**
 * Atlas Design Pattern Engine — public barrel.
 */

export type {
  DesignPattern,
  DesignPatternAssetNeed,
  DesignPatternCategory,
  DesignPatternComposition,
  DesignPatternContentNeed,
  DesignPatternPurpose,
  DesignPatternScoreDimensions,
  DesignPatternSelectionContext,
  DesignPatternStrategyAttachment,
  IndustryAffinityTag,
} from "@/lib/ai/design-patterns/types";
export {
  DESIGN_PATTERN_CATEGORIES,
  DESIGN_PATTERN_PURPOSES,
} from "@/lib/ai/design-patterns/types";

export {
  DESIGN_PATTERN_REGISTRY,
  countDesignPatternsByCategory,
  getDesignPatternById,
  getDesignPatternsByCategory,
  listAllDesignPatterns,
  textExposesDesignPatternIds,
} from "@/lib/ai/design-patterns/registry";

export {
  arePatternsHardIncompatible,
  buildCompatibilityGraph,
  isCompatiblePatternSet,
  scorePatternPairCompatibility,
} from "@/lib/ai/design-patterns/compatibility";

export {
  inferIndustryAffinityTags,
  scorePatternForContext,
  selectCandidatePatterns,
  selectTopPattern,
} from "@/lib/ai/design-patterns/selectors";

export {
  composeDesignPatterns,
  compositionSectionFlowLabels,
} from "@/lib/ai/design-patterns/composition";

export {
  aggregateCompositionScore,
  emptyScoreDimensions,
  scoreComposition,
  scoreCompositionDimensions,
} from "@/lib/ai/design-patterns/scoring";

export {
  explainCompositionSectionFlow,
  explainDesignPatternComposition,
} from "@/lib/ai/design-patterns/explain";

export { attachDesignPatternsToStrategy } from "@/lib/ai/design-patterns/strategy-integration";
