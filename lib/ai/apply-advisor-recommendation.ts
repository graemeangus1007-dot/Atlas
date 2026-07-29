/**
 * Apply a Business Advisor recommendation through the structured edit pipeline.
 * Never claims success when the project did not meaningfully change.
 */

import { applyEditOperations } from "@/lib/ai/apply-edit-operations";
import { advisorProjectFingerprint } from "@/lib/ai/business-advisor";
import type { BusinessRecommendation } from "@/lib/ai/business-advisor-types";
import type { EditChangeSummary } from "@/lib/ai/edit-operations";
import { AiError } from "@/lib/ai/errors";
import { validateEditOperations } from "@/lib/ai/validate-edit-operations";
import type { BusinessProject } from "@/types/business-project";

export type AdvisorApplyStatus =
  | "applied"
  | "no_visible_change"
  | "failed";

export type ApplyAdvisorRecommendationResult =
  | {
      ok: true;
      status: "applied";
      requestId: string;
      project: BusinessProject;
      changes: EditChangeSummary[];
      explanation: string;
    }
  | {
      ok: true;
      status: "no_visible_change";
      requestId: string;
      project: BusinessProject;
      changes: EditChangeSummary[];
      explanation: string;
    }
  | {
      ok: false;
      status: "failed";
      requestId: string;
      code: string;
      message: string;
    };

function createAdvisorApplyRequestId(): string {
  return `advisor-apply-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * One-click apply — runs validate → applyEditOperations.
 * Destructive recommendations are rejected unless confirmDestructive is true.
 * No-op edits are reported as `no_visible_change` (never silent “success”).
 */
export function applyAdvisorRecommendation(input: {
  project: BusinessProject;
  recommendation: BusinessRecommendation;
  confirmDestructive?: boolean;
  requestId?: string;
}): ApplyAdvisorRecommendationResult {
  const requestId = input.requestId ?? createAdvisorApplyRequestId();

  try {
    if (input.recommendation.destructive && !input.confirmDestructive) {
      return {
        ok: false,
        status: "failed",
        requestId,
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
        status: "failed",
        requestId,
        code: "bad_request",
        message: "This recommendation has no applyable edits.",
      };
    }

    const beforeFingerprint = advisorProjectFingerprint(input.project);
    const operations = validateEditOperations(input.recommendation.operations);
    const applied = applyEditOperations(input.project, operations);
    const afterFingerprint = advisorProjectFingerprint(applied.project);

    if (beforeFingerprint === afterFingerprint) {
      return {
        ok: true,
        status: "no_visible_change",
        requestId,
        project: applied.project,
        changes: [],
        explanation:
          "No visible change — that improvement didn’t alter the live page.",
      };
    }

    return {
      ok: true,
      status: "applied",
      requestId,
      project: applied.project,
      changes: applied.changes,
      explanation: `Applied: ${input.recommendation.title}`,
    };
  } catch (error) {
    if (error instanceof AiError) {
      return {
        ok: false,
        status: "failed",
        requestId,
        code: error.code,
        message: error.message,
      };
    }
    return {
      ok: false,
      status: "failed",
      requestId,
      code: "provider_error",
      message: "Could not apply that improvement. Please try again.",
    };
  }
}
