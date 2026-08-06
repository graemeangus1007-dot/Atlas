/**
 * Score adaptive brand presentation quality.
 */

import { contrastRatio } from "@/lib/ai/contrast";
import { isGoldLikeAccent } from "@/lib/brand-presentation/color-roles";
import type {
  AdaptiveBrandPresentation,
  BrandIdentity,
  BrandPresentationEvaluation,
  HeroImagePresentationContext,
} from "@/lib/brand-presentation/types";

function clamp(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function contrastScore(fg: string, bg: string, large = false): number {
  const ratio = contrastRatio(fg, bg);
  if (ratio == null) return 40;
  const floor = large ? 3 : 4.5;
  if (ratio >= floor + 3) return 96;
  if (ratio >= floor + 1.5) return 86;
  if (ratio >= floor) return 74;
  if (ratio >= floor - 1) return 52;
  return 28;
}

export function evaluateBrandPresentation(input: {
  identity: BrandIdentity;
  presentation: AdaptiveBrandPresentation;
  image: HeroImagePresentationContext;
  effectiveHeroSurface: string;
}): BrandPresentationEvaluation {
  const { identity, presentation: p, image, effectiveHeroSurface } = input;

  const headlineContrast = contrastScore(
    p.heroHeadlineColor,
    effectiveHeroSurface,
    true,
  );
  const bodyContrast = contrastScore(
    p.heroBodyColor.startsWith("rgba")
      ? "#f2f4f7"
      : p.heroBodyColor,
    effectiveHeroSurface,
  );
  const ctaContrast = clamp((p.heroButtonContrast / 7) * 100);

  let accentVisibility = 70;
  if (isGoldLikeAccent(identity.accent)) {
    accentVisibility = p.heroEyebrowColor.toLowerCase() === identity.accent.toLowerCase()
      ? 88
      : 55;
    // Penalize gold used as long body ink
    if (p.heroBodyColor.toLowerCase() === identity.accent.toLowerCase()) {
      accentVisibility -= 30;
    }
  }

  let brandConsistency = 90;
  if (
    p.heroPrimaryCTAStyle.background.toLowerCase() !==
    identity.accent.toLowerCase()
  ) {
    brandConsistency -= 20;
  }
  if (
    p.heroEyebrowColor.toLowerCase() !== identity.accent.toLowerCase() &&
    isGoldLikeAccent(identity.accent)
  ) {
    brandConsistency -= 10;
  }

  let visualHarmony = 72;
  if (image.brightness === "light" && p.heroOverlayStrength <= 25) {
    visualHarmony += 12;
  }
  if (image.complexity === "busy" && p.heroScrim.enabled) {
    visualHarmony += 10;
  }
  if (p.heroOverlayStrength >= 75) {
    visualHarmony -= 28;
  }

  const accessibility = clamp(
    headlineContrast * 0.4 + bodyContrast * 0.25 + ctaContrast * 0.35,
  );

  let firstImpression = 68;
  if (p.decisions.usedWhitePresentation && image.hasImage) {
    firstImpression += 10;
  }
  if (p.heroOverlayStrength <= 25 && image.hasImage) {
    firstImpression += 8;
  }
  if (p.heroOverlayStrength >= 75) {
    firstImpression -= 24;
  }

  const overallReadability = clamp(
    headlineContrast * 0.45 + bodyContrast * 0.3 + accessibility * 0.25,
  );

  const presentationScore = clamp(
    headlineContrast * 0.18 +
      bodyContrast * 0.1 +
      ctaContrast * 0.14 +
      accentVisibility * 0.1 +
      brandConsistency * 0.12 +
      visualHarmony * 0.12 +
      accessibility * 0.12 +
      firstImpression * 0.06 +
      overallReadability * 0.06,
  );

  return {
    presentationScore,
    headlineContrast: clamp(headlineContrast),
    bodyContrast: clamp(bodyContrast),
    ctaContrast: clamp(ctaContrast),
    accentVisibility: clamp(accentVisibility),
    brandConsistency: clamp(brandConsistency),
    visualHarmony: clamp(visualHarmony),
    accessibility: clamp(accessibility),
    firstImpression: clamp(firstImpression),
    overallReadability: clamp(overallReadability),
  };
}
