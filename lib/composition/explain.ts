/**
 * Deterministic hero composition explanations from resolved render state.
 */

import {
  analyzeProjectVisualComposition,
  evaluateVisualComposition,
  scorePhotographyPreservation,
} from "@/lib/composition";
import type { VisualComposition } from "@/lib/composition/types";
import { resolveHeroCompositionFromProject } from "@/lib/hero-composition";
import type { BusinessProject } from "@/types/business-project";

export function explainHeroComposition(
  project: BusinessProject,
  visualComposition?: VisualComposition | null,
): string {
  const composition = resolveHeroCompositionFromProject(project);
  const visual =
    visualComposition ??
    analyzeProjectVisualComposition({ project, composition });
  const evaluation = evaluateVisualComposition({ visual, composition });
  const photo = evaluation.photographyPreservation;

  const blur =
    composition.treatment.textScrim?.blur ??
    project.heroTreatment?.textScrim?.blur ??
    0;
  const overlay =
    composition.treatment.overlay ?? project.heroOverlay ?? 50;
  const scrim =
    composition.treatment.textScrim ?? project.heroTreatment?.textScrim;
  const gradient =
    composition.treatment.gradient ?? project.heroTreatment?.gradient;
  const zone = visual.recommendedContentZone.zone.replace(/_/g, " ");
  const textAlign = composition.contentAlignment;
  const vertical = composition.verticalAlignment;

  const parts: string[] = [];

  if (blur && blur >= 6) {
    parts.push(
      `The ${vertical === "bottom" || zone.includes("lower") ? "lower part" : "text area"} was blurred as a readability treatment behind the hero copy.`,
    );
    parts.push(
      "It made the text easier to read, but it hides too much of the photo.",
    );
  } else if (overlay >= 50) {
    parts.push(
      `A broad overlay (about ${overlay}%) was darkening the hero as a readability wash.`,
    );
    parts.push(
      "That helps the headline contrast, but it covers too much of the photograph.",
    );
  } else if (scrim?.enabled && (scrim.opacity ?? 0) >= 0.28) {
    parts.push(
      "A text scrim is sitting behind the hero copy to keep the words readable.",
    );
    if ((scrim.opacity ?? 0) >= 0.35) {
      parts.push(
        "At the current strength it still covers more of the photo than it needs to.",
      );
    }
  } else if (gradient && (gradient.coverage ?? 0) >= 0.55) {
    parts.push(
      `A ${gradient.direction}-weighted gradient is adding contrast behind the copy.`,
    );
  } else {
    parts.push(
      "The hero is using localized contrast so the headline stays readable on the photo.",
    );
  }

  parts.push(
    `A better solution is to keep the image clear, move the copy into a quieter part of the photo (${zone}, ${textAlign}-aligned), and use only localized contrast behind the text.`,
  );

  if (photo.overall < 75) {
    parts.push(
      `Right now photography preservation is only ${photo.overall}/100 — composition should improve that without another full-frame treatment.`,
    );
  }

  return parts.join(" ");
}

export function explainHeroCompositionShort(project: BusinessProject): string {
  return explainHeroComposition(project);
}

/** Snapshot metrics for diagnostics / verification. */
export function captureHeroCompositionExplainSnapshot(project: BusinessProject) {
  const composition = resolveHeroCompositionFromProject(project);
  const visual = analyzeProjectVisualComposition({ project, composition });
  const photo = scorePhotographyPreservation({ visual, composition });
  return {
    blur: composition.treatment.textScrim?.blur ?? 0,
    overlay: composition.treatment.overlay,
    contentZone: visual.recommendedContentZone.zone,
    ctaZone: visual.recommendedCTAZone.zone,
    alignment: composition.contentAlignment,
    photographyPreservation: photo.overall,
    decision: visual.decisionReason,
  };
}
