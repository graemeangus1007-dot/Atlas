/**
 * Content + CTA placement recommendations from composition analysis.
 */

import type { ImageAnalysisEstimate } from "@/lib/composition/image-analysis";
import type {
  CompositionAnalysisInput,
  ContentZoneRecommendation,
  CtaPlacementStyle,
  HeroHeightRecommendation,
} from "@/lib/composition/types";

export function recommendHeroHeight(
  analysis: ImageAnalysisEstimate,
  compositionInput: CompositionAnalysisInput,
): HeroHeightRecommendation {
  if (compositionInput.patternId === "hero.premium_minimal") return "short";
  if (compositionInput.patternId === "hero.cinematic_full_width") {
    return "viewport";
  }
  if (analysis.aspectClass === "panoramic") return "tall";
  if (analysis.aspectClass === "portrait") return "tall";
  if (compositionInput.legacyLayoutKey === "bold-overlay") return "tall";
  if (compositionInput.layout === "contained") return "medium";
  return "tall";
}

export function recommendCtaPlacement(input: {
  compositionInput: CompositionAnalysisInput;
  contentZone: ContentZoneRecommendation;
  ctaZone: ContentZoneRecommendation;
}): CtaPlacementStyle {
  const { compositionInput, contentZone } = input;
  const hasSecondary = Boolean(compositionInput.hasSecondaryCta);
  const longCta = (compositionInput.ctaLength ?? 0) > 26;
  const longHeadline = (compositionInput.headlineLength ?? 0) > 72;

  if (compositionInput.patternId === "hero.premium_minimal") {
    return hasSecondary ? "stacked" : "single";
  }
  if (longCta || longHeadline) return hasSecondary ? "stacked" : "single";
  if (
    contentZone.zone === "split_left" ||
    compositionInput.patternId === "hero.contractor_left"
  ) {
    return hasSecondary ? "dual" : "single";
  }
  if (contentZone.verticalBias === "bottom" && hasSecondary) {
    return "inline";
  }
  // Floating reserved for unusually quiet edge placements with short CTAs
  if (
    (contentZone.zone === "right" || contentZone.zone === "left") &&
    !hasSecondary &&
    (compositionInput.ctaLength ?? 0) < 16
  ) {
    return "single";
  }
  return hasSecondary ? "dual" : "single";
}

export function ctaArrangementFromPlacement(
  placement: CtaPlacementStyle,
): "row" | "stack" {
  if (placement === "stacked" || placement === "floating") return "stack";
  return "row";
}
