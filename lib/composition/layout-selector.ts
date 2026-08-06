/**
 * Compose the canonical VisualComposition from metadata (+ optional pixel hints).
 */

import { planContrastTreatments } from "@/lib/composition/contrast-zones";
import {
  recommendCtaPlacement,
  recommendHeroHeight,
} from "@/lib/composition/content-placement";
import { analyzeImageComposition } from "@/lib/composition/image-analysis";
import { determineSafeZones } from "@/lib/composition/safe-zones";
import {
  VISUAL_COMPOSITION_VERSION,
  type CompositionAnalysisInput,
  type VisualComposition,
} from "@/lib/composition/types";
import type { HeroComposition } from "@/lib/hero-composition/types";
import type { BusinessProject } from "@/types/business-project";

export function compositionInputFromProject(
  project: BusinessProject,
  composition?: HeroComposition | null,
): CompositionAnalysisInput {
  const media = project.mediaLibrary.find((a) => a.id === project.heroImageId);
  const aspectFromMeta =
    media &&
    typeof (media as { width?: number }).width === "number" &&
    typeof (media as { height?: number }).height === "number" &&
    (media as { height: number }).height > 0
      ? (media as { width: number }).width /
        (media as { height: number }).height
      : null;

  return {
    hasHeroImage: Boolean(project.heroImageId),
    aspectRatio: aspectFromMeta,
    focalPoint: composition?.image.focalPoint ??
      project.heroImagePresentation?.focalPoint ??
      null,
    imageFit:
      composition?.image.fit ??
      (project.heroImagePresentation?.fit === "full"
        ? "cover"
        : project.heroImagePresentation?.fit) ??
      null,
    imagePosition:
      composition?.image.position ??
      project.heroImagePresentation?.position ??
      null,
    zoom: composition?.image.zoom ?? project.heroImagePresentation?.zoom ?? null,
    patternId: composition?.patternId ?? null,
    layout: composition?.layout ?? null,
    legacyLayoutKey: composition?.legacyLayoutKey ?? null,
    currentOverlay:
      composition?.treatment.overlay ?? project.heroOverlay ?? null,
    currentScrimBlur: composition?.treatment.textScrim?.blur ?? null,
    hasSecondaryCta: Boolean(project.secondaryCta?.trim()),
    headlineLength: (project.heroHeadline || "").trim().length,
    ctaLength: (project.primaryCta || "").trim().length,
    industry: project.businessType || null,
    pixelAnalysis: null,
  };
}

/**
 * Build VisualComposition — the reusable analysis layer.
 */
export function buildVisualComposition(
  input: CompositionAnalysisInput,
): VisualComposition {
  const analysis = analyzeImageComposition(input);
  const zones = determineSafeZones({ analysis, compositionInput: input });
  const quietness =
    zones.negativeSpaceZones.find((z) => z.id === zones.contentZone.zone)
      ?.quietness ?? 55;

  const contrast = planContrastTreatments({
    analysis,
    compositionInput: input,
    contentZone: zones.contentZone,
    quietness,
  });

  const recommendedHeight = recommendHeroHeight(analysis, input);
  const recommendedCtaPlacement = recommendCtaPlacement({
    compositionInput: input,
    contentZone: zones.contentZone,
    ctaZone: zones.ctaZone,
  });

  return {
    version: VISUAL_COMPOSITION_VERSION,
    imageQuality: analysis.imageQuality,
    subjectLocation: analysis.subjectLocation,
    focalPoint: analysis.focalPoint,
    negativeSpaceZones: zones.negativeSpaceZones,
    recommendedContentZone: zones.contentZone,
    recommendedCTAZone: zones.ctaZone,
    recommendedAlignment: zones.contentZone.alignment,
    recommendedHeight,
    recommendedGradient: contrast.recommendedGradient,
    recommendedScrim: contrast.recommendedScrim,
    overlayStrength: contrast.overlayStrength,
    preservePhotography: contrast.preservePhotography,
    confidence: analysis.confidence,
    recommendedCtaPlacement,
    treatmentLadder: contrast.treatmentLadder,
    decisionReason: contrast.decisionReason,
    pixelAnalysis: input.pixelAnalysis ?? null,
  };
}

export function analyzeProjectVisualComposition(input: {
  project: BusinessProject;
  composition?: HeroComposition | null;
  aspectRatio?: number | null;
  pixelAnalysis?: CompositionAnalysisInput["pixelAnalysis"];
}): VisualComposition {
  const base = compositionInputFromProject(
    input.project,
    input.composition,
  );
  return buildVisualComposition({
    ...base,
    aspectRatio: input.aspectRatio ?? base.aspectRatio,
    pixelAnalysis: input.pixelAnalysis ?? null,
  });
}
