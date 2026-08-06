/**
 * Classify every transformation goal — never silently drop one.
 */

import type {
  ClassifiedTransformationGoal,
  TransformationGoalExecutionStatus,
} from "@/lib/transformation/execution-types";
import { mapTransformationGoalToOperations } from "@/lib/transformation/mapper";
import type {
  TransformationConflict,
  TransformationGoal,
  TransformationPlan,
} from "@/lib/transformation/types";
import type { BusinessProject } from "@/types/business-project";

function conflictsForGoal(
  goalId: TransformationGoal["id"],
  conflicts: TransformationConflict[],
): TransformationConflict | null {
  return (
    conflicts.find(
      (c) => c.severity === "high" && c.goalIds.includes(goalId),
    ) ?? null
  );
}

export function classifyTransformationGoals(input: {
  plan: TransformationPlan;
  project: BusinessProject;
}): ClassifiedTransformationGoal[] {
  const { plan, project } = input;
  const order = plan.graph.dependencyOrder;
  const byId = new Map(plan.goals.map((g) => [g.id, g]));
  const classified: ClassifiedTransformationGoal[] = [];

  for (const goalId of order) {
    const goal = byId.get(goalId);
    if (!goal) continue;
    const conflict = conflictsForGoal(goalId, plan.conflicts);
    const mapped = mapTransformationGoalToOperations(goal, project, {
      plan,
      conflictBlocked: Boolean(conflict),
      conflictReason: conflict?.explanation,
    });

    const classification: TransformationGoalExecutionStatus = mapped.ok
      ? mapped.status
      : mapped.status;

    classified.push({
      goalId,
      classification,
      reason: mapped.reason || "",
      operations: mapped.ok ? mapped.operations : [],
      affectedSections: goal.affectedSections,
    });
  }

  // Any goals missing from dependency order still must be classified.
  for (const goal of plan.goals) {
    if (classified.some((c) => c.goalId === goal.id)) continue;
    classified.push({
      goalId: goal.id,
      classification: "blocked_unsupported",
      reason: "Goal was missing from the dependency order.",
      operations: [],
      affectedSections: goal.affectedSections,
    });
  }

  return classified;
}
