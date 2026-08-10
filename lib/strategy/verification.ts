/**
 * Strategic assessment verification — invariants only, no re-scoring.
 */

import { executionOrderRespectsDependencies } from "@/lib/strategy/dependencies";
import { ownerAllowsDomain } from "@/lib/scope";
import type { IntelligenceOwner, RecommendationDomain } from "@/lib/scope/types";
import type { StrategicAssessment } from "@/lib/strategy/types";

export type StrategicVerificationResult = {
  ok: boolean;
  failures: string[];
};

const LEADER_TO_OWNER: Partial<
  Record<StrategicAssessment["recommendedLeader"], IntelligenceOwner>
> = {
  visual_composition: "visual_composition",
  conversion_director: "conversion_director",
  taste: "taste",
  creative_director: "creative_director",
  transformation: "transformation",
};

export function verifyStrategicAssessment(
  assessment: StrategicAssessment,
): StrategicVerificationResult {
  const failures: string[] = [];

  const highest = assessment.highestPriorityOpportunity;
  if (highest && !highest.blocked) {
    if (highest.leader !== assessment.recommendedLeader) {
      // capability_gap / none exceptions
      if (
        assessment.recommendedLeader !== "capability_gap" &&
        assessment.recommendedLeader !== "none"
      ) {
        failures.push("selected_leader_mismatch");
      }
    }

    // Prefer declared opportunity owner (e.g. benchmark) over leader mapping.
    const owner =
      highest.owner !== "capability_gap"
        ? (highest.owner as IntelligenceOwner)
        : LEADER_TO_OWNER[highest.leader];
    if (owner && highest.domain && isRecommendationDomain(highest.domain)) {
      if (!ownerAllowsDomain(owner, highest.domain)) {
        failures.push("leader_does_not_own_domain");
      }
    }
  }

  if (
    !executionOrderRespectsDependencies(
      assessment.executionSequence,
      assessment.opportunities,
    )
  ) {
    failures.push("dependency_order_violated");
  }

  for (const blocked of assessment.blockedWork) {
    if (!blocked.blocked) {
      failures.push("blocked_work_not_flagged");
    }
  }

  // Blocked items must not be the recommended leader unless everything is blocked.
  if (
    highest?.blocked &&
    assessment.opportunities.some((o) => !o.blocked) &&
    assessment.recommendedLeader !== "capability_gap"
  ) {
    failures.push("blocked_item_selected_as_leader");
  }

  const titles = assessment.opportunities.map((o) => o.title);
  if (new Set(titles).size !== titles.length) {
    failures.push("duplicated_recommendations");
  }

  const ids = assessment.opportunities.map((o) => o.id);
  if (new Set(ids).size !== ids.length) {
    failures.push("duplicated_opportunity_ids");
  }

  // Deterministic ranking: priorityRanking order matches opportunities order.
  for (let i = 0; i < assessment.priorityRanking.length; i++) {
    if (assessment.priorityRanking[i]?.id !== assessment.opportunities[i]?.id) {
      failures.push("priority_ranking_inconsistent");
      break;
    }
  }

  return { ok: failures.length === 0, failures };
}

const KNOWN_DOMAINS = new Set<string>([
  "spacing",
  "typography_hierarchy",
  "rhythm",
  "alignment",
  "restraint",
  "cta_proportion",
  "button_consistency",
  "visual_polish",
  "visual_direction",
  "section_sequencing",
  "hierarchy",
  "design_language",
  "narrative",
  "layout",
  "benchmark_comparison",
  "hero_composition",
  "transformation_execution",
  "trust",
  "cta",
  "offer",
  "objections",
  "proof",
  "friction",
  "urgency",
  "contact_flow",
  "lead_generation",
  "imagery",
]);

function isRecommendationDomain(value: string): value is RecommendationDomain {
  return KNOWN_DOMAINS.has(value);
}

export function logStrategicDiagnostics(input: {
  assessment: StrategicAssessment;
  requestId?: string | null;
}): void {
  if (process.env.NODE_ENV !== "development") return;
  const { assessment } = input;
  console.info("[atlas:strategic-director]", {
    requestId: input.requestId ?? null,
    selectedLeader: assessment.recommendedLeader,
    priorityRanking: assessment.priorityRanking,
    dependencyOrder: assessment.executionSequence.map((s) => s.opportunityId),
    blockedItems: assessment.blockedWork.map((b) => b.id),
    conflicts: assessment.conflictingRecommendations,
    estimatedBusinessImpact: assessment.estimatedBusinessImpact,
    confidence: assessment.confidence,
    websiteState: assessment.websiteState,
  });
}
