/**
 * One-pass hero composition refinement (P1.5).
 * Preserves pattern identity, brand, and image — only improves execution.
 */

import {
  classifyImageAspect,
  compositionScorePasses,
  evaluateHeroComposition,
  HERO_COMPOSITION_PASS_THRESHOLD,
  readHeroImageAspectRatio,
  type HeroCompositionEvaluation,
  type HeroImageAspectClass,
} from "@/lib/hero-composition/evaluator";
import type {
  HeroComposition,
  HeroMinHeight,
} from "@/lib/hero-composition/types";
import type { BusinessProject } from "@/types/business-project";

export type HeroCompositionRefineDiagnostics = {
  compositionScore: number;
  imageImpact: number;
  readability: number;
  balance: number;
  heroHeightDecision: string;
  safeZoneDecision: string;
  refinementApplied: boolean;
  refinementReason: string | null;
  finalPattern: string | null;
  scoreBefore: number;
  scoreAfter: number;
  aspectClass: HeroImageAspectClass;
  problemsBefore: string[];
  problemsAfter: string[];
  initialCompositionScore?: number;
  finalCompositionScore?: number;
  initialImageImpact?: number;
  finalImageImpact?: number;
  shallowStripDetected?: boolean;
  deadRegionDetected?: boolean;
  contentClusterScore?: number;
  selectedRefinement?: string | null;
  professionalCompromiseUsed?: boolean;
  verificationFailures?: string[];
};

export type RefineHeroCompositionResult = {
  composition: HeroComposition;
  evaluation: HeroCompositionEvaluation;
  diagnostics: HeroCompositionRefineDiagnostics;
  refined: boolean;
};

function bumpHeight(h: HeroMinHeight): HeroMinHeight {
  if (h === "short") return "medium";
  if (h === "medium") return "tall";
  if (h === "tall") return "viewport";
  return "viewport";
}

function applyPatternRules(
  composition: HeroComposition,
  aspect: HeroImageAspectClass,
  project: Pick<
    BusinessProject,
    "heroHeadline" | "primaryCta" | "secondaryCta" | "heroImageId"
  >,
): HeroComposition {
  const pattern = composition.patternId ?? "";
  const next: HeroComposition = {
    ...composition,
    image: { ...composition.image },
    treatment: {
      ...composition.treatment,
      gradient: composition.treatment.gradient
        ? { ...composition.treatment.gradient }
        : null,
      textScrim: composition.treatment.textScrim
        ? { ...composition.treatment.textScrim }
        : null,
    },
    typography: { ...composition.typography },
    cta: { ...composition.cta },
    mobile: { ...composition.mobile },
    accents: { ...composition.accents },
  };

  // Never allow contain banner strips for photo-led patterns.
  if (
    next.image.fit === "contain" &&
    (pattern === "hero.cinematic_full_width" ||
      pattern === "hero.coastal_service" ||
      pattern === "hero.contractor_left")
  ) {
    next.image.fit = "cover";
  }

  // Aspect-aware height / crop
  if (aspect === "panoramic") {
    next.minHeight = bumpHeight(
      next.minHeight === "short" ? "medium" : next.minHeight,
    );
    if (next.minHeight !== "viewport") next.minHeight = "tall";
    if (pattern === "hero.cinematic_full_width") next.minHeight = "viewport";
    next.image.fit = "cover";
    next.image.zoom = Math.max(next.image.zoom, 1.05);
    next.mobile = {
      ...next.mobile,
      minHeight: next.mobile.minHeight === "short" ? "medium" : next.mobile.minHeight,
    };
  } else if (aspect === "portrait") {
    next.image.fit = "cover";
    next.image.focalPoint = {
      x: 0.5,
      y: Math.min(0.55, Math.max(0.35, next.image.focalPoint.y)),
    };
    next.image.zoom = Math.min(1.2, Math.max(1.05, next.image.zoom));
  } else if (aspect === "square") {
    next.minHeight =
      next.minHeight === "short" ? "medium" : next.minHeight;
    next.image.fit = "cover";
    next.contentWidth =
      next.contentWidth === "wide" ? "medium" : next.contentWidth;
  }

  // Local contrast before global overlay
  const overlay = next.treatment.overlay;
  if (overlay >= 50) {
    next.treatment.overlay = Math.min(overlay, 25);
    next.treatment.textScrim = {
      enabled: true,
      opacity: Math.max(0.28, next.treatment.textScrim?.opacity ?? 0.28),
      blur: next.treatment.textScrim?.blur ?? 6,
    };
    next.treatment.gradient = {
      direction: next.treatment.gradient?.direction ?? "bottom",
      strength: Math.max(0.4, next.treatment.gradient?.strength ?? 0.4),
      coverage: Math.max(0.55, next.treatment.gradient?.coverage ?? 0.55),
    };
  } else if (!next.treatment.textScrim?.enabled && !next.treatment.gradient) {
    next.treatment.gradient = {
      direction: "bottom",
      strength: 0.32,
      coverage: 0.52,
    };
    next.treatment.textScrim = {
      enabled: true,
      opacity: 0.2,
      blur: 4,
    };
  }

  // Pattern-specific professional rules
  if (pattern === "hero.cinematic_full_width") {
    next.minHeight = "viewport";
    next.verticalAlignment = "bottom";
    next.contentAlignment =
      next.contentAlignment === "right" ? "center" : next.contentAlignment;
    next.contentWidth = "medium";
    next.typography = {
      ...next.typography,
      headingScale:
        (project.heroHeadline || "").trim().length > 72 ? "lg" : "xl",
      showSecondaryCta: false,
    };
    next.cta = {
      arrangement: "row",
      alignment: next.contentAlignment,
      primaryEmphasis: "strong",
    };
    next.treatment.overlay = Math.min(next.treatment.overlay, 25);
    // Localized lower-third contrast — never a full-frame grey wash.
    next.treatment.gradient = {
      direction: "bottom",
      strength: 0.38,
      coverage: 0.48,
    };
    next.treatment.textScrim = {
      enabled: true,
      opacity: 0.22,
      blur: 6,
    };
    next.image.fit = "cover";
    next.image.zoom = Math.min(next.image.zoom, 1.08);
    next.mobile = { layout: "keep_overlay", minHeight: "tall" };
  }

  if (pattern === "hero.coastal_service") {
    next.minHeight = next.minHeight === "viewport" ? "medium" : next.minHeight;
    if (next.minHeight === "short") next.minHeight = "medium";
    next.treatment.overlay = Math.min(next.treatment.overlay, 25);
    next.treatment.gradient = {
      direction: "bottom",
      strength: 0.28,
      coverage: 0.5,
    };
    // Prefer light treatment — scrim only if needed
    if ((next.treatment.textScrim?.opacity ?? 0) > 0.25) {
      next.treatment.textScrim = {
        enabled: true,
        opacity: 0.18,
        blur: 4,
      };
    }
    next.verticalAlignment = "center";
    next.contentAlignment =
      next.contentAlignment === "center" ? "left" : next.contentAlignment;
    next.cta.alignment = next.contentAlignment;
    next.cta.primaryEmphasis = "default";
    next.accents = { showAccentWash: true, showGrid: false };
  }

  if (pattern === "hero.contractor_left") {
    next.contentAlignment = "left";
    next.cta.alignment = "left";
    next.cta.arrangement = "row";
    next.cta.primaryEmphasis = "strong";
    next.verticalAlignment = "center";
    next.minHeight =
      next.minHeight === "short" || next.minHeight === "medium"
        ? "tall"
        : next.minHeight;
    next.treatment.gradient = {
      direction: "left",
      strength: 0.52,
      coverage: 0.68,
    };
    next.treatment.textScrim = {
      enabled: true,
      opacity: 0.28,
      blur: 4,
    };
    next.treatment.overlay = Math.min(Math.max(next.treatment.overlay, 25), 50);
    next.mobile = { layout: "stack_copy_first", minHeight: "medium" };
    next.typography.showSecondaryCta = Boolean(project.secondaryCta?.trim());
  }

  if (pattern === "hero.premium_minimal") {
    next.layout = "contained";
    next.minHeight = "short";
    next.contentAlignment = "center";
    next.verticalAlignment = "center";
    next.contentWidth = "narrow";
    next.typography = {
      headingScale: "sm",
      headingWeight: 500,
      bodyScale: "sm",
      showSecondaryCta: false,
    };
    next.cta = {
      arrangement: "stack",
      alignment: "center",
      primaryEmphasis: "quiet",
    };
    next.treatment = {
      overlay: project.heroImageId ? Math.min(next.treatment.overlay, 25) : 0,
      gradient: project.heroImageId
        ? { direction: "bottom", strength: 0.22, coverage: 0.45 }
        : null,
      textScrim: null,
    };
    next.accents = { showAccentWash: false, showGrid: false };
    next.mobile = { layout: "keep_overlay", minHeight: "short" };
  }

  // CTA always shares copy alignment (belongs to the hero)
  next.cta.alignment = next.contentAlignment;

  // Long / short headline adaptations
  const hl = (project.heroHeadline || "").trim().length;
  if (hl > 72 && next.typography.headingScale === "xl") {
    next.typography.headingScale = "lg";
  }
  if (hl < 18 && pattern === "hero.cinematic_full_width") {
    next.typography.headingScale = "xl";
    next.contentWidth = "medium";
  }

  // Large CTA label → stack for cohesion
  if ((project.primaryCta || "").trim().length > 26) {
    next.cta.arrangement = "stack";
  }

  return next;
}

/**
 * One refinement pass: apply professional pattern rules, re-score, keep the better.
 * Never iterates beyond this single candidate comparison.
 */
export function refineHeroComposition(input: {
  project: BusinessProject;
  composition: HeroComposition;
  aspectRatio?: number | null;
}): RefineHeroCompositionResult {
  const aspectRatio =
    input.aspectRatio ?? readHeroImageAspectRatio(input.project);
  const aspectClass = classifyImageAspect(aspectRatio);

  const beforeEval = evaluateHeroComposition({
    composition: input.composition,
    project: input.project,
    aspectRatio,
  });

  const candidate = applyPatternRules(
    input.composition,
    aspectClass,
    input.project,
  );
  // Preserve identity
  candidate.patternId = input.composition.patternId;
  candidate.version = input.composition.version;

  const afterEval = evaluateHeroComposition({
    composition: candidate,
    project: input.project,
    aspectRatio,
  });

  // Keep the polished candidate whenever it does not regress the score.
  const keepRefined = afterEval.overallScore >= beforeEval.overallScore;

  const chosen = keepRefined ? candidate : input.composition;
  const chosenEval = keepRefined ? afterEval : beforeEval;
  const changed =
    keepRefined &&
    JSON.stringify(chosen) !== JSON.stringify(input.composition);

  const shallow = (problems: string[]) =>
    problems.some((p) =>
      [
        "shallow_image_strip",
        "banner_strip_contain",
        "contain_mode_breaks_composition",
        "image_utilization_too_low",
      ].includes(p),
    );
  const dead = (problems: string[]) =>
    problems.some((p) =>
      ["dead_overlay_region", "excessive_non_image_hero_area"].includes(p),
    );
  const clusterScore = (evaluation: HeroCompositionEvaluation) => {
    let score = 80;
    if (evaluation.problems.includes("content_detached_from_image")) score -= 25;
    if (evaluation.problems.includes("cta_detached_from_copy")) score -= 20;
    if (evaluation.problems.includes("headline_on_visual_boundary")) score -= 20;
    if (evaluation.problems.includes("detached_cta")) score -= 15;
    return Math.max(0, score);
  };

  return {
    composition: chosen,
    evaluation: chosenEval,
    refined: changed,
    diagnostics: {
      compositionScore: chosenEval.overallScore,
      imageImpact: chosenEval.imageImpact,
      readability: chosenEval.readability,
      balance: chosenEval.balance,
      heroHeightDecision: chosenEval.heroHeightDecision,
      safeZoneDecision: chosenEval.safeZoneDecision,
      refinementApplied: changed,
      refinementReason: changed
        ? `Composition polish ${beforeEval.overallScore} → ${afterEval.overallScore} (threshold ${HERO_COMPOSITION_PASS_THRESHOLD}).`
        : compositionScorePasses(beforeEval.overallScore)
          ? null
          : `Refinement did not improve score (${beforeEval.overallScore} → ${afterEval.overallScore}).`,
      finalPattern: chosen.patternId,
      scoreBefore: beforeEval.overallScore,
      scoreAfter: afterEval.overallScore,
      aspectClass,
      problemsBefore: beforeEval.problems,
      problemsAfter: afterEval.problems,
      initialCompositionScore: beforeEval.overallScore,
      finalCompositionScore: chosenEval.overallScore,
      initialImageImpact: beforeEval.imageImpact,
      finalImageImpact: chosenEval.imageImpact,
      shallowStripDetected: shallow(chosenEval.problems),
      deadRegionDetected: dead(chosenEval.problems),
      contentClusterScore: clusterScore(chosenEval),
      selectedRefinement: changed ? "pattern_professional_rules" : null,
      professionalCompromiseUsed: false,
      verificationFailures: [],
    },
  };
}

export function logHeroCompositionDiagnostics(
  diagnostics: HeroCompositionRefineDiagnostics & {
    requestId?: string | null;
  },
): void {
  if (typeof console === "undefined" || !console.info) return;
  console.info("[atlas:hero-composition]", {
    requestId: diagnostics.requestId ?? null,
    compositionScore: diagnostics.compositionScore,
    imageImpact: diagnostics.imageImpact,
    readability: diagnostics.readability,
    balance: diagnostics.balance,
    heroHeightDecision: diagnostics.heroHeightDecision,
    safeZoneDecision: diagnostics.safeZoneDecision,
    refinementApplied: diagnostics.refinementApplied,
    refinementReason: diagnostics.refinementReason,
    finalPattern: diagnostics.finalPattern,
    scoreBefore: diagnostics.scoreBefore,
    scoreAfter: diagnostics.scoreAfter,
    aspectClass: diagnostics.aspectClass,
    initialCompositionScore: diagnostics.initialCompositionScore ?? null,
    finalCompositionScore: diagnostics.finalCompositionScore ?? null,
    initialImageImpact: diagnostics.initialImageImpact ?? null,
    finalImageImpact: diagnostics.finalImageImpact ?? null,
    shallowStripDetected: diagnostics.shallowStripDetected ?? false,
    deadRegionDetected: diagnostics.deadRegionDetected ?? false,
    contentClusterScore: diagnostics.contentClusterScore ?? null,
    selectedRefinement: diagnostics.selectedRefinement ?? null,
    professionalCompromiseUsed:
      diagnostics.professionalCompromiseUsed ?? false,
    verificationFailures: diagnostics.verificationFailures ?? [],
  });
}
