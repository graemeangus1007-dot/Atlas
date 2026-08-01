/**
 * Apply Creative Director recommendations (edit + image ops).
 * Sprint 25.0A — supports Apply and Apply All.
 */

import { applyEditOperations } from "@/lib/ai/apply-edit-operations";
import { applyImageOperations } from "@/lib/ai/apply-image-operations";
import { ATLAS_VOICE } from "@/lib/ai/atlas-designer-voice";
import {
  creativeDirectorFingerprint,
  reviewCreativeDirector,
} from "@/lib/ai/creative-director";
import type { CreativeDirectorRecommendation } from "@/lib/ai/creative-director-types";
import type { EditChangeSummary, EditOperation } from "@/lib/ai/edit-operations";
import { AiError } from "@/lib/ai/errors";
import { isEditOperationKind } from "@/lib/ai/edit-operations";
import { isImageOperationKind, type ImageOperation } from "@/lib/ai/image-operations";
import { validateEditOperations } from "@/lib/ai/validate-edit-operations";
import { validateImageOperations } from "@/lib/ai/validate-image-operations";
import type { BusinessProject } from "@/types/business-project";

export type CreativeApplyStatus = "applied" | "no_visible_change" | "failed";

export type ApplyCreativeRecommendationResult =
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

export type ApplyAllCreativeResult =
  | {
      ok: true;
      status: "applied" | "no_visible_change";
      requestId: string;
      project: BusinessProject;
      changes: EditChangeSummary[];
      appliedIds: string[];
      skippedIds: string[];
      unsupported: Array<{ id: string; title: string; reason: string }>;
      explanation: string;
    }
  | {
      ok: false;
      status: "failed";
      requestId: string;
      code: string;
      message: string;
      project: BusinessProject;
      appliedIds: string[];
    };

function createRequestId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function splitOperations(ops: CreativeDirectorRecommendation["operations"]): {
  edits: EditOperation[];
  images: ImageOperation[];
} {
  const edits: EditOperation[] = [];
  const images: ImageOperation[] = [];
  for (const op of ops) {
    if (isEditOperationKind(op.operation)) {
      edits.push(op as EditOperation);
    } else if (isImageOperationKind(op.operation)) {
      images.push(op as ImageOperation);
    }
  }
  return { edits, images };
}

/**
 * Apply one Creative Director recommendation through validated pipelines.
 */
export function applyCreativeRecommendation(input: {
  project: BusinessProject;
  recommendation: CreativeDirectorRecommendation;
  requestId?: string;
}): ApplyCreativeRecommendationResult {
  const requestId = input.requestId ?? createRequestId("creative-apply");
  const rec = input.recommendation;

  if (!rec.applyable || rec.operations.length === 0) {
    return {
      ok: false,
      status: "failed",
      requestId,
      code: "bad_request",
      message:
        rec.blockedReason ||
        "This improvement needs a photo from your media library first.",
    };
  }

  try {
    const beforeFp = creativeDirectorFingerprint(input.project);
    const { edits, images } = splitOperations(rec.operations);
    let next = input.project;
    const changes: EditChangeSummary[] = [];

    if (edits.length > 0) {
      const validated = validateEditOperations(edits);
      const applied = applyEditOperations(next, validated);
      next = applied.project;
      changes.push(...applied.changes);
    }
    if (images.length > 0) {
      const validated = validateImageOperations(images, next);
      const applied = applyImageOperations(next, validated);
      next = applied.project;
      changes.push(
        ...applied.changes.map((c) => ({
          id: c.id,
          label: c.label,
          ok: true as const,
        })),
      );
    }

    if (creativeDirectorFingerprint(next) === beforeFp) {
      return {
        ok: true,
        status: "no_visible_change",
        requestId,
        project: input.project,
        changes: [],
        explanation:
          "Already in place — that improvement was already reflected on the page.",
      };
    }

    return {
      ok: true,
      status: "applied",
      requestId,
      project: next,
      changes,
      explanation: rec.explanation,
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

/**
 * Apply All — runs applyable recommendations in ranked order on one project.
 */
export function applyAllCreativeRecommendations(input: {
  project: BusinessProject;
  recommendations: CreativeDirectorRecommendation[];
  requestId?: string;
}): ApplyAllCreativeResult {
  const requestId = input.requestId ?? createRequestId("creative-apply-all");
  let next = input.project;
  const allChanges: EditChangeSummary[] = [];
  const appliedIds: string[] = [];
  const skippedIds: string[] = [];
  const unsupported: Array<{ id: string; title: string; reason: string }> = [];

  for (const recommendation of input.recommendations) {
    if (!recommendation.applyable || recommendation.operations.length === 0) {
      skippedIds.push(recommendation.id);
      unsupported.push({
        id: recommendation.id,
        title: recommendation.title,
        reason:
          recommendation.blockedReason ??
          (recommendation.supportStatus === "needs_images"
            ? "Requires uploaded images"
            : "Coming soon"),
      });
      continue;
    }
    const result = applyCreativeRecommendation({
      project: next,
      recommendation,
      requestId: `${requestId}:${recommendation.id}`,
    });
    if (!result.ok) {
      skippedIds.push(recommendation.id);
      continue;
    }
    if (result.status === "applied") {
      next = result.project;
      allChanges.push(...result.changes);
      appliedIds.push(recommendation.id);
    } else {
      skippedIds.push(recommendation.id);
    }
  }

  const unsupportedLines =
    unsupported.length > 0
      ? [
          "",
          "Not applied:",
          ...unsupported.map((u) => `⚠ ${u.title} — ${u.reason}`),
        ].join("\n")
      : "";

  if (appliedIds.length === 0) {
    return {
      ok: true,
      status: "no_visible_change",
      requestId,
      project: input.project,
      changes: [],
      appliedIds,
      skippedIds,
      unsupported,
      explanation: [
        "Nothing new to apply automatically.",
        unsupportedLines.trim(),
      ]
        .filter(Boolean)
        .join("\n"),
    };
  }

  const refreshed = reviewCreativeDirector({ project: next, limit: 8 });
  return {
    ok: true,
    status: "applied",
    requestId,
    project: next,
    changes: allChanges,
    appliedIds,
    skippedIds,
    unsupported,
    explanation: [
      `I applied ${appliedIds.length} improvement${appliedIds.length === 1 ? "" : "s"}. Your site is now ${refreshed.overallCompleteness}% complete (${refreshed.maturityLevel}).`,
      unsupportedLines.trim(),
    ]
      .filter(Boolean)
      .join("\n"),
  };
}
