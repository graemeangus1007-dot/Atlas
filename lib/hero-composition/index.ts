export type {
  HeroBodyScale,
  HeroComposition,
  HeroCompositionLayout,
  HeroCompositionResolveInput,
  HeroContentAlignment,
  HeroContentWidth,
  HeroCtaArrangement,
  HeroHeadingScale,
  HeroMinHeight,
  HeroMobileLayout,
  HeroPrimaryEmphasis,
  HeroVerticalAlignment,
} from "@/lib/hero-composition/types";
export { HERO_COMPOSITION_VERSION } from "@/lib/hero-composition/types";

export { inferLegacyHeroComposition } from "@/lib/hero-composition/infer-legacy";
export {
  resolveHeroComposition,
  resolveHeroCompositionFromProject,
} from "@/lib/hero-composition/resolve";
export {
  buildHeroRenderPlan,
  heroParityContract,
  type HeroRenderPlan,
} from "@/lib/hero-composition/render-plan";
