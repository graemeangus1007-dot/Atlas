/**
 * Preflight checks before any transformation mutation.
 */

import { detectDependencyCycle } from "@/lib/transformation/dependencies";
import { captureBrandScopeSnapshot } from "@/lib/transformation/brand-snapshot";
import { classifyTransformationGoals } from "@/lib/transformation/classify";
import type { TransformationPreflightReport } from "@/lib/transformation/execution-types";
import type { TransformationPlan } from "@/lib/transformation/types";
import type { BusinessProject } from "@/types/business-project";

export function runTransformationPreflight(input: {
  plan: TransformationPlan;
  project: BusinessProject;
}): TransformationPreflightReport {
  const issues: string[] = [];
  // Hard gates only — soft advisory validation issues must not block execution.
  const planValidationPassed =
    input.plan.validation.complete && input.plan.validation.dependencySafe;
  if (!input.plan.validation.complete) {
    issues.push("Plan is incomplete — vision or goals are missing.");
  }
  if (!input.plan.validation.dependencySafe) {
    issues.push("Dependency graph is not cycle-safe.");
  }

  const hasCycle = detectDependencyCycle(
    input.plan.goals,
    input.plan.graph.edges,
  );
  const highConflicts = input.plan.conflicts.filter((c) => c.severity === "high");
  const dependenciesSatisfiable = !hasCycle && highConflicts.length === 0;
  if (hasCycle) {
    issues.push("Dependency graph contains a cycle — execution is blocked.");
  }
  if (highConflicts.length > 0) {
    issues.push(
      `Unresolved conflict: ${highConflicts[0]!.explanation}`,
    );
  }

  let brandCaptured = false;
  try {
    captureBrandScopeSnapshot(input.project);
    brandCaptured = true;
  } catch {
    issues.push("Could not capture brand preservation snapshot.");
  }

  const revisionBaselineValid =
    Boolean(input.project.businessName?.trim()) &&
    Array.isArray(input.project.services);
  if (!revisionBaselineValid) {
    issues.push("Project baseline is incomplete.");
  }

  const classified = classifyTransformationGoals({
    plan: input.plan,
    project: input.project,
  });
  const readyGoalIds = classified
    .filter((c) => c.classification === "ready")
    .map((c) => c.goalId);
  const blockedGoalIds = classified
    .filter((c) =>
      c.classification.startsWith("blocked") ||
      c.classification === "deferred_high_risk",
    )
    .map((c) => c.goalId);

  if (readyGoalIds.length === 0 && blockedGoalIds.length === 0) {
    // All already satisfied is OK — preflight still passes.
  }

  const passed =
    planValidationPassed &&
    dependenciesSatisfiable &&
    brandCaptured &&
    revisionBaselineValid;

  return {
    passed,
    planValidationPassed,
    dependenciesSatisfiable,
    brandCaptured,
    revisionBaselineValid,
    issues,
    blockedGoalIds,
    readyGoalIds,
  };
}
