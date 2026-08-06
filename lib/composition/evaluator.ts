/**
 * Evaluate composition quality + photography preservation.
 */

import type {
  CompositionEvaluation,
  PhotographyPreservationScore,
  VisualComposition,
} from "@/lib/composition/types";
import type { HeroComposition } from "@/lib/hero-composition/types";

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function scorePhotographyPreservation(input: {
  visual: VisualComposition;
  composition?: HeroComposition | null;
}): PhotographyPreservationScore {
  const overlay =
    input.composition?.treatment.overlay ?? input.visual.overlayStrength;
  const blur =
    input.composition?.treatment.textScrim?.blur ??
    input.visual.recommendedScrim?.blur ??
    0;
  const fit = input.composition?.image.fit ?? "cover";
  const zoom = input.composition?.image.zoom ?? 1;

  const overlayIntrusion = clamp(100 - overlay * 1.15);
  // Large blur significantly reduces preservation
  const blurIntrusion = clamp(
    blur && blur >= 8 ? 100 - blur * 8 : blur && blur > 0 ? 100 - blur * 3 : 96,
  );
  const visibility = clamp(
    (overlayIntrusion * 0.55 + blurIntrusion * 0.25 + input.visual.imageQuality * 0.2),
  );
  const subjectIntegrity = clamp(
    88 -
      (input.visual.subjectLocation === "full" ? 10 : 0) -
      (overlay >= 75 ? 22 : overlay >= 50 ? 12 : 0) -
      (blur && blur >= 8 ? 18 : 0),
  );
  const croppingQuality = clamp(
    fit === "contain" ? 48 : fit === "cover" ? 82 : 70 - Math.max(0, zoom - 1) * 40,
  );
  const distraction = clamp(
    90 -
      (overlay >= 50 ? 20 : 0) -
      (blur && blur >= 6 ? 25 : 0) -
      (input.visual.imageQuality < 55 ? 12 : 0),
  );

  const overall = clamp(
    visibility * 0.28 +
      subjectIntegrity * 0.22 +
      croppingQuality * 0.14 +
      distraction * 0.14 +
      overlayIntrusion * 0.12 +
      blurIntrusion * 0.1,
  );

  let explanation =
    "The photograph remains largely visible with localized contrast supporting the type.";
  if (overlay >= 75) {
    explanation =
      "A heavy global overlay is hiding too much of the photograph.";
  } else if (blur && blur >= 8) {
    explanation =
      "Large blurred regions are reducing photography presence more than necessary.";
  } else if (overall >= 85) {
    explanation =
      "Photography is well preserved — content uses quieter space instead of heavy effects.";
  }

  return {
    overall,
    visibility,
    subjectIntegrity,
    croppingQuality,
    distraction,
    overlayIntrusion,
    blurIntrusion,
    explanation,
  };
}

export function evaluateVisualComposition(input: {
  visual: VisualComposition;
  composition?: HeroComposition | null;
}): CompositionEvaluation {
  const photo = scorePhotographyPreservation(input);
  const contentQuiet =
    input.visual.negativeSpaceZones.find(
      (z) => z.id === input.visual.recommendedContentZone.zone,
    )?.quietness ?? 50;

  const imageImpact = clamp(
    input.visual.imageQuality * 0.55 + photo.visibility * 0.45,
  );
  const balance = clamp(
    contentQuiet * 0.5 +
      (input.visual.recommendedAlignment === "center" ? 70 : 78) * 0.25 +
      photo.subjectIntegrity * 0.25,
  );
  const textRelationship = clamp(
    contentQuiet * 0.6 +
      (input.visual.recommendedScrim?.enabled ? 75 : 68) * 0.4,
  );
  const ctaRelationship = clamp(
    (input.visual.recommendedCTAZone.alignment ===
    input.visual.recommendedAlignment
      ? 88
      : 70) *
      0.5 +
      contentQuiet * 0.5,
  );
  const negativeSpaceUse = clamp(contentQuiet);
  const visualHarmony = clamp(
    balance * 0.4 +
      photo.overall * 0.35 +
      (input.visual.preservePhotography ? 85 : 55) * 0.25,
  );

  const overall = clamp(
    imageImpact * 0.18 +
      balance * 0.14 +
      textRelationship * 0.14 +
      ctaRelationship * 0.12 +
      negativeSpaceUse * 0.14 +
      visualHarmony * 0.12 +
      photo.overall * 0.16,
  );

  const strengths: string[] = [];
  const weaknesses: string[] = [];
  const recommendedImprovements: string[] = [];

  if (photo.overall >= 80) {
    strengths.push("Photography stays visible and intentional");
  }
  if (contentQuiet >= 70) {
    strengths.push("Content sits in quieter negative space");
  }
  if (input.visual.overlayStrength <= 25) {
    strengths.push("Global overlay stays restrained");
  }
  if (
    input.visual.treatmentLadder.includes("blur") ||
    (input.composition?.treatment.textScrim?.blur ?? 0) >= 8
  ) {
    weaknesses.push("Blur is intruding on the photograph");
    recommendedImprovements.push(
      "Prefer placement and local scrim over large blur regions",
    );
  }
  if (input.visual.overlayStrength >= 50) {
    weaknesses.push("Overlay is still competing with the photograph");
    recommendedImprovements.push(
      "Move content into quieter space and reduce global overlay",
    );
  }
  if (contentQuiet < 50) {
    weaknesses.push("Text may still compete with high-detail imagery");
    recommendedImprovements.push(
      "Shift alignment toward the quietest negative-space zone",
    );
  }
  if (input.visual.imageQuality < 55) {
    weaknesses.push("Image quality or crop weakens first impression");
    recommendedImprovements.push(
      "Improve crop/fit so the subject reads clearly",
    );
  }
  if (recommendedImprovements.length === 0 && overall < 85) {
    recommendedImprovements.push(input.visual.decisionReason);
  }

  return {
    overall,
    imageImpact,
    balance,
    textRelationship,
    ctaRelationship,
    negativeSpaceUse,
    visualHarmony,
    photographyPreservation: photo,
    strengths,
    weaknesses,
    recommendedImprovements,
  };
}
