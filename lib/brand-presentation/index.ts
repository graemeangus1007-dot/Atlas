export {
  NEAR_BLACK_PRESENTATION,
  WHITE_PRESENTATION,
  type AdaptiveBrandPresentation,
  type BrandIdentity,
  type BrandPresentationCssVars,
  type BrandPresentationDiagnostics,
  type BrandPresentationEvaluation,
  type BrandPresentationVerifyResult,
  type HeroImagePresentationContext,
  type ResolvedBrandPresentation,
} from "@/lib/brand-presentation/types";

export {
  ctaTextOnBackground,
  isDarkBrandColor,
  isGoldLikeAccent,
  isLightBrandSurface,
} from "@/lib/brand-presentation/color-roles";

export {
  estimateEffectiveHeroSurface,
  readHeroImagePresentationContext,
} from "@/lib/brand-presentation/image-context";

export { adaptBrandPresentation } from "@/lib/brand-presentation/adapt";
export { evaluateBrandPresentation } from "@/lib/brand-presentation/evaluator";
export {
  brandPresentationCssVars,
  logBrandPresentationDiagnostics,
  readBrandIdentity,
  resolveAdaptiveBrandPresentation,
} from "@/lib/brand-presentation/resolver";
export {
  explainBrandPresentation,
  explanationClaimsBrandChange,
} from "@/lib/brand-presentation/explain";
export { verifyBrandPresentation } from "@/lib/brand-presentation/verify";
