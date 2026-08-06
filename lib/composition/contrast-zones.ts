/**
 * Contrast treatments — composition before overlays.
 * Preference: whitespace → local scrim → directional gradient → small overlay → large overlay → blur (last).
 */

import type { ImageAnalysisEstimate } from "@/lib/composition/image-analysis";
import type {
  CompositionAnalysisInput,
  CompositionTreatmentStep,
  ContentZoneRecommendation,
  GradientRecommendation,
  ScrimRecommendation,
} from "@/lib/composition/types";

export type ContrastPlan = {
  overlayStrength: number;
  recommendedGradient: GradientRecommendation;
  recommendedScrim: ScrimRecommendation;
  treatmentLadder: CompositionTreatmentStep[];
  preservePhotography: boolean;
  decisionReason: string;
};

function gradientForZone(
  zone: ContentZoneRecommendation,
  strength: number,
  coverage: number,
): NonNullable<GradientRecommendation> {
  let direction: "left" | "right" | "top" | "bottom" = "bottom";
  if (zone.alignment === "left" || zone.zone === "split_left") {
    direction = "left";
  } else if (zone.alignment === "right" || zone.zone === "split_right") {
    direction = "right";
  } else if (zone.verticalBias === "top") {
    direction = "top";
  } else {
    direction = "bottom";
  }
  return {
    direction,
    strength,
    coverage,
    reason: `A ${direction}-weighted gradient supports type in the ${zone.zone.replace(/_/g, " ")} without washing the full frame.`,
  };
}

/**
 * Build contrast treatment following the composition-first ladder.
 * Large blur is almost never selected.
 */
export function planContrastTreatments(input: {
  analysis: ImageAnalysisEstimate;
  compositionInput: CompositionAnalysisInput;
  contentZone: ContentZoneRecommendation;
  quietness: number;
}): ContrastPlan {
  const ladder: CompositionTreatmentStep[] = [
    "analyze",
    "move_content",
    "adjust_alignment",
    "use_whitespace",
  ];

  const busy = input.analysis.busyLikely;
  const quiet = input.quietness >= 70;
  const veryQuiet = input.quietness >= 82;
  const currentOverlay = input.compositionInput.currentOverlay ?? 50;
  const brightHint =
    input.compositionInput.pixelAnalysis?.brightnessMap === "bright";

  let overlayStrength = 0;
  let recommendedGradient: GradientRecommendation = null;
  let recommendedScrim: ScrimRecommendation = null;
  let preservePhotography = true;
  let decisionReason =
    "Content was placed in a quieter part of the photo so the image can stay visible.";

  if (veryQuiet && !brightHint && input.analysis.minimalLikely) {
    // Natural whitespace is enough
    overlayStrength = Math.min(currentOverlay, 0);
    decisionReason =
      "Natural negative space carries the headline, so heavier visual effects were unnecessary.";
  } else if (quiet && !busy) {
    ladder.push("local_scrim");
    recommendedScrim = {
      enabled: true,
      opacity: 0.18,
      blur: null,
      reason: "A subtle local scrim improves type contrast without hiding the photo.",
    };
    recommendedGradient = gradientForZone(input.contentZone, 0.28, 0.48);
    ladder.push("directional_gradient");
    overlayStrength = Math.min(currentOverlay, 15);
    if (overlayStrength > 0) ladder.push("small_overlay");
    decisionReason =
      "I moved the content into a quieter part of the photo and used a subtle localized contrast treatment so visitors can read the headline while still seeing the image.";
  } else if (busy || brightHint) {
    ladder.push("local_scrim", "directional_gradient", "small_overlay");
    recommendedScrim = {
      enabled: true,
      opacity: busy ? 0.28 : 0.22,
      blur: null,
      reason: "Localized contrast keeps type readable on a busier photograph.",
    };
    recommendedGradient = gradientForZone(
      input.contentZone,
      busy ? 0.42 : 0.34,
      busy ? 0.58 : 0.5,
    );
    overlayStrength = Math.min(Math.max(currentOverlay, 0), 25);
    decisionReason =
      "I placed the content away from the busiest part of the photo and added a light directional contrast treatment instead of darkening the whole image.";
    preservePhotography = true;
  } else {
    ladder.push("local_scrim", "directional_gradient", "small_overlay");
    recommendedScrim = {
      enabled: true,
      opacity: 0.22,
      blur: null,
      reason: "A light scrim supports readability with minimal photography intrusion.",
    };
    recommendedGradient = gradientForZone(input.contentZone, 0.32, 0.5);
    overlayStrength = Math.min(currentOverlay, 25);
    decisionReason =
      "I adjusted placement and used a subtle localized contrast treatment so the headline stays readable while the photograph remains visible.";
  }

  // Never escalate to large overlay / blur in the default plan.
  // Only if current overlay is already crushing and quietness is terrible.
  if (input.quietness < 35 && currentOverlay >= 75) {
    ladder.push("large_overlay");
    overlayStrength = 50;
    preservePhotography = false;
    recommendedScrim = {
      enabled: true,
      opacity: 0.35,
      blur: null,
      reason: "Stronger localized contrast is required because safe reading space is limited.",
    };
    decisionReason =
      "Safe reading space is limited, so a stronger localized contrast was needed — still preferring placement and scrim over a full-frame wash.";
  }

  // Explicitly never choose blur in Phase 1 default path.
  const blurSelected = false;
  if (blurSelected) {
    ladder.push("blur");
  }

  return {
    overlayStrength: Math.max(0, Math.min(100, Math.round(overlayStrength))),
    recommendedGradient,
    recommendedScrim,
    treatmentLadder: ladder,
    preservePhotography,
    decisionReason,
  };
}
