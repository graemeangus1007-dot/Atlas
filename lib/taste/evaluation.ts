/**
 * Orchestrate Taste Engine scoring from project (+ optional CD/inventory).
 */

import type { CreativeDirectorEvaluation } from "@/lib/creative-director/types";
import type { PageSectionInventory } from "@/lib/creative-director/types";
import type { DesignQualityBand } from "@/lib/creative-director/score-calibration";
import { classifyDesignQualityBand } from "@/lib/creative-director/score-calibration";
import { scoreAlignmentQuality } from "@/lib/taste/alignment";
import { scoreComponentConsistency } from "@/lib/taste/consistency";
import { scoreCraftsmanship } from "@/lib/taste/craftsmanship";
import { TASTE_DIMENSIONS, tasteDimensionMeta } from "@/lib/taste/registry";
import { buildTasteRecommendations } from "@/lib/taste/recommendations";
import { scoreProportion } from "@/lib/taste/proportion";
import { scoreRestraint } from "@/lib/taste/restraint";
import { scoreVisualRhythm } from "@/lib/taste/rhythm";
import { scoreSpacingHarmony } from "@/lib/taste/spacing";
import { scoreTypographyHarmony } from "@/lib/taste/typography";
import { scoreVisualWeight } from "@/lib/taste/visual-weight";
import {
  TASTE_ENGINE_VERSION,
  type TasteDimensionId,
  type TasteDimensionScore,
  type TasteEvaluation,
  type TasteSignals,
} from "@/lib/taste/types";
import type { BusinessProject } from "@/types/business-project";

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function distinctColors(project: BusinessProject): number {
  const set = new Set(
    [
      project.primaryColor,
      project.secondaryColor,
      project.accentColor,
      project.backgroundColor,
    ]
      .filter(Boolean)
      .map((c) => c.trim().toLowerCase()),
  );
  return set.size;
}

export function collectTasteSignals(input: {
  project: BusinessProject;
  inventory?: PageSectionInventory | null;
  evaluation?: CreativeDirectorEvaluation | null;
}): TasteSignals {
  const { project, inventory: inv, evaluation: ev } = input;
  const polish = project.creativePolish;
  const hero = ev?.sections.find((s) => s.sectionId === "hero");

  return {
    spacing: inv?.spacing || polish?.spacing || "default",
    visualHierarchy:
      inv?.visualHierarchy ?? Boolean(polish?.visualHierarchy),
    headingFont: inv?.headingFont || project.headingFont || "inter",
    bodyFont: inv?.bodyFont || project.bodyFont || "inter",
    buttonStyle: inv?.buttonStyle || project.buttonStyle || "rounded",
    siteWidth: project.siteWidth || "boxed",
    templateId: project.templateId || "modern",
    primaryColor: project.primaryColor,
    secondaryColor: project.secondaryColor,
    accentColor: project.accentColor,
    backgroundColor: project.backgroundColor,
    heroOverlay: project.heroOverlay ?? 50,
    hasHeroTreatmentGradient: Boolean(project.heroTreatment?.gradient),
    hasHeroTreatmentScrim: Boolean(project.heroTreatment?.textScrim?.enabled),
    heroScrimBlur: project.heroTreatment?.textScrim?.blur ?? 0,
    hasHeroImage: inv?.hasHeroImage ?? Boolean(project.heroImageId),
    hasHeroPattern:
      inv?.hasHeroPattern ?? Boolean(project.heroComposition?.patternId),
    motionEnabled: Boolean(polish?.motion),
    hoverEffects: Boolean(polish?.hoverEffects),
    sectionReveal: Boolean(polish?.sectionReveal),
    serviceIcons: Boolean(polish?.serviceIcons),
    servicesCount: inv?.servicesCount ?? project.services?.length ?? 3,
    gallerySlots:
      inv?.gallerySlots ??
      (project.galleryImageIds ?? []).filter(Boolean).length,
    sectionCount: inv?.order?.length ?? project.sectionOrder?.length ?? 6,
    headlineLength: (inv?.heroHeadline || project.heroHeadline || "").length,
    subheadlineLength: (
      inv?.heroSubheadline ||
      project.heroSubheadline ||
      ""
    ).length,
    primaryCtaLength: (inv?.primaryCta || project.primaryCta || "").length,
    hasSecondaryCta: Boolean(project.secondaryCta?.trim()),
    heroCompositionScore: inv?.heroCompositionScore ?? null,
    visualCompositionScore: inv?.visualCompositionScore ?? null,
    photographyPreservation: inv?.photographyPreservation ?? null,
    cdVisualRhythm: ev?.dimensions.visualRhythm ?? ev?.rhythm.score ?? null,
    cdWhitespace: ev?.dimensions.whitespace ?? null,
    cdProfessionalism: ev?.dimensions.professionalism ?? null,
    cdConsistency: ev?.consistency.score ?? null,
    cdScanability: ev?.dimensions.scanability ?? null,
    cdFirstImpression: ev?.dimensions.firstImpression ?? null,
    sectionCadence: ev?.rhythm.cadence ?? [],
    heroVisualWeight: hero?.visualWeight ?? null,
    distinctBrandColors: distinctColors(project),
  };
}

/**
 * Taste may judge only after functional design is already sound.
 * Structure first — taste last.
 */
export function isTasteEligibleToJudge(input: {
  qualityBand?: DesignQualityBand | string | null;
  overallDesignScore?: number | null;
  majorWeaknessCount?: number;
  trustScore?: number | null;
  conversionScore?: number | null;
}): boolean {
  const band =
    input.qualityBand ??
    (input.overallDesignScore != null
      ? classifyDesignQualityBand(input.overallDesignScore)
      : "poor");
  if (band === "poor" || band === "developing") return false;
  if ((input.majorWeaknessCount ?? 0) > 0) return false;
  if ((input.trustScore ?? 100) < 55) return false;
  if ((input.conversionScore ?? 100) < 50) return false;
  return true;
}

function weightedOverall(
  scores: Record<TasteDimensionId, number>,
): number {
  let total = 0;
  let weight = 0;
  for (const meta of TASTE_DIMENSIONS) {
    total += scores[meta.id] * meta.weight;
    weight += meta.weight;
  }
  return clamp(weight > 0 ? total / weight : 50);
}

function buildDimension(
  id: TasteDimensionId,
  result: {
    score: number;
    strengths: string[];
    weaknesses: string[];
    explanation: string;
  },
): TasteDimensionScore {
  const meta = tasteDimensionMeta(id);
  return {
    id,
    score: result.score,
    label: meta.label,
    explanation: result.explanation,
    strengths: result.strengths,
    weaknesses: result.weaknesses,
  };
}

export function evaluateTaste(input: {
  project: BusinessProject;
  inventory?: PageSectionInventory | null;
  evaluation?: CreativeDirectorEvaluation | null;
  qualityBand?: DesignQualityBand | string | null;
  majorWeaknessCount?: number;
  eligibleToJudge?: boolean;
}): TasteEvaluation {
  const signals = collectTasteSignals(input);
  const spacing = scoreSpacingHarmony(signals);
  const typography = scoreTypographyHarmony(signals);
  const rhythm = scoreVisualRhythm(signals);
  const alignment = scoreAlignmentQuality(signals);
  const consistency = scoreComponentConsistency(signals);
  const weight = scoreVisualWeight(signals);
  const craft = scoreCraftsmanship(signals);
  const restraint = scoreRestraint(signals);
  const proportion = scoreProportion(signals);

  // CTA presence & scanability derived from signals + sibling scores
  const ctaPresence = (() => {
    let score = 62;
    const strengths: string[] = [];
    const weaknesses: string[] = [];
    if (signals.primaryCtaLength >= 8 && signals.primaryCtaLength <= 24) {
      score += 12;
      strengths.push("Primary CTA label is specific and scannable.");
    } else if (signals.primaryCtaLength === 0) {
      score -= 20;
      weaknesses.push("No primary CTA presence.");
    } else if (signals.primaryCtaLength > 28) {
      score -= 8;
      weaknesses.push("CTA wording is long enough to dilute presence.");
    }
    if (signals.hasSecondaryCta && !signals.visualHierarchy) {
      score -= 10;
      weaknesses.push("Secondary CTA competes when hierarchy is weak.");
    } else if (signals.hasSecondaryCta && signals.visualHierarchy) {
      score += 4;
    }
    if (signals.visualHierarchy) score += 8;
    return {
      score: clamp(score),
      strengths,
      weaknesses,
      explanation:
        weaknesses[0] ??
        strengths[0] ??
        "CTA presence is adequate.",
    };
  })();

  const scanability = (() => {
    let score = typography.score * 0.45 + rhythm.score * 0.25 + spacing.score * 0.3;
    const strengths: string[] = [];
    const weaknesses: string[] = [];
    if (signals.cdScanability != null) {
      score = score * 0.55 + signals.cdScanability * 0.45;
    }
    if (signals.visualHierarchy && signals.spacing !== "default") {
      strengths.push("Hierarchy and space make the page easy to scan.");
    }
    if (!signals.visualHierarchy) {
      weaknesses.push("Weak hierarchy slows a calm vertical scan.");
    }
    if (signals.sectionCount >= 9 && signals.spacing === "default") {
      score -= 10;
      weaknesses.push("Dense section stack hurts scanability.");
    }
    return {
      score: clamp(score),
      strengths,
      weaknesses,
      explanation:
        weaknesses[0] ??
        strengths[0] ??
        "Scanability is moderate.",
    };
  })();

  const polishScore = (() => {
    const base = clamp(
      craft.score * 0.35 +
        restraint.score * 0.25 +
        spacing.score * 0.2 +
        typography.score * 0.2,
    );
    const strengths: string[] = [];
    const weaknesses: string[] = [];
    if (base >= 78) {
      strengths.push("Finishing details coordinate into a polished whole.");
    } else {
      weaknesses.push("Polish still needs coordinated finishing across the page.");
    }
    return {
      score: base,
      strengths,
      weaknesses,
      explanation:
        weaknesses[0] ??
        strengths[0] ??
        "Polish is developing.",
    };
  })();

  const scoreMap: Record<TasteDimensionId, number> = {
    spacingHarmony: spacing.score,
    typographyHarmony: typography.score,
    visualRhythm: rhythm.score,
    alignmentQuality: alignment.score,
    componentConsistency: consistency.score,
    visualWeight: weight.score,
    craftsmanship: craft.score,
    restraint: restraint.score,
    proportion: proportion.score,
    ctaPresence: ctaPresence.score,
    scanability: scanability.score,
    polish: polishScore.score,
  };

  const dimensions: TasteDimensionScore[] = [
    buildDimension("spacingHarmony", spacing),
    buildDimension("typographyHarmony", typography),
    buildDimension("visualRhythm", rhythm),
    buildDimension("alignmentQuality", alignment),
    buildDimension("componentConsistency", consistency),
    buildDimension("visualWeight", weight),
    buildDimension("craftsmanship", craft),
    buildDimension("restraint", restraint),
    buildDimension("proportion", proportion),
    buildDimension("ctaPresence", ctaPresence),
    buildDimension("scanability", scanability),
    buildDimension("polish", polishScore),
  ];

  const overallTaste = weightedOverall(scoreMap);
  const sortedWeak = [...dimensions].sort((a, b) => a.score - b.score);
  const sortedStrong = [...dimensions].sort((a, b) => b.score - a.score);
  const highestPriorityImprovement =
    sortedWeak[0] && sortedWeak[0].score < 78
      ? sortedWeak[0].id
      : null;

  const strengths = sortedStrong
    .filter((d) => d.score >= 78)
    .slice(0, 4)
    .flatMap((d) => d.strengths.slice(0, 1));
  const weaknesses = sortedWeak
    .filter((d) => d.score < 72)
    .slice(0, 4)
    .flatMap((d) => d.weaknesses.slice(0, 1));

  const eligibleToJudge =
    input.eligibleToJudge ??
    isTasteEligibleToJudge({
      qualityBand: input.qualityBand,
      overallDesignScore: input.evaluation?.dimensions.overallDesignScore,
      majorWeaknessCount: input.majorWeaknessCount,
      trustScore: input.evaluation?.trust.score,
      conversionScore: input.evaluation?.conversion.score,
    });

  const recommendations = buildTasteRecommendations({
    dimensions,
    highestPriorityImprovement,
    signals,
  });

  // Confidence: more inventory/CD bridges → higher confidence
  let confidence = 0.72;
  if (input.inventory) confidence += 0.08;
  if (input.evaluation) confidence += 0.1;
  if (signals.heroCompositionScore != null) confidence += 0.04;
  confidence = Math.min(0.96, confidence);

  const summary = eligibleToJudge
    ? overallTaste >= 80
      ? "The site already feels professionally crafted — remaining taste work is refinement."
      : "Structure is sound enough for Taste to judge finishing, hierarchy, and restraint."
    : "Functional structure still needs work — Taste is advisory only until the foundation is solid.";

  return {
    version: TASTE_ENGINE_VERSION,
    evaluatedAt: new Date().toISOString(),
    overallTaste,
    spacingHarmony: scoreMap.spacingHarmony,
    typographyHarmony: scoreMap.typographyHarmony,
    visualRhythm: scoreMap.visualRhythm,
    alignmentQuality: scoreMap.alignmentQuality,
    componentConsistency: scoreMap.componentConsistency,
    visualWeight: scoreMap.visualWeight,
    craftsmanship: scoreMap.craftsmanship,
    restraint: scoreMap.restraint,
    proportion: scoreMap.proportion,
    ctaPresence: scoreMap.ctaPresence,
    scanability: scoreMap.scanability,
    polish: scoreMap.polish,
    dimensions,
    strengths: strengths.length
      ? strengths
      : sortedStrong.slice(0, 2).map((d) => d.explanation),
    weaknesses: weaknesses.length
      ? weaknesses
      : highestPriorityImprovement
        ? [sortedWeak[0]!.explanation]
        : [],
    highestPriorityImprovement,
    recommendations,
    confidence,
    eligibleToJudge,
    summary,
  };
}

/** Soft blend of taste into CD overall — only when eligible. */
export function blendTasteIntoDesignScore(
  overallDesignScore: number,
  taste: TasteEvaluation,
): number {
  if (!taste.eligibleToJudge) return overallDesignScore;
  // Taste is the final polish judge — small blend, never a takeover.
  return clamp(overallDesignScore * 0.9 + taste.overallTaste * 0.1);
}
