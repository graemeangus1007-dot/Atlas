export {
  CREATIVE_DIRECTOR_EVAL_VERSION,
  type ConversionEvaluation,
  type CreativeDirectorDiagnostics,
  type CreativeDirectorEvaluation,
  type CreativeDirectorRecommendation,
  type ExecutiveSummary,
  type FlowEvaluation,
  type NarrativeEvaluation,
  type PageSectionInventory,
  type RhythmEvaluation,
  type SectionEvaluation,
  type TrustEvaluation,
  type WebsiteDimensionScores,
  type WebsiteHealthV2,
  type WebsiteSectionId,
} from "@/lib/creative-director/types";

export { buildPageSectionInventory } from "@/lib/creative-director/inventory";
export { evaluateWebsiteSections } from "@/lib/creative-director/section-evaluator";
export { evaluateWebsiteFlow } from "@/lib/creative-director/flow-evaluator";
export { evaluateVisualRhythm } from "@/lib/creative-director/rhythm-evaluator";
export { evaluateWebsiteTrust } from "@/lib/creative-director/trust-evaluator";
export { evaluateWebsiteConversion } from "@/lib/creative-director/conversion-evaluator";
export { evaluateWebsiteNarrative } from "@/lib/creative-director/narrative-evaluator";
export {
  buildCreativeDirectorRecommendations,
  buildExecutiveSummary,
  buildWebsiteHealthV2,
  logCreativeDirectorDiagnostics,
  textExposesInternalIds,
} from "@/lib/creative-director/presentation";
export { evaluateWebsiteAsCreativeDirector } from "@/lib/creative-director/website-evaluator";
export {
  classifyDesignQualityBand,
  designQualityBandLabel,
  detectMajorWeaknesses,
  applyScoreCaps,
  DESIGN_QUALITY_BANDS,
  type DesignQualityBand,
  type MajorWeakness,
} from "@/lib/creative-director/score-calibration";

// Re-export benchmark advisory surface used by Creative Director consumers
export type { BenchmarkComparison } from "@/lib/benchmarks/types";
