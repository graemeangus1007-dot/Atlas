/**
 * v1.6.7 — Apply All plan continuity.
 * One authoritative executable plan; never fall through to generic clarification.
 */

import {
  detectActionConfirmation,
  getActionMemory,
  hasActiveTransformationPlan,
  type AtlasActionMemory,
} from "@/lib/ai/atlas-action-memory";
import { creativeDirectorFingerprint } from "@/lib/ai/creative-director";
import {
  isReviewPlanStale,
  projectRevisionFromFingerprint,
} from "@/lib/strategy/review-plan";
import type { BusinessProject } from "@/types/business-project";

export type ApplyAllResolutionSource =
  | "typed_clarification"
  | "review_plan_snapshot"
  | "transformation_plan"
  | "recommendation_plan"
  | "no_plan"
  | "stale_plan";

export type ApplyAllContinuityDiagnostics = {
  requestId: string | null;
  strategicRequestMode: string | null;
  activePlanPresent: boolean;
  reviewPlanSnapshotPresent: boolean;
  transformationPlanPresent: boolean;
  planRevision: string | null;
  projectRevision: string | null;
  canApplyAll: boolean;
  applyAllResolutionSource: ApplyAllResolutionSource;
  stalePlanDetected: boolean;
  executionStarted: boolean;
  genericClarificationTriggered: boolean;
};

export function isApplyAllRequest(request: string): boolean {
  return detectActionConfirmation(request).kind === "apply_all";
}

/** True when canonical interaction state has an executable Apply All target. */
export function canApplyAll(
  memory: AtlasActionMemory | null | undefined,
): boolean {
  if (!memory?.activePlan?.applyAllPending) return false;
  const applyableRecs = (memory.activePlan.recommendations ?? []).some(
    (r) => r.applyable,
  );
  return applyableRecs || hasActiveTransformationPlan(memory);
}

export function resolveApplyAllSource(
  memory: AtlasActionMemory | null | undefined,
): ApplyAllResolutionSource {
  if (!canApplyAll(memory)) return "no_plan";
  if (memory?.activePlan?.reviewPlanSnapshot) {
    return "review_plan_snapshot";
  }
  if (hasActiveTransformationPlan(memory)) return "transformation_plan";
  if ((memory?.activePlan?.recommendations ?? []).some((r) => r.applyable)) {
    return "recommendation_plan";
  }
  return "no_plan";
}

/**
 * Invariant: visible Apply All ⇒ executable canonical plan exists.
 * Throws in development when violated; returns false otherwise.
 */
export function assertApplyAllHasExecutablePlan(
  memory: AtlasActionMemory | null | undefined,
  uiShowsApplyAll: boolean,
): boolean {
  if (!uiShowsApplyAll) return true;
  const ok = canApplyAll(memory);
  if (!ok && process.env.NODE_ENV === "development") {
    console.error(
      "[atlas:apply-all:invariant] visible Apply All without executable plan",
    );
  }
  return ok;
}

export function assessApplyAllPlanState(input: {
  project: BusinessProject;
  requestId?: string | null;
}): {
  canApply: boolean;
  stale: boolean;
  source: ApplyAllResolutionSource;
  projectRevision: string;
  planRevision: string | null;
} {
  const memory = getActionMemory(input.project);
  const projectRevision = projectRevisionFromFingerprint(
    creativeDirectorFingerprint(input.project),
  );
  const snapshot = memory.activePlan?.reviewPlanSnapshot ?? null;
  const planRevision = snapshot?.projectRevision ?? null;
  const stale = Boolean(
    snapshot &&
      isReviewPlanStale({
        snapshot,
        currentRevision: projectRevision,
      }),
  );
  if (stale) {
    return {
      canApply: false,
      stale: true,
      source: "stale_plan",
      projectRevision,
      planRevision,
    };
  }
  const source = resolveApplyAllSource(memory);
  return {
    canApply: canApplyAll(memory) && source !== "no_plan",
    stale: false,
    source,
    projectRevision,
    planRevision,
  };
}

export const NO_PLAN_APPLY_ALL_COPY =
  "There isn’t an active review plan to apply. Run “Review my website” first and I’ll prepare one.";

export const STALE_PLAN_APPLY_ALL_COPY =
  "The site changed since that review. I need to refresh the plan before applying it.";

export function formatApplyAllContinuityFailure(input: {
  stale: boolean;
}): string {
  return input.stale ? STALE_PLAN_APPLY_ALL_COPY : NO_PLAN_APPLY_ALL_COPY;
}

export function logApplyAllContinuityDiagnostics(
  diag: ApplyAllContinuityDiagnostics,
): void {
  if (process.env.NODE_ENV !== "development") return;
  console.info("[atlas:apply-all:continuity]", diag);
}
