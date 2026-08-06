/**
 * Undo helpers for a coordinated transformation.
 * Editor creates one revision per Brain turn covering the full apply —
 * restoring revision.before returns the exact pre-transformation project.
 */

import type { BusinessProject } from "@/types/business-project";
import type { TransformationExecutionResult } from "@/lib/transformation/execution-types";

export type TransformationUndoSnapshot = {
  transformationId: string;
  baselineProject: BusinessProject;
  createdAt: string;
};

export function captureTransformationUndoSnapshot(
  result: TransformationExecutionResult,
): TransformationUndoSnapshot {
  return {
    transformationId: result.planId,
    baselineProject: result.baselineProject,
    createdAt: new Date().toISOString(),
  };
}

export function restoreTransformationBaseline(
  snapshot: TransformationUndoSnapshot,
): BusinessProject {
  return JSON.parse(JSON.stringify(snapshot.baselineProject)) as BusinessProject;
}

/** Grouped revision prompt for editor undo stacks. */
export function transformationRevisionPrompt(planId: string): string {
  return `Transformation ${planId}`;
}
