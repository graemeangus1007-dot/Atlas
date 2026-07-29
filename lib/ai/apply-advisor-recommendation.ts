/**
 * Apply a Business Advisor recommendation through the structured edit pipeline.
 */

import { applyEditOperations } from "@/lib/ai/apply-edit-operations";
import type { BusinessRecommendation } from "@/lib/ai/business-advisor-types";
import type { EditChangeSummary } from "@/lib/ai/edit-operations";
import { AiError } from "@/lib/ai/errors";
import { validateEditOperations } from "@/lib/ai/validate-edit-operations";
import type { BusinessProject } from "@/types/business-project";

export type ApplyAdvisorRecommendationResult =
  | {
      ok: true;
      project: BusinessProject;
      changes: EditChangeSummary[];
      explanation: string;
    }
  | {
      ok: false;
      code: string;
      message: string;
    };

/**
 * One-click apply — runs validate → applyEditOperations.
 * Destructive recommendations are rejected unless confirmDestructive is true.
 */
export function applyAdvisorRecommendation(input: {
  project: BusinessProject;
  recommendation: BusinessRecommendation;
  confirmDestructive?: boolean;
}): ApplyAdvisorRecommendationResult {
  try {
    if (input.recommendation.destructive && !input.confirmDestructive) {
      return {
        ok: false,
        code: "bad_request",
        message: "This improvement needs confirmation before applying.",
      };
    }

    if (
      !input.recommendation.operations ||
      input.recommendation.operations.length === 0
    ) {
      return {
        ok: false,
        code: "bad_request",
        message: "This recommendation has no applyable edits.",
      };
    }

    const operations = validateEditOperations(input.recommendation.operations);
    const applied = applyEditOperations(input.project, operations);

    return {
      ok: true,
      project: applied.project,
      changes: applied.changes,
      explanation: `Applied: ${input.recommendation.title}`,
    };
  } catch (error) {
    if (error instanceof AiError) {
      return { ok: false, code: error.code, message: error.message };
    }
    return {
      ok: false,
      code: "provider_error",
      message: "Could not apply that improvement. Please try again.",
    };
  }
}
