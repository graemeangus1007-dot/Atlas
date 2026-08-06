/**
 * At most one coordinated refinement pass after whole-page verification fails.
 */

import { applyEditOperations } from "@/lib/ai/apply-edit-operations";
import type { EditOperation } from "@/lib/ai/edit-operations";
import { validateEditOperations } from "@/lib/ai/validate-edit-operations";
import { evaluateWebsiteAsCreativeDirector } from "@/lib/creative-director";
import { brandIntegrityViolations } from "@/lib/transformation/brand-snapshot";
import type { BrandScopeSnapshot } from "@/lib/transformation/execution-types";
import { overallDesignScore } from "@/lib/transformation/verify";
import type { BusinessProject } from "@/types/business-project";

export type RefinementPassResult = {
  applied: boolean;
  project: BusinessProject;
  operations: EditOperation[];
  reason: string;
};

/**
 * Target the weakest remaining dimension with one safe polish batch.
 */
export function maybeRefineTransformation(input: {
  project: BusinessProject;
  brand: BrandScopeSnapshot;
  baselineScore: number;
  minDelta?: number;
}): RefinementPassResult {
  const minDelta = input.minDelta ?? 1;
  const currentScore = overallDesignScore(input.project);
  if (currentScore - input.baselineScore >= minDelta) {
    return {
      applied: false,
      project: input.project,
      operations: [],
      reason: "Score already improved enough — refinement not needed.",
    };
  }

  const evaluation = evaluateWebsiteAsCreativeDirector({
    project: input.project,
  });
  const weakest = [
    { key: "trust", score: evaluation.trust.score },
    { key: "conversion", score: evaluation.conversion.score },
    { key: "rhythm", score: evaluation.rhythm.score },
    { key: "flow", score: evaluation.flow.score },
  ].sort((a, b) => a.score - b.score)[0]!;

  const ops: EditOperation[] = [];
  if (weakest.key === "trust") {
    ops.push({
      operation: "setCreativePolish",
      visualHierarchy: true,
      spacing: "comfortable",
    });
  } else if (weakest.key === "conversion") {
    ops.push({
      operation: "setCreativePolish",
      contactFormEnabled: true,
      visualHierarchy: true,
    });
  } else {
    ops.push({
      operation: "setCreativePolish",
      spacing: "comfortable",
      visualHierarchy: true,
      serviceIcons: true,
    });
  }

  try {
    const validated = validateEditOperations(ops);
    const applied = applyEditOperations(input.project, validated);
    const violations = brandIntegrityViolations(input.brand, applied.project);
    if (violations.length > 0) {
      return {
        applied: false,
        project: input.project,
        operations: [],
        reason: `Refinement blocked to preserve brand (${violations.join(", ")}).`,
      };
    }
    const nextScore = overallDesignScore(applied.project);
    if (nextScore <= currentScore) {
      return {
        applied: false,
        project: input.project,
        operations: [],
        reason: "Refinement did not improve the whole-page score.",
      };
    }
    return {
      applied: true,
      project: applied.project,
      operations: validated,
      reason: `Refined the weakest dimension (${weakest.key}).`,
    };
  } catch {
    return {
      applied: false,
      project: input.project,
      operations: [],
      reason: "Refinement could not be applied safely.",
    };
  }
}
