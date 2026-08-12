/**
 * Canonical transformation dependency rules.
 */

import type {
  TransformationDependency,
  TransformationGoal,
  TransformationGoalId,
} from "@/lib/transformation/types";

/** Hard rules: later work must not precede earlier foundation work. */
export const CANONICAL_DEPENDENCIES: TransformationDependency[] = [
  {
    from: "set_page_direction",
    to: "strengthen_hero",
    reason: "Hero refinement should follow a clear page direction.",
  },
  {
    from: "set_page_direction",
    to: "clarify_services",
    reason: "Services redesign waits until direction is chosen.",
  },
  {
    from: "strengthen_hero",
    to: "establish_trust",
    reason: "Trust work follows a strong first impression.",
  },
  {
    from: "establish_trust",
    to: "sequence_proof_before_ask",
    reason: "Proof sequencing depends on trust strategy.",
  },
  {
    from: "establish_trust",
    to: "strengthen_proof",
    reason: "Proof assets support the trust phase.",
  },
  {
    from: "clarify_services",
    to: "strengthen_proof",
    reason: "Proof should demonstrate the clarified offer.",
  },
  {
    from: "strengthen_proof",
    to: "simplify_conversion",
    reason: "Do not strengthen CTA before building trust/proof.",
  },
  {
    from: "sequence_proof_before_ask",
    to: "simplify_conversion",
    reason: "Conversion path follows proof-before-ask sequencing.",
  },
  {
    from: "sequence_proof_before_ask",
    to: "clarify_primary_cta",
    reason: "CTA clarity follows proof-before-ask sequencing when both apply.",
  },
  {
    from: "clarify_primary_cta",
    to: "simplify_conversion",
    reason: "Broad conversion polish follows a verified primary CTA.",
  },
  {
    from: "simplify_conversion",
    to: "improve_rhythm",
    reason: "Rhythm polish comes after structural conversion fixes.",
  },
  {
    from: "clarify_primary_cta",
    to: "improve_rhythm",
    reason: "Rhythm polish comes after CTA clarity when conversion polish is skipped.",
  },
  {
    from: "clarify_visual_restraint",
    to: "improve_rhythm",
    reason: "Rhythm polish comes after restraint treatments are quieted.",
  },
  {
    from: "clarify_services",
    to: "tighten_messaging",
    reason: "Messaging cleanup follows offer clarity.",
  },
];

export function dependenciesForGoals(
  goals: TransformationGoal[],
): TransformationDependency[] {
  const ids = new Set(goals.map((g) => g.id));
  return CANONICAL_DEPENDENCIES.filter(
    (d) => ids.has(d.from) && ids.has(d.to),
  );
}

function topoSort(
  goals: TransformationGoal[],
  edges: TransformationDependency[],
  appendOrphans: boolean,
): TransformationGoalId[] {
  const ids = goals.map((g) => g.id);
  const indegree = new Map<TransformationGoalId, number>();
  const adj = new Map<TransformationGoalId, TransformationGoalId[]>();
  for (const id of ids) {
    indegree.set(id, 0);
    adj.set(id, []);
  }
  for (const e of edges) {
    if (!indegree.has(e.from) || !indegree.has(e.to)) continue;
    adj.get(e.from)!.push(e.to);
    indegree.set(e.to, (indegree.get(e.to) ?? 0) + 1);
  }

  const priority = new Map(goals.map((g, i) => [g.id, i]));
  const ready = ids
    .filter((id) => (indegree.get(id) ?? 0) === 0)
    .sort((a, b) => (priority.get(a) ?? 0) - (priority.get(b) ?? 0));

  const order: TransformationGoalId[] = [];
  while (ready.length) {
    const next = ready.shift()!;
    order.push(next);
    for (const child of adj.get(next) ?? []) {
      const d = (indegree.get(child) ?? 1) - 1;
      indegree.set(child, d);
      if (d === 0) {
        ready.push(child);
        ready.sort((a, b) => (priority.get(a) ?? 0) - (priority.get(b) ?? 0));
      }
    }
  }

  if (appendOrphans) {
    for (const id of ids) {
      if (!order.includes(id)) order.push(id);
    }
  }
  return order;
}

export function topologicalOrder(
  goals: TransformationGoal[],
  edges: TransformationDependency[],
): TransformationGoalId[] {
  return topoSort(goals, edges, true);
}

export function detectDependencyCycle(
  goals: TransformationGoal[],
  edges: TransformationDependency[],
): boolean {
  const sorted = topoSort(goals, edges, false);
  return sorted.length < goals.length;
}
