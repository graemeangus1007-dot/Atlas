/**
 * Rank transformation goals by impact, risk, dependencies, and effort.
 */

import type { CreativeDirectorEvaluation } from "@/lib/creative-director";
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
