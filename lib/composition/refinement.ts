/**
 * Apply VisualComposition advice onto HeroComposition (consume, don't replace).
 */

import { ctaArrangementFromPlacement } from "@/lib/composition/content-placement";
import {
  evaluateVisualComposition,
  scorePhotographyPreservation,
} from "@/lib/composition/evaluator";
import { analyzeProjectVisualComposition } from "@/lib/composition/layout-selector";
import type {
  CompositionDiagnostics,
  VisualComposition,
} from "@/lib/composition/types";
import type { HeroComposition } from "@/lib/hero-composition/types";
import type { BusinessProject } from "@/types/business-project";

export type ApplyVisualCompositionResult = {
  composition: HeroComposition;
  visual: VisualComposition;
  diagnostics: CompositionDiagnostics;
  changed: boolean;
};

/**
 * Patch HeroComposition from VisualComposition recommendations.
 * Composition/placement/local contrast first; overlay is one treatment — not default.
 */
export function applyVisualCompositionToHero(input: {
  composition: HeroComposition;
  visual: VisualComposition;
}): HeroComposition {
  const { visual } = input;
  const next: HeroComposition = {
    ...input.composition,
    image: { ...input.composition.image },
    treatment: {
      ...input.composition.treatment,
      gradient: input.composition.treatment.gradient
        ? { ...input.composition.treatment.gradient }
        : null,
      textScrim: input.composition.treatment.textScrim
        ? { ...input.composition.treatment.textScrim }
        : null,
    },
    typography: { ...input.composition.typography },
    cta: { ...input.composition.cta },
    mobile: { ...input.composition.mobile },
    accents: { ...input.composition.accents },
  };

  // Placement before effects
  next.contentAlignment = visual.recommendedAlignment;
  next.verticalAlignment =
    visual.recommendedContentZone.verticalBias === "top"
      ? "top"
      : visual.recommendedContentZone.verticalBias === "bottom"
        ? "bottom"
        : "center";
  next.minHeight = visual.recommendedHeight;
  next.cta.alignment = visual.recommendedCTAZone.alignment;
  next.cta.arrangement = ctaArrangementFromPlacement(
    visual.recommendedCtaPlacement,
  );

  // Keep focal point from analysis when present
  next.image.focalPoint = { ...visual.focalPoint };

  // Treatments: prefer recommended ladder values; never introduce large blur.
  const overlayBefore = next.treatment.overlay;
  next.treatment.overlay = Math.min(
    overlayBefore,
    visual.overlayStrength,
  );
  // If VC wants even lower overlay for photo preservation, take it.
  if (visual.preservePhotography) {
    next.treatment.overlay = Math.min(next.treatment.overlay, visual.overlayStrength);
  }

  if (visual.recommendedGradient) {
    next.treatment.gradient = {
      direction: visual.recommendedGradient.direction,
      strength: visual.recommendedGradient.strength,
      coverage: visual.recommendedGradient.coverage,
    };
  }

  if (visual.recommendedScrim) {
    next.treatment.textScrim = {
      enabled: visual.recommendedScrim.enabled,
      opacity: visual.recommendedScrim.opacity,
      // Phase 1: do not blur by default
      blur: visual.recommendedScrim.blur ?? undefined,
    };
  } else if (visual.preservePhotography && (next.treatment.textScrim?.blur ?? 0) >= 8) {
    // Strip large blur when composition can carry readability
    next.treatment.textScrim = next.treatment.textScrim
      ? { ...next.treatment.textScrim, blur: undefined }
      : null;
  }

  return next;
}

/**
 * Analyze + apply VisualComposition onto a HeroComposition in one pass.
 */
export function refineHeroWithVisualComposition(input: {
  project: BusinessProject;
  composition: HeroComposition;
  aspectRatio?: number | null;
}): ApplyVisualCompositionResult {
  const overlayBefore =
    input.composition.treatment.overlay ?? input.project.heroOverlay ?? 50;

  const visual = analyzeProjectVisualComposition({
    project: input.project,
    composition: input.composition,
    aspectRatio: input.aspectRatio,
  });

  const next = applyVisualCompositionToHero({
    composition: input.composition,
    visual,
  });

  // Preserve pattern identity
  next.patternId = input.composition.patternId;
  next.version = input.composition.version;

  const evaluation = evaluateVisualComposition({
    visual,
    composition: next,
  });
  const photo = scorePhotographyPreservation({
    visual,
    composition: next,
  });

  const changed = JSON.stringify(next) !== JSON.stringify(input.composition);

  const diagnostics: CompositionDiagnostics = {
    compositionScore: evaluation.overall,
    negativeSpaceZones: visual.negativeSpaceZones,
    recommendedContentZone: visual.recommendedContentZone.zone,
    recommendedCTAZone: visual.recommendedCTAZone.zone,
    overlayBefore,
    overlayAfter: next.treatment.overlay,
    photographyPreservation: photo.overall,
    compositionDecision: visual.decisionReason,
    treatmentLadder: visual.treatmentLadder,
    blurSelected: Boolean(
      next.treatment.textScrim?.blur && next.treatment.textScrim.blur >= 6,
    ),
  };

  return {
    composition: next,
    visual,
    diagnostics,
    changed,
  };
}

export function logCompositionDiagnostics(
  diagnostics: CompositionDiagnostics,
  requestId?: string | null,
): void {
  if (process.env.NODE_ENV !== "development") return;
  console.info("[atlas:composition]", {
    requestId: requestId ?? null,
    compositionScore: diagnostics.compositionScore,
    negativeSpaceZones: diagnostics.negativeSpaceZones.map((z) => ({
      id: z.id,
      quietness: z.quietness,
    })),
    recommendedContentZone: diagnostics.recommendedContentZone,
    recommendedCTAZone: diagnostics.recommendedCTAZone,
    overlayBefore: diagnostics.overlayBefore,
    overlayAfter: diagnostics.overlayAfter,
    photographyPreservation: diagnostics.photographyPreservation,
    compositionDecision: diagnostics.compositionDecision,
    treatmentLadder: diagnostics.treatmentLadder,
    blurSelected: diagnostics.blurSelected,
  });
}
