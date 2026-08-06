/**
 * Group classified goals into atomic execution batches (dependency order preserved).
 */

import type {
  TransformationBatch,
  TransformationBatchId,
} from "@/lib/transformation/execution-types";
import type {
  TransformationGoalId,
  TransformationPhaseId,
  TransformationPlan,
} from "@/lib/transformation/types";

const BATCH_DEFS: Array<{
  id: TransformationBatchId;
  title: string;
  phaseIds: TransformationPhaseId[];
}> = [
  {
    id: "direction_hero",
    title: "Direction and first impression",
    phaseIds: ["direction", "first_impression"],
  },
  {
    id: "trust_proof",
    title: "Trust and proof",
    phaseIds: ["trust", "proof"],
  },
  {
    id: "offer_services",
    title: "Offer and services",
    phaseIds: ["offer"],
  },
  {
    id: "conversion",
    title: "Conversion path",
    phaseIds: ["conversion"],
  },
  {
    id: "polish",
    title: "Polish and rhythm",
    phaseIds: ["polish"],
  },
];

function phaseForGoal(
  plan: TransformationPlan,
  goalId: TransformationGoalId,
): TransformationPhaseId | null {
  const goal = plan.goals.find((g) => g.id === goalId);
  return goal?.phase ?? null;
}

/**
 * Build batches from dependencyOrder — never reorder goals inside the executor.
 */
export function buildExecutionBatches(
  plan: TransformationPlan,
  executableGoalIds: TransformationGoalId[],
): TransformationBatch[] {
  const executable = new Set(executableGoalIds);
  const order = plan.graph.dependencyOrder.filter((id) => executable.has(id));
  const batches: TransformationBatch[] = [];

  for (const def of BATCH_DEFS) {
    const goalIds = order.filter((id) => {
      const phase = phaseForGoal(plan, id);
      return phase != null && def.phaseIds.includes(phase);
    });
    if (goalIds.length === 0) continue;
    batches.push({
      id: def.id,
      title: def.title,
      phaseIds: def.phaseIds,
      goalIds,
    });
  }

  // Any remaining ordered goals → polish catch-all
  const placed = new Set(batches.flatMap((b) => b.goalIds));
  const remainder = order.filter((id) => !placed.has(id));
  if (remainder.length > 0) {
    const polish = batches.find((b) => b.id === "polish");
    if (polish) {
      polish.goalIds.push(...remainder);
    } else {
      batches.push({
        id: "polish",
        title: "Polish and rhythm",
        phaseIds: ["polish"],
        goalIds: remainder,
      });
    }
  }

  return batches;
}

export function batchOrderIds(batches: TransformationBatch[]): TransformationBatchId[] {
  return batches.map((b) => b.id);
}
