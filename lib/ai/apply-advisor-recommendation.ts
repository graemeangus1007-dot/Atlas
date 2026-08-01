/**
 * Apply a Business Advisor recommendation through the structured edit pipeline.
 * Never claims success when the project did not meaningfully change, or when
 * an inserted section would not render (e.g. empty FAQ).
 */

import { applyEditOperations } from "@/lib/ai/apply-edit-operations";
import { ATLAS_VOICE } from "@/lib/ai/atlas-designer-voice";
import { advisorProjectFingerprint } from "@/lib/ai/business-advisor";
import type { BusinessRecommendation } from "@/lib/ai/business-advisor-types";
import { assertInsertedSectionsVisible, isDesignSectionVisibleInContent } from "@/lib/ai/design-sections-canonical";
import type { EditChangeSummary, InsertableSectionType } from "@/lib/ai/edit-operations";
import { AiError } from "@/lib/ai/errors";
import { validateEditOperations } from "@/lib/ai/validate-edit-operations";
import { generateWebsiteContent } from "@/lib/website-generator";
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

function insertedSectionsRenderInContent(
  project: BusinessProject,
  operations: Array<{ operation: string; type?: string }>,
): boolean {
  const content = generateWebsiteContent(project);
  for (const op of operations) {
    if (op.operation !== "insertSection" || !op.type) continue;
    if (
      !isDesignSectionVisibleInContent(
        content,
        op.type as InsertableSectionType,
      )
    ) {
      return false;
    }
  }
  return true;
}

/**
 * One-click apply — runs validate → applyEditOperations → visibility assertion.
 * Destructive recommendations are rejected unless confirmDestructive is true.
 * No-op / invisible inserts are reported as `no_visible_change` (never “Applied”).
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
          "Already in place — that improvement didn’t alter the live page.",
      };
    }

    const visibility = assertInsertedSectionsVisible(
      applied.project,
      operations,
    );
    if (!visibility.ok) {
      return {
        ok: true,
        status: "no_visible_change",
        requestId,
        project: applied.project,
        changes: [],
        explanation: `Already in place — ${visibility.missing.join(", ")} did not appear on the page.`,
      };
    }

    if (!insertedSectionsRenderInContent(applied.project, operations)) {
      return {
        ok: true,
        status: "no_visible_change",
        requestId,
        project: applied.project,
        changes: [],
        explanation:
          "Already in place — the inserted section is not present in the rendered site.",
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
      message: ATLAS_VOICE.applyFailed,
    };
  }
}
