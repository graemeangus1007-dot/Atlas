/**
 * Coordinated roadmap from ranked opportunities + dependency order.
 */

import { resolveDependencyOrder } from "@/lib/strategy/dependencies";
import type {
  StrategicAssessment,
  StrategicConflict,
  StrategicOpportunity,
  StrategicRoadmapStep,
  WebsiteStateBand,
} from "@/lib/strategy/types";
import { STRATEGIC_DIRECTOR_VERSION } from "@/lib/strategy/types";
import {
  estimateBusinessImpact,
  rankOpportunities,
  selectRecommendedLeader,
} from "@/lib/strategy/priority";

export function buildStrategicRoadmap(
  opportunities: StrategicOpportunity[],
): StrategicRoadmapStep[] {
  // Prefer dependency-safe order among the top opportunities.
  const ranked = rankOpportunities(opportunities);
  const topIds = new Set(
    ranked
      .slice(0, 6)
      .map((r) => r.id),
  );
  const subset = opportunities.filter((o) => topIds.has(o.id));
  return resolveDependencyOrder(subset.length ? subset : opportunities);
}

export function buildStrategicSummary(input: {
  websiteState: WebsiteStateBand;
  highest: StrategicOpportunity | null;
  leader: StrategicAssessment["recommendedLeader"];
  conflicts: StrategicConflict[];
  blockedCount: number;
}): string {
  if (!input.highest) {
    if (input.websiteState === "excellent") {
      return "The site is already in strong shape — remaining work is refinement, not a foundational rebuild.";
    }
    if (input.blockedCount > 0) {
      return "The highest-impact improvements need real business input or unsupported capabilities before Atlas can execute them.";
    }
    return "No urgent strategic gaps stood out from the specialist evaluations.";
  }

  const leaderLabel = labelLeader(input.leader);
  const lines = [
    `The largest opportunity is ${input.highest.title.toLowerCase()} rather than lower-impact polish.`,
    input.highest.explanation,
    `${leaderLabel} should lead this work.`,
  ];

  if (input.conflicts[0]) {
    lines.push(`Conflict resolved: ${input.conflicts[0].recommendedResolution}`);
  }

  return lines.join(" ");
}

function labelLeader(leader: StrategicAssessment["recommendedLeader"]): string {
  switch (leader) {
    case "visual_composition":
      return "Visual Composition";
    case "conversion_director":
      return "Conversion Director";
    case "taste":
      return "Taste";
    case "creative_director":
      return "Creative Director";
    case "transformation":
      return "Transformation Engine";
    case "capability_gap":
      return "A capability gap (needs business input)";
    default:
      return "No specialist";
  }
}

export function assembleStrategicAssessment(input: {
  opportunities: StrategicOpportunity[];
  conflicts: StrategicConflict[];
  websiteState: WebsiteStateBand;
  confidence: number;
}): StrategicAssessment {
  const ranked = rankOpportunities(input.opportunities);
  const highest =
    ranked.find((r) => !r.opportunity.blocked)?.opportunity ??
    ranked[0]?.opportunity ??
    null;
  const recommendedLeader = selectRecommendedLeader(ranked);
  const executionSequence = buildStrategicRoadmap(input.opportunities);
  const blockedWork = input.opportunities.filter((o) => o.blocked);
  const estimatedBusinessImpact = estimateBusinessImpact(input.opportunities);

  return {
    version: STRATEGIC_DIRECTOR_VERSION,
    assessedAt: new Date().toISOString(),
    websiteState: input.websiteState,
    highestPriorityOpportunity: highest,
    recommendedLeader,
    executionSequence,
    blockedWork,
    conflictingRecommendations: input.conflicts,
    estimatedBusinessImpact,
    confidence: input.confidence,
    summary: buildStrategicSummary({
      websiteState: input.websiteState,
      highest,
      leader: recommendedLeader,
      conflicts: input.conflicts,
      blockedCount: blockedWork.length,
    }),
    opportunities: ranked.map((r) => r.opportunity),
    priorityRanking: ranked.map((r) => ({
      id: r.id,
      priorityScore: Math.round(r.priorityScore * 10) / 10,
      leader: r.leader,
    })),
  };
}
