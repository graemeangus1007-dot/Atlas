/**
 * Dependency resolution — foundations before polish.
 * Example: hero composition → readability → CTA → spacing polish.
 */

import type {
  StrategicOpportunity,
  StrategicOpportunityId,
  StrategicRoadmapStep,
} from "@/lib/strategy/types";

/** Canonical dependency lanes (earlier index = earlier work). */
export const DEPENDENCY_LANE: readonly StrategicOpportunityId[] = [
  "hero_composition",
  "hero_readability",
  "layout_structure",
  "narrative",
  "trust",
  "proof",
  "cta",
  "contact_flow",
  "benchmark_gap",
  "spacing_polish",
  "visual_polish",
  "capability_gap",
] as const;

const LANE_INDEX = new Map(
  DEPENDENCY_LANE.map((id, index) => [id, index] as const),
);

/** Default dependsOn edges when extracting opportunities. */
export function defaultDependsOn(
  id: StrategicOpportunityId,
): StrategicOpportunityId[] {
  switch (id) {
    case "hero_readability":
      return ["hero_composition"];
    case "cta":
      return ["hero_readability", "trust"];
    case "proof":
      return ["trust"];
    case "contact_flow":
      return ["proof", "cta"];
    case "spacing_polish":
      return ["hero_composition", "hero_readability", "cta"];
    case "visual_polish":
      return ["spacing_polish", "narrative"];
    case "narrative":
      return ["hero_composition"];
    case "layout_structure":
      return ["hero_composition"];
    case "benchmark_gap":
      return ["narrative", "trust"];
    default:
      return [];
  }
}

export function laneOrder(id: StrategicOpportunityId): number {
  return LANE_INDEX.get(id) ?? 50;
}

/**
 * Order opportunities so dependencies come first.
 * Blocked items remain in sequence but marked blocked.
 */
export function resolveDependencyOrder(
  opportunities: StrategicOpportunity[],
): StrategicRoadmapStep[] {
  const byId = new Map(opportunities.map((o) => [o.id, o]));
  const selected = new Set(opportunities.map((o) => o.id));

  const ready: StrategicOpportunity[] = [];
  const remaining = [...opportunities];

  const depsSatisfied = (op: StrategicOpportunity) =>
    op.dependsOn.every((d) => !selected.has(d) || ready.some((r) => r.id === d));

  while (remaining.length > 0) {
    const nextBatch = remaining
      .filter(depsSatisfied)
      .sort(
        (a, b) =>
          laneOrder(a.id) - laneOrder(b.id) || a.title.localeCompare(b.title),
      );
    if (nextBatch.length === 0) {
      // Cycle / missing dep — fall back to lane order.
      remaining.sort(
        (a, b) =>
          laneOrder(a.id) - laneOrder(b.id) || a.title.localeCompare(b.title),
      );
      ready.push(...remaining);
      break;
    }
    for (const op of nextBatch) {
      ready.push(op);
      const idx = remaining.findIndex((r) => r.id === op.id);
      if (idx >= 0) remaining.splice(idx, 1);
    }
  }

  return ready.map((op, index) => ({
    order: index + 1,
    opportunityId: op.id,
    title: op.title,
    leader: op.leader,
    blocked: op.blocked,
  })).filter((step) => byId.has(step.opportunityId));
}

/** True when execution order respects declared dependsOn. */
export function executionOrderRespectsDependencies(
  sequence: StrategicRoadmapStep[],
  opportunities: StrategicOpportunity[],
): boolean {
  const position = new Map(
    sequence.map((s) => [s.opportunityId, s.order] as const),
  );
  for (const op of opportunities) {
    const selfPos = position.get(op.id);
    if (selfPos == null) continue;
    for (const dep of op.dependsOn) {
      const depPos = position.get(dep);
      if (depPos != null && depPos >= selfPos) return false;
    }
  }
  return true;
}
