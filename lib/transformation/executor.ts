/**
 * Transformation Engine Phase 2 — guarded coordinated execution.
 * Consumes TransformationPlan; never invents ops outside the allowlist.
 */

import { applyEditOperations } from "@/lib/ai/apply-edit-operations";
import { createRevisionId } from "@/lib/ai/editor-revisions";
import type { EditChangeSummary, EditOperation } from "@/lib/ai/edit-operations";
import { validateEditOperations } from "@/lib/ai/validate-edit-operations";
import {
  brandIntegrityViolations,
  captureBrandScopeSnapshot,
} from "@/lib/transformation/brand-snapshot";
import { buildExecutionBatches } from "@/lib/transformation/batches";
import { classifyTransformationGoals } from "@/lib/transformation/classify";
import type {
  TransformationBatchResult,
  TransformationExecutionDiagnostics,
  TransformationExecutionResult,
  TransformationExecutorInput,
  TransformationGoalResult,
} from "@/lib/transformation/execution-types";
import { mapTransformationGoalToOperations } from "@/lib/transformation/mapper";
import { runTransformationPreflight } from "@/lib/transformation/preflight";
import { maybeRefineTransformation } from "@/lib/transformation/refinement";
import {
  formatTransformationExecutionReport,
  transformationPlanId,
} from "@/lib/transformation/report";
import {
  overallDesignScore,
  verifyBatchIntegrity,
  verifyGoalAgainstProject,
  verifyWholePageTransformation,
} from "@/lib/transformation/verify";
import { buildTransformationPlanForProject } from "@/lib/transformation/plan-from-project";
import type {
  TransformationGoalId,
  TransformationPlan,
} from "@/lib/transformation/types";
import type { BusinessProject } from "@/types/business-project";

function cloneProject(project: BusinessProject): BusinessProject {
  return JSON.parse(JSON.stringify(project)) as BusinessProject;
}

function logDiagnostics(diag: TransformationExecutionDiagnostics): void {
  if (process.env.NODE_ENV !== "development") return;
  console.info("[atlas:transformation:execution]", {
    planId: diag.planId,
    baselineScore: diag.baselineScore,
    preflightStatus: diag.preflightStatus,
    goalStatuses: diag.goalStatuses,
    dependencyOrder: diag.dependencyOrder,
    batchOrder: diag.batchOrder,
    operationsByGoal: diag.operationsByGoal,
    verificationByBatch: diag.verificationByBatch,
    finalScore: diag.finalScore,
    scoreDelta: diag.scoreDelta,
    refinementApplied: diag.refinementApplied,
    blockedReasons: diag.blockedReasons,
    rollbackPerformed: diag.rollbackPerformed,
  });
}

function goalById(plan: TransformationPlan, id: TransformationGoalId) {
  return plan.goals.find((g) => g.id === id)!;
}

function dependenciesSatisfied(
  goalId: TransformationGoalId,
  plan: TransformationPlan,
  outcomes: Map<TransformationGoalId, TransformationGoalResult>,
): boolean {
  const goal = goalById(plan, goalId);
  for (const dep of goal.dependencies) {
    const outcome = outcomes.get(dep);
    if (!outcome) return false;
    if (
      outcome.status !== "applied" &&
      outcome.status !== "already_satisfied" &&
      outcome.status !== "skipped"
    ) {
      return false;
    }
  }
  return true;
}

/**
 * Execute a validated transformation plan in dependency order.
 */
export function executeTransformationPlan(
  input: TransformationExecutorInput,
): TransformationExecutionResult {
  const plan = input.plan;
  const planId = transformationPlanId(plan.createdAt, plan.version);
  const baselineProject = cloneProject(input.project);
  const brand = captureBrandScopeSnapshot(baselineProject);
  const baselineScore = overallDesignScore(baselineProject);
  const preflight = runTransformationPreflight({
    plan,
    project: baselineProject,
  });

  const emptyWholePage = {
    passed: false,
    baselineScore,
    finalScore: baselineScore,
    verifiedScoreDelta: 0,
    highestPriorityImproved: false,
    accessibilityRegression: false,
    brandIntegrityRegression: false,
    criticalDependencyFailed: false,
    notes: preflight.issues,
  };

  if (!preflight.passed) {
    const classified = classifyTransformationGoals({
      plan,
      project: baselineProject,
    });
    const blockedGoals: TransformationGoalResult[] = classified.map((c) => ({
      goalId: c.goalId,
      objective: goalById(plan, c.goalId).objective,
      classification: c.classification,
      status: "blocked" as const,
      operations: [],
      affectedSections: c.affectedSections,
      verification: { passed: false, scoreContribution: 0, notes: [] },
      reason: c.reason || preflight.issues[0] || "Preflight blocked execution.",
    }));
    const result: TransformationExecutionResult = {
      planId,
      status: "blocked",
      baselineScore,
      finalScore: baselineScore,
      verifiedScoreDelta: 0,
      executedGoals: [],
      blockedGoals,
      failedGoals: [],
      revisionsCreated: [],
      refinementApplied: false,
      summary: "",
      project: baselineProject,
      operations: [],
      changes: [],
      baselineProject,
      preflight,
      wholePage: emptyWholePage,
      batchResults: [],
      rollbackPerformed: false,
    };
    result.summary = formatTransformationExecutionReport(result);
    if (input.logDiagnostics) {
      logDiagnostics({
        planId,
        baselineScore,
        preflightStatus: false,
        goalStatuses: blockedGoals.map((g) => ({
          goalId: g.goalId,
          classification: g.classification,
          status: g.status,
        })),
        dependencyOrder: plan.graph.dependencyOrder,
        batchOrder: [],
        operationsByGoal: {},
        verificationByBatch: {},
        finalScore: baselineScore,
        scoreDelta: 0,
        refinementApplied: false,
        blockedReasons: preflight.issues,
        rollbackPerformed: false,
      });
    }
    return result;
  }

  const outcomes = new Map<TransformationGoalId, TransformationGoalResult>();
  const executedGoals: TransformationGoalResult[] = [];
  const blockedGoals: TransformationGoalResult[] = [];
  const failedGoals: TransformationGoalResult[] = [];
  const revisionsCreated: string[] = [];
  const batchResults: TransformationBatchResult[] = [];
  const allOps: EditOperation[] = [];
  const allChanges: EditChangeSummary[] = [];
  const operationsByGoal: Record<string, string[]> = {};
  const verificationByBatch: Record<string, boolean> = {};
  let project = baselineProject;
  let rollbackPerformed = false;
  let criticalDependencyFailed = false;
  let stopFurtherBatches = false;

  // Initial classification for reporting non-ready goals
  const initialClassified = classifyTransformationGoals({
    plan,
    project: baselineProject,
  });
  const readyOrSatisfied = initialClassified
    .filter(
      (c) =>
        c.classification === "ready" || c.classification === "already_satisfied",
    )
    .map((c) => c.goalId);

  for (const c of initialClassified) {
    if (
      c.classification === "ready" ||
      c.classification === "already_satisfied"
    ) {
      continue;
    }
    const result: TransformationGoalResult = {
      goalId: c.goalId,
      objective: goalById(plan, c.goalId).objective,
      classification: c.classification,
      status:
        c.classification === "deferred_high_risk" ? "deferred" : "blocked",
      operations: [],
      affectedSections: c.affectedSections,
      verification: { passed: false, scoreContribution: 0, notes: [] },
      reason: c.reason,
    };
    outcomes.set(c.goalId, result);
    blockedGoals.push(result);
  }

  const batches = buildExecutionBatches(plan, readyOrSatisfied);

  for (const batch of batches) {
    if (stopFurtherBatches) break;

    const batchBefore = cloneProject(project);
    const revisionId = createRevisionId();
    const appliedInBatch: TransformationGoalId[] = [];
    const batchOps: EditOperation[] = [];
    let batchFailed = false;
    const batchNotes: string[] = [];

    for (const goalId of batch.goalIds) {
      // Skip goals already recorded as blocked in initial pass
      if (outcomes.has(goalId) && outcomes.get(goalId)!.status === "blocked") {
        continue;
      }
      if (outcomes.has(goalId) && outcomes.get(goalId)!.status === "deferred") {
        continue;
      }

      const goal = goalById(plan, goalId);
      if (!dependenciesSatisfied(goalId, plan, outcomes)) {
        const deferred: TransformationGoalResult = {
          goalId,
          objective: goal.objective,
          classification: "deferred_high_risk",
          status: "deferred",
          operations: [],
          affectedSections: goal.affectedSections,
          verification: { passed: false, scoreContribution: 0, notes: [] },
          reason:
            "Waiting on a prerequisite goal that did not complete successfully.",
          batchId: batch.id,
        };
        outcomes.set(goalId, deferred);
        blockedGoals.push(deferred);
        continue;
      }

      const highConflict = plan.conflicts.find(
        (c) => c.severity === "high" && c.goalIds.includes(goalId),
      );
      const mapped = mapTransformationGoalToOperations(goal, project, {
        plan,
        conflictBlocked: Boolean(highConflict),
        conflictReason: highConflict?.explanation,
      });

      if (!mapped.ok) {
        const blocked: TransformationGoalResult = {
          goalId,
          objective: goal.objective,
          classification: mapped.status,
          status: mapped.status === "deferred_high_risk" ? "deferred" : "blocked",
          operations: [],
          affectedSections: goal.affectedSections,
          verification: { passed: false, scoreContribution: 0, notes: [] },
          reason: mapped.reason,
          batchId: batch.id,
        };
        outcomes.set(goalId, blocked);
        blockedGoals.push(blocked);
        if (goal.priority === "critical") {
          criticalDependencyFailed = true;
          stopFurtherBatches = true;
          batchFailed = true;
        }
        continue;
      }

      if (mapped.status === "already_satisfied") {
        const satisfied: TransformationGoalResult = {
          goalId,
          objective: goal.objective,
          classification: "already_satisfied",
          status: "already_satisfied",
          operations: [],
          affectedSections: goal.affectedSections,
          verification: verifyGoalAgainstProject(goal, project),
          reason: mapped.reason,
          batchId: batch.id,
        };
        outcomes.set(goalId, satisfied);
        executedGoals.push(satisfied);
        continue;
      }

      if (mapped.operations.length === 0) {
        const satisfied: TransformationGoalResult = {
          goalId,
          objective: goal.objective,
          classification: "already_satisfied",
          status: "already_satisfied",
          operations: [],
          affectedSections: goal.affectedSections,
          verification: { passed: true, scoreContribution: 0, notes: [] },
          reason: "Nothing to apply for this goal.",
          batchId: batch.id,
        };
        outcomes.set(goalId, satisfied);
        executedGoals.push(satisfied);
        continue;
      }

      try {
        const validated = validateEditOperations(mapped.operations);
        const applied = applyEditOperations(project, validated);
        const violations = brandIntegrityViolations(brand, applied.project);
        if (violations.length > 0) {
          throw new Error(`Brand scope violation: ${violations.join(", ")}`);
        }
        project = applied.project;
        batchOps.push(...validated);
        allOps.push(...validated);
        allChanges.push(...applied.changes);
        appliedInBatch.push(goalId);
        operationsByGoal[goalId] = validated.map((op) => op.operation);

        const verification = verifyGoalAgainstProject(goal, project);
        const goalResult: TransformationGoalResult = {
          goalId,
          objective: goal.objective,
          classification: "ready",
          status: verification.passed ? "applied" : "failed",
          operations: validated,
          affectedSections: goal.affectedSections,
          verification,
          reason: verification.passed
            ? undefined
            : verification.notes.join("; ") || "Goal verification failed.",
          batchId: batch.id,
        };
        outcomes.set(goalId, goalResult);
        if (goalResult.status === "applied") {
          executedGoals.push(goalResult);
        } else {
          failedGoals.push(goalResult);
          batchFailed = true;
          if (goal.priority === "critical" || goal.priority === "high") {
            criticalDependencyFailed = true;
          }
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Operation apply failed.";
        const failed: TransformationGoalResult = {
          goalId,
          objective: goal.objective,
          classification: "ready",
          status: "failed",
          operations: mapped.operations,
          affectedSections: goal.affectedSections,
          verification: { passed: false, scoreContribution: 0, notes: [message] },
          reason: message,
          batchId: batch.id,
        };
        outcomes.set(goalId, failed);
        failedGoals.push(failed);
        batchFailed = true;
        if (goal.priority === "critical" || goal.priority === "high") {
          criticalDependencyFailed = true;
        }
      }
    }

    if (batchFailed && appliedInBatch.length > 0) {
      // Roll back this batch only
      project = batchBefore;
      rollbackPerformed = true;
      batchNotes.push("Batch rolled back after verification or apply failure.");
      // Mark applied goals in this batch as failed/rolled back
      for (const id of appliedInBatch) {
        const prev = outcomes.get(id);
        if (prev && prev.status === "applied") {
          const rolled: TransformationGoalResult = {
            ...prev,
            status: "failed",
            reason: "Rolled back with failed batch.",
            operations: [],
          };
          outcomes.set(id, rolled);
          const idx = executedGoals.findIndex((g) => g.goalId === id);
          if (idx >= 0) executedGoals.splice(idx, 1);
          failedGoals.push(rolled);
        }
      }
      // Remove ops/changes from failed batch (best-effort: keep earlier batches)
      for (const op of batchOps) {
        const i = allOps.lastIndexOf(op);
        if (i >= 0) allOps.splice(i, 1);
      }
      stopFurtherBatches = true;
      verificationByBatch[batch.id] = false;
      batchResults.push({
        batchId: batch.id,
        revisionId,
        appliedGoalIds: [],
        failed: true,
        rolledBack: true,
        verificationPassed: false,
        notes: batchNotes,
      });
      continue;
    }

    const integrity = verifyBatchIntegrity({
      before: batchBefore,
      after: project,
      brand,
      appliedGoalIds: appliedInBatch,
    });
    if (!integrity.passed) {
      project = batchBefore;
      rollbackPerformed = true;
      stopFurtherBatches = true;
      criticalDependencyFailed = true;
      verificationByBatch[batch.id] = false;
      for (const id of appliedInBatch) {
        const prev = outcomes.get(id);
        if (prev) {
          const rolled: TransformationGoalResult = {
            ...prev,
            status: "failed",
            reason: integrity.notes.join("; "),
            operations: [],
          };
          outcomes.set(id, rolled);
          const idx = executedGoals.findIndex((g) => g.goalId === id);
          if (idx >= 0) executedGoals.splice(idx, 1);
          failedGoals.push(rolled);
        }
      }
      batchResults.push({
        batchId: batch.id,
        revisionId,
        appliedGoalIds: [],
        failed: true,
        rolledBack: true,
        verificationPassed: false,
        notes: integrity.notes,
      });
      continue;
    }

    if (appliedInBatch.length > 0) {
      revisionsCreated.push(revisionId);
    }
    verificationByBatch[batch.id] = true;
    batchResults.push({
      batchId: batch.id,
      revisionId,
      appliedGoalIds: appliedInBatch,
      failed: false,
      rolledBack: false,
      verificationPassed: true,
      notes: batchNotes,
    });
  }

  let refinementApplied = false;
  const allowRefinement = input.allowRefinement !== false;

  let wholePage = verifyWholePageTransformation({
    baselineProject,
    finalProject: project,
    plan,
    brand,
    criticalDependencyFailed,
  });

  if (
    allowRefinement &&
    executedGoals.some((g) => g.status === "applied") &&
    !wholePage.passed &&
    !criticalDependencyFailed &&
    !rollbackPerformed
  ) {
    const refined = maybeRefineTransformation({
      project,
      brand,
      baselineScore,
    });
    if (refined.applied) {
      project = refined.project;
      allOps.push(...refined.operations);
      refinementApplied = true;
      wholePage = verifyWholePageTransformation({
        baselineProject,
        finalProject: project,
        plan,
        brand,
        criticalDependencyFailed: false,
      });
    }
  }

  let appliedCount = executedGoals.filter((g) => g.status === "applied").length;

  // Whole-page verification is authoritative — never claim success from ops alone.
  if (
    appliedCount > 0 &&
    !wholePage.passed &&
    wholePage.verifiedScoreDelta <= 0
  ) {
    project = baselineProject;
    rollbackPerformed = true;
    revisionsCreated.length = 0;
    allOps.length = 0;
    allChanges.length = 0;
    for (const g of executedGoals.splice(0)) {
      if (g.status === "applied") {
        failedGoals.push({
          ...g,
          status: "failed",
          reason: "Whole-page score did not improve — changes were reverted.",
          operations: [],
        });
      }
    }
    appliedCount = 0;
    wholePage = {
      ...wholePage,
      finalScore: baselineScore,
      verifiedScoreDelta: 0,
      passed: false,
      notes: [
        ...wholePage.notes,
        "Transformation reverted because the whole page did not improve.",
      ],
    };
  }

  const onlySatisfied =
    appliedCount === 0 &&
    executedGoals.length > 0 &&
    executedGoals.every((g) => g.status === "already_satisfied") &&
    failedGoals.length === 0 &&
    blockedGoals.every(
      (g) =>
        g.classification === "already_satisfied" ||
        g.status === "already_satisfied",
    );

  let status: TransformationExecutionResult["status"];
  if (appliedCount > 0 && wholePage.passed && failedGoals.length === 0) {
    status =
      blockedGoals.length > 0 ? "partially_applied" : "applied";
  } else if (appliedCount > 0) {
    status = "partially_applied";
  } else if (failedGoals.length > 0) {
    status = "failed";
  } else if (onlySatisfied) {
    status = "already_satisfied";
  } else if (blockedGoals.length > 0) {
    status = "blocked";
  } else {
    status = "already_satisfied";
  }

  const result: TransformationExecutionResult = {
    planId,
    status,
    baselineScore,
    finalScore: wholePage.finalScore,
    verifiedScoreDelta: wholePage.finalScore - baselineScore,
    executedGoals,
    blockedGoals,
    failedGoals,
    revisionsCreated,
    refinementApplied,
    summary: "",
    project,
    operations: allOps,
    changes: allChanges,
    baselineProject,
    preflight,
    wholePage,
    batchResults,
    rollbackPerformed,
  };
  result.summary = formatTransformationExecutionReport(result);

  if (input.logDiagnostics || process.env.NODE_ENV === "development") {
    logDiagnostics({
      planId,
      baselineScore,
      preflightStatus: preflight.passed,
      goalStatuses: [
        ...executedGoals,
        ...blockedGoals,
        ...failedGoals,
      ].map((g) => ({
        goalId: g.goalId,
        classification: g.classification,
        status: g.status,
      })),
      dependencyOrder: plan.graph.dependencyOrder,
      batchOrder: batches.map((b) => b.id),
      operationsByGoal,
      verificationByBatch,
      finalScore: result.finalScore,
      scoreDelta: result.verifiedScoreDelta,
      refinementApplied,
      blockedReasons: blockedGoals.map((g) => g.reason || g.goalId),
      rollbackPerformed,
    });
  }

  return result;
}

/**
 * Convenience: build a fresh plan from the project and execute it.
 */
export function executeFreshWebsiteTransformation(input: {
  project: BusinessProject;
  request?: string;
  logDiagnostics?: boolean;
  allowRefinement?: boolean;
}): TransformationExecutionResult {
  const { plan } = buildTransformationPlanForProject(
    input.project,
    input.request,
  );
  return executeTransformationPlan({
    project: input.project,
    plan,
    logDiagnostics: input.logDiagnostics,
    allowRefinement: input.allowRefinement,
  });
}
