/**
 * Priority ranking — business impact + deps + confidence, never lowest score alone.
 */

import { laneOrder } from "@/lib/strategy/dependencies";
import type {
  StrategicLeader,
  StrategicOpportunity,
  StrategicOpportunityId,
  WebsiteStateBand,
} from "@/lib/strategy/types";

export function computePriorityScore(op: StrategicOpportunity): number {
  if (op.blocked) {
    // Blocked work stays visible but never wins leadership.
    return (
      op.businessImpact * 0.15 +
      op.expectedImprovement * 0.1 -
      40
    );
  }

  const gap = Math.max(0, 100 - op.sourceScore);
  // Prefer high business impact and expected lift; use gap as supporting signal only.
  return (
    op.businessImpact * 0.34 +
    op.expectedImprovement * 0.26 +
    op.implementationConfidence * 0.14 +
    op.verificationConfidence * 0.1 +
    gap * 0.12 -
    laneOrder(op.id) * 0.35
  );
}

export function rankOpportunities(
  opportunities: StrategicOpportunity[],
): Array<{
  id: StrategicOpportunityId;
  priorityScore: number;
  leader: StrategicLeader;
  opportunity: StrategicOpportunity;
}> {
  return opportunities
    .map((opportunity) => ({
      id: opportunity.id,
      priorityScore: computePriorityScore(opportunity),
      leader: opportunity.leader,
      opportunity,
    }))
    .sort((a, b) => {
      if (b.priorityScore !== a.priorityScore) {
        return b.priorityScore - a.priorityScore;
      }
      // Deterministic tie-break.
      if (a.opportunity.blocked !== b.opportunity.blocked) {
        return a.opportunity.blocked ? 1 : -1;
      }
      const lane = laneOrder(a.id) - laneOrder(b.id);
      if (lane !== 0) return lane;
      return a.id.localeCompare(b.id);
    });
}

export function selectRecommendedLeader(
  ranked: ReturnType<typeof rankOpportunities>,
): StrategicLeader {
  const top = ranked.find((r) => !r.opportunity.blocked);
  if (!top) {
    if (ranked.some((r) => r.leader === "capability_gap")) {
      return "capability_gap";
    }
    return ranked[0]?.leader ?? "none";
  }
  return top.leader;
}

export function inferWebsiteState(input: {
  overallDesign: number;
  overallConversion: number | null;
  overallTaste: number | null;
  visualOverall: number | null;
  hasBlockingGaps: boolean;
  openOpportunityCount: number;
}): WebsiteStateBand {
  if (input.hasBlockingGaps && input.openOpportunityCount === 0) {
    return "blocked";
  }
  if (input.hasBlockingGaps && input.overallDesign < 70) {
    return "blocked";
  }

  const scores = [
    input.overallDesign,
    input.overallConversion,
    input.overallTaste,
    input.visualOverall,
  ].filter((n): n is number => typeof n === "number");
  const avg =
    scores.reduce((a, b) => a + b, 0) / Math.max(1, scores.length);

  if (avg >= 82 && input.openOpportunityCount <= 1) return "excellent";
  if (avg >= 70) return "developing";
  return "weak";
}

export function estimateBusinessImpact(
  opportunities: StrategicOpportunity[],
): number {
  const open = opportunities.filter((o) => !o.blocked);
  if (!open.length) return 0;
  const top = [...open].sort(
    (a, b) => b.businessImpact - a.businessImpact,
  )[0];
  const second = open[1]?.businessImpact ?? 0;
  return Math.round(
    Math.min(100, top.businessImpact * 0.7 + second * 0.3),
  );
}
