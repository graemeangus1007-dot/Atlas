/**
 * Build the transformation execution graph (planning only).
 */

import {
  dependenciesForGoals,
  topologicalOrder,
} from "@/lib/transformation/dependencies";
import type {
  TransformationDependency,
  TransformationGoal,
  TransformationGraph,
  TransformationGraphNode,
  TransformationPhase,
  TransformationPhaseId,
} from "@/lib/transformation/types";

const PHASE_META: Record<
  TransformationPhaseId,
  { title: string; intent: string; order: number }
> = {
  direction: {
    title: "Direction",
    intent: "Lock the website vision before structural edits.",
    order: 0,
  },
  first_impression: {
    title: "First impression",
    intent: "Strengthen the opening promise and hero composition.",
    order: 1,
  },
  trust: {
    title: "Trust",
    intent: "Earn belief before asking for contact.",
    order: 2,
  },
  offer: {
    title: "Offer",
    intent: "Clarify what visitors can buy or request.",
    order: 3,
  },
  proof: {
    title: "Proof",
    intent: "Show evidence that the promise is real.",
    order: 4,
  },
  conversion: {
    title: "Conversion",
    intent: "Simplify the path to the next step.",
    order: 5,
  },
  polish: {
    title: "Polish",
    intent: "Refine rhythm, messaging, and finishing craft.",
    order: 6,
  },
};

export function buildTransformationPhases(
  goals: TransformationGoal[],
): TransformationPhase[] {
  const byPhase = new Map<TransformationPhaseId, TransformationGoal[]>();
  for (const goal of goals) {
    const list = byPhase.get(goal.phase) ?? [];
    list.push(goal);
    byPhase.set(goal.phase, list);
  }
  return [...byPhase.entries()]
    .sort(
      (a, b) =>
        (PHASE_META[a[0]]?.order ?? 99) - (PHASE_META[b[0]]?.order ?? 99),
    )
    .map(([id, phaseGoals]) => ({
      id,
      title: PHASE_META[id].title,
      intent: PHASE_META[id].intent,
      goalIds: phaseGoals.map((g) => g.id),
    }));
}

export function buildTransformationGraph(
  goals: TransformationGoal[],
  edges?: TransformationDependency[],
): TransformationGraph {
  const dependencies = edges ?? dependenciesForGoals(goals);
  const dependencyOrder = topologicalOrder(goals, dependencies);

  const unlocks = new Map<string, string[]>();
  for (const e of dependencies) {
    const list = unlocks.get(e.from) ?? [];
    list.push(e.to);
    unlocks.set(e.from, list);
  }

  const nodes: TransformationGraphNode[] = goals.map((g) => ({
    goalId: g.id,
    phase: g.phase,
    dependsOn: g.dependencies.filter((d) =>
      goals.some((x) => x.id === d),
    ),
    unlocks: (unlocks.get(g.id) ?? []) as TransformationGraphNode["unlocks"],
  }));

  return {
    nodes,
    edges: dependencies,
    dependencyOrder,
  };
}
