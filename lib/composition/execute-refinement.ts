/**
 * Hero-local visual composition refinement — no site-wide redesign.
 */

import { HERO_OVERLAY_STEPS, type HeroOverlayStep } from "@/data/design-options";
import type { EditOperation } from "@/lib/ai/edit-operations";
import { validateEditOperations } from "@/lib/ai/validate-edit-operations";
import {
  isExecutableHeroPatternId,
  mirrorHeroCompositionToLegacyFields,
  type ExecutableHeroPatternId,
} from "@/lib/ai/hero-pattern-application";
import {
  analyzeProjectVisualComposition,
  evaluateVisualComposition,
  refineHeroWithVisualComposition,
  scorePhotographyPreservation,
} from "@/lib/composition";
import type { CompositionDiagnostics } from "@/lib/composition/types";
import {
  resolveHeroCompositionFromProject,
  type HeroComposition,
} from "@/lib/hero-composition";
import type { BusinessProject } from "@/types/business-project";

export type VisualCompositionRefinementGoals = {
  preservePhotography: boolean;
  improveReadability: boolean;
  relocateContent: boolean;
  reduceBlur: boolean;
};

export type VisualCompositionRefinementPlan = {
  operations: EditOperation[];
  compositionBefore: HeroComposition;
  compositionAfter: HeroComposition;
  diagnostics: CompositionDiagnostics & {
    photographyPreservationBefore: number;
    photographyPreservationAfter: number;
    contentZoneBefore: string;
    contentZoneAfter: string;
    blurBefore: number;
    blurAfter: number;
  };
  explanation: string;
  brandBefore: {
    primaryColor: string;
    accentColor: string;
    secondaryColor: string;
    backgroundColor: string;
    headingFont: string;
    bodyFont: string;
  };
};

function snapOverlay(value: number): HeroOverlayStep {
  let best: HeroOverlayStep = HERO_OVERLAY_STEPS[0]!;
  let bestDist = Infinity;
  for (const step of HERO_OVERLAY_STEPS) {
    const dist = Math.abs(step - value);
    if (dist < bestDist) {
      best = step;
      bestDist = dist;
    }
  }
  return best;
}

function forcePhotographyFirst(composition: HeroComposition): HeroComposition {
  const next: HeroComposition = {
    ...composition,
    treatment: {
      ...composition.treatment,
      gradient: composition.treatment.gradient
        ? { ...composition.treatment.gradient }
        : null,
      textScrim: composition.treatment.textScrim
        ? { ...composition.treatment.textScrim }
        : null,
    },
    cta: { ...composition.cta },
  };
  // Remove blur — last resort, never keep broad blur on corrective path.
  if (next.treatment.textScrim) {
    next.treatment.textScrim = {
      enabled: true,
      opacity: Math.min(0.22, next.treatment.textScrim.opacity ?? 0.2),
    };
  }
  next.treatment.overlay = Math.min(next.treatment.overlay, 25);
  // Keep CTA attached to the copy cluster
  next.cta.alignment = next.contentAlignment;
  return next;
}

export function planVisualCompositionRefinement(input: {
  project: BusinessProject;
  goals?: Partial<VisualCompositionRefinementGoals>;
  request?: string;
}): VisualCompositionRefinementPlan {
  const goals: VisualCompositionRefinementGoals = {
    preservePhotography: true,
    improveReadability: true,
    relocateContent: true,
    reduceBlur: true,
    ...input.goals,
  };

  const compositionBefore = resolveHeroCompositionFromProject(input.project);
  const visualBefore = analyzeProjectVisualComposition({
    project: input.project,
    composition: compositionBefore,
  });
  const photoBefore = scorePhotographyPreservation({
    visual: visualBefore,
    composition: compositionBefore,
  });
  const blurBefore = compositionBefore.treatment.textScrim?.blur ?? 0;

  const refined = refineHeroWithVisualComposition({
    project: input.project,
    composition: compositionBefore,
  });
  const compositionAfter = forcePhotographyFirst(refined.composition);
  // Preserve pattern identity
  compositionAfter.patternId = compositionBefore.patternId;
  compositionAfter.version = compositionBefore.version;
  if (compositionBefore.patternId) {
    compositionAfter.layout = compositionBefore.layout;
    compositionAfter.mobile = { ...compositionBefore.mobile };
  }

  // Relocate content into quieter zone from VisualComposition
  if (goals.relocateContent) {
    compositionAfter.contentAlignment =
      refined.visual.recommendedAlignment;
    compositionAfter.verticalAlignment =
      refined.visual.recommendedContentZone.verticalBias === "top"
        ? "top"
        : refined.visual.recommendedContentZone.verticalBias === "bottom"
          ? "bottom"
          : "center";
    compositionAfter.cta.alignment = compositionAfter.contentAlignment;
  }

  if (goals.reduceBlur && compositionAfter.treatment.textScrim) {
    compositionAfter.treatment.textScrim = {
      enabled: true,
      opacity: Math.min(0.2, compositionAfter.treatment.textScrim.opacity ?? 0.18),
    };
  }

  if (goals.preservePhotography) {
    compositionAfter.treatment.overlay = Math.min(
      compositionAfter.treatment.overlay,
      25,
    );
  }

  // Prefer a light directional gradient over blur/wash
  if (
    goals.improveReadability &&
    !compositionAfter.treatment.gradient &&
    refined.visual.recommendedGradient
  ) {
    compositionAfter.treatment.gradient = {
      direction: refined.visual.recommendedGradient.direction,
      strength: Math.min(0.36, refined.visual.recommendedGradient.strength),
      coverage: Math.min(0.52, refined.visual.recommendedGradient.coverage),
    };
  }

  const visualAfter = analyzeProjectVisualComposition({
    project: input.project,
    composition: compositionAfter,
  });
  const photoAfter = scorePhotographyPreservation({
    visual: visualAfter,
    composition: compositionAfter,
  });
  const blurAfter = compositionAfter.treatment.textScrim?.blur ?? 0;

  const patternId = compositionAfter.patternId;
  let operations: EditOperation[];
  if (patternId && isExecutableHeroPatternId(patternId)) {
    operations = validateEditOperations([
      {
        operation: "applyHeroPattern",
        patternId: patternId as ExecutableHeroPatternId,
        composition: compositionAfter,
      },
    ]);
  } else {
    operations = validateEditOperations([
      {
        operation: "setHeroOverlay",
        value: snapOverlay(compositionAfter.treatment.overlay),
      },
      {
        operation: "setHeroTreatment",
        gradient: compositionAfter.treatment.gradient,
        textScrim: compositionAfter.treatment.textScrim
          ? {
              enabled: compositionAfter.treatment.textScrim.enabled,
              opacity: compositionAfter.treatment.textScrim.opacity,
              // omit blur
            }
          : null,
        textPosition: compositionAfter.contentAlignment,
      },
    ]);
  }

  const explanation = [
    "I removed the broad blur and moved the hero copy into a quieter part of the photo.",
    "I kept a small localized contrast treatment behind the text so the photo remains clear and the headline stays readable.",
  ].join(" ");

  return {
    operations,
    compositionBefore,
    compositionAfter,
    diagnostics: {
      ...refined.diagnostics,
      photographyPreservationBefore: photoBefore.overall,
      photographyPreservationAfter: photoAfter.overall,
      contentZoneBefore: visualBefore.recommendedContentZone.zone,
      contentZoneAfter: visualAfter.recommendedContentZone.zone,
      blurBefore,
      blurAfter,
      overlayBefore: compositionBefore.treatment.overlay,
      overlayAfter: compositionAfter.treatment.overlay,
      compositionDecision: explanation,
    },
    explanation,
    brandBefore: {
      primaryColor: input.project.primaryColor,
      accentColor: input.project.accentColor,
      secondaryColor: input.project.secondaryColor,
      backgroundColor: input.project.backgroundColor,
      headingFont: input.project.headingFont,
      bodyFont: input.project.bodyFont,
    },
  };
}

export function applyVisualCompositionRefinementPlan(
  project: BusinessProject,
  plan: VisualCompositionRefinementPlan,
  applyOps: (
    project: BusinessProject,
    ops: EditOperation[],
  ) => { project: BusinessProject; changes: import("@/lib/ai/edit-operations").EditChangeSummary[] },
): {
  project: BusinessProject;
  changes: import("@/lib/ai/edit-operations").EditChangeSummary[];
  verified: boolean;
  failures: string[];
} {
  const applied = applyOps(project, plan.operations);
  // Ensure HeroComposition + legacy mirrors stay aligned (esp. legacy op path).
  const synced = mirrorHeroCompositionToLegacyFields(
    applied.project,
    plan.compositionAfter,
  );
  const failures = verifyVisualCompositionRefinement({
    before: project,
    after: synced,
    plan,
  });
  return {
    project: synced,
    changes: applied.changes,
    verified: failures.length === 0,
    failures,
  };
}

export function verifyVisualCompositionRefinement(input: {
  before: BusinessProject;
  after: BusinessProject;
  plan: VisualCompositionRefinementPlan;
}): string[] {
  const failures: string[] = [];
  if (input.before.heroImageId !== input.after.heroImageId) {
    failures.push("hero_asset_changed");
  }
  if (input.before.primaryColor !== input.after.primaryColor) {
    failures.push("brand_primary_changed");
  }
  if (input.before.headingFont !== input.after.headingFont) {
    failures.push("typography_changed");
  }
  if (
    JSON.stringify(input.before.sectionOrder) !==
    JSON.stringify(input.after.sectionOrder)
  ) {
    failures.push("section_order_changed");
  }
  if (
    JSON.stringify(input.before.creativePolish) !==
    JSON.stringify(input.after.creativePolish)
  ) {
    failures.push("motion_or_polish_changed");
  }
  if (
    input.plan.compositionBefore.patternId &&
    input.after.heroComposition?.patternId !==
      input.plan.compositionBefore.patternId
  ) {
    failures.push("pattern_identity_changed");
  }

  const afterComp = resolveHeroCompositionFromProject(input.after);
  const blurAfter = afterComp.treatment.textScrim?.blur ?? 0;
  if (blurAfter >= (input.plan.diagnostics.blurBefore || 0) && blurAfter >= 6) {
    failures.push("blur_not_reduced");
  }
  if (afterComp.treatment.overlay > 50) {
    failures.push("overlay_still_heavy");
  }

  const visual = analyzeProjectVisualComposition({
    project: input.after,
    composition: afterComp,
  });
  const photo = scorePhotographyPreservation({
    visual,
    composition: afterComp,
  });
  if (photo.overall + 1 < input.plan.diagnostics.photographyPreservationBefore) {
    failures.push("photography_preservation_regressed");
  }

  // Readability proxy — some local contrast must remain
  const hasLocal =
    Boolean(afterComp.treatment.textScrim?.enabled) ||
    Boolean(afterComp.treatment.gradient) ||
    afterComp.treatment.overlay > 0;
  if (!hasLocal && photo.overall < 50) {
    failures.push("readability_risk");
  }

  void evaluateVisualComposition;
  return failures;
}

export function logVisualCompositionRoutingDiagnostics(input: {
  requestId?: string | null;
  detectedIntent: string;
  activeTaskKind: string | null;
  target: string;
  explanationOnly: boolean;
  visualCompositionOwner: boolean;
  blurBefore?: number;
  blurAfter?: number;
  contentZoneBefore?: string;
  contentZoneAfter?: string;
  photographyPreservationBefore?: number;
  photographyPreservationAfter?: number;
  wholeSiteReviewTriggered: boolean;
  unrelatedDomainsChanged: boolean;
  verified: boolean;
}): void {
  if (process.env.NODE_ENV !== "development") return;
  console.info("[atlas:visual-composition:routing]", input);
}
