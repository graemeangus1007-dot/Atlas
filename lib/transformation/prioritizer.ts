/**
 * Rank transformation goals by impact, risk, dependencies, and effort.
 */

import type { CreativeDirectorEvaluation } from "@/lib/creative-director";
import { benchmarkGapToThemes } from "@/lib/benchmarks";
import type { TransformationGoal } from "@/lib/transformation/types";

const PRIORITY_WEIGHT = { critical: 40, high: 28, medium: 16, low: 8 };
const RISK_PENALTY = { low: 0, medium: 6, high: 14 };
const EFFORT_PENALTY = { low: 0, medium: 4, high: 9 };

export function scoreTransformationGoal(
  goal: TransformationGoal,
  evaluation?: CreativeDirectorEvaluation | null,
): number {
  let score =
    PRIORITY_WEIGHT[goal.priority] +
    goal.expectedImprovement * 1.2 +
    goal.visitorImpact * 0.8 +
    goal.visualImpact * 0.6 -
    RISK_PENALTY[goal.risk] -
    EFFORT_PENALTY[goal.effort];

  // Fewer unresolved dependencies → earlier
  score -= goal.dependencies.length * 3;

  // Required assets increase risk of delay
  score -= goal.requiredAssets.length * 2;

  if (evaluation) {
    const top = evaluation.recommendations.slice(0, 3);
    for (const rec of top) {
      if (
        (rec.theme === "trust" && goal.theme === "trust") ||
        (rec.theme === "proof" && goal.theme === "proof") ||
        (rec.theme === "conversion" && goal.theme === "conversion") ||
        (rec.theme === "flow" &&
          (goal.theme === "flow" || goal.theme === "proof")) ||
        (rec.theme === "imagery" && goal.theme === "proof") ||
        (rec.theme === "hierarchy" && goal.theme === "hero")
      ) {
        score += 10 + rec.estimatedImpact * 0.15;
      }
    }
    // Prioritize the weakest observable dimensions over already-strong areas
    const dims = evaluation.dimensions;
    const weakest = (
      [
        ["trust", dims.trust],
        ["firstImpression", dims.firstImpression],
        ["narrativeFlow", dims.narrativeFlow],
        ["conversion", dims.conversion],
        ["professionalism", dims.professionalism],
      ] as Array<[string, number]>
    ).sort((a, b) => a[1] - b[1])[0];
    if (weakest) {
      if (
        weakest[0] === "trust" &&
        (goal.theme === "trust" || goal.theme === "proof" || goal.theme === "flow")
      ) {
        score += 14;
      }
      if (weakest[0] === "firstImpression" && goal.theme === "hero") {
        score += 14;
      }
      if (weakest[0] === "narrativeFlow" && goal.theme === "flow") {
        score += 12;
      }
      if (weakest[0] === "conversion" && goal.theme === "conversion") {
        score += 10;
      }
    }
    if (
      evaluation.trust.score < 55 &&
      (goal.theme === "trust" || goal.theme === "proof")
    ) {
      score += 12;
    }
    if (
      evaluation.conversion.score < 55 &&
      goal.theme === "conversion" &&
      evaluation.trust.score >= 60
    ) {
      score += 8;
    }
    // Deprioritize goals that target already-strong dimensions
    if (goal.theme === "hero" && dims.firstImpression >= 85) score -= 20;
    if (goal.theme === "trust" && dims.trust >= 80) score -= 18;
    if (goal.theme === "conversion" && dims.conversion >= 80) score -= 12;
    if (goal.theme === "rhythm" && (evaluation.rhythm.score ?? 0) >= 75) {
      score -= 16;
    }

    // Advisory: prioritize goals that close the largest benchmark quality gap.
    // Never treats the benchmark as a layout/brand template to copy.
    const gap = evaluation.benchmarkComparison?.highestGap;
    if (gap && gap.gap >= 6) {
      const themes = benchmarkGapToThemes(gap.dimension);
      const themeHit =
        themes.includes(goal.theme as (typeof themes)[number]) ||
        (goal.theme === "hero" && themes.includes("hero")) ||
        (goal.theme === "proof" && themes.includes("proof"));
      if (themeHit) {
        score += Math.min(16, 6 + Math.round(gap.gap * 0.35));
      }
    }

    // Weak photography / composition → prefer hero composition refinement early.
    const photo =
      evaluation.benchmarkComparison?.dimensionMatches.find(
        (d) => d.dimension === "imagery_quality" || d.dimension === "hero_quality",
      )?.siteScore ?? evaluation.dimensions.firstImpression;
    if (
      goal.id === "strengthen_hero" &&
      (photo < 75 || evaluation.dimensions.firstImpression < 75)
    ) {
      score += 10;
    }
  }

  return score;
}

export function prioritizeTransformationGoals(
  goals: TransformationGoal[],
  evaluation?: CreativeDirectorEvaluation | null,
): TransformationGoal[] {
  return [...goals].sort(
    (a, b) =>
      scoreTransformationGoal(b, evaluation) -
      scoreTransformationGoal(a, evaluation),
  );
}
