/**
 * Sprint 29.4 — Single image-reference resolver.
 *
 * Continuation truth lives on canonical interaction state + project visual truth.
 * Per-turn attachments are request input only. ImageEditorState is a transient
 * projection, not an independent authority.
 */

import type { AtlasInteractionState } from "@/lib/ai/atlas-interaction-types";
import type { AttachmentContext } from "@/lib/ai/conversation-attachments";
import type { ImageTargetRef } from "@/lib/ai/image-operations";
import type { BusinessProject } from "@/types/business-project";

export type ImageContextSource =
  | "attachment"
  | "pending_clarification"
  | "active_task"
  | "project_truth"
  | "media_search"
  | "none";

export type ResolvedImageReference = {
  target: ImageTargetRef | null;
  assetId: string | null;
  source: ImageContextSource;
  /** When true, caller should ask one precise clarification. */
  needsClarification: boolean;
  clarificationKind?: "image_target";
};

export type ResolveImageReferenceInput = {
  interactionState: AtlasInteractionState | null | undefined;
  attachmentContexts?: AttachmentContext[] | null;
  project: BusinessProject;
  message: string;
  /** Optional transient UI cue — never authoritative over activeTask. */
  transientEditorCue?: {
    lastImageRef?: ImageTargetRef | null;
    selectedImageRef?: ImageTargetRef | null;
  } | null;
};

function normalizeMessage(message: string): string {
  return message.trim().toLowerCase();
}

function answerImpliesHero(message: string): boolean {
  return /\bhero(\s+image)?\b/i.test(message);
}

function answerImpliesGallery(message: string): boolean {
  return /\bgallery(\s+image)?\b/i.test(message);
}

function activeTaskToTarget(
  state: AtlasInteractionState,
): { target: ImageTargetRef; assetId: string | null } | null {
  const task = state.activeTask;
  if (!task) return null;
  const assetId = task.assetId ?? null;
  switch (task.target.type) {
    case "hero":
      return { target: { kind: "hero" }, assetId: assetId ?? state.preservation?.heroAssetId ?? null };
    case "gallery":
      return {
        target: { kind: "gallery", index: task.target.index ?? 0 },
        assetId,
      };
    case "logo":
      return { target: { kind: "logo" }, assetId };
    case "section":
      return {
        target: {
          kind: "section",
          section: task.target.section as
            | "hero"
            | "about"
            | "services"
            | "features"
            | "gallery"
            | "contact"
            | "testimonials"
            | "team",
        },
        assetId,
      };
    default:
      if (assetId) {
        return { target: { kind: "library", assetId }, assetId };
      }
      return null;
  }
}

/**
 * Resolve which image a request refers to.
 *
 * Priority:
 * 1. current-message explicit attachment
 * 2. typed pending clarification answer
 * 3. canonical activeTask.assetId / target
 * 4. current project visual truth
 * 5. existing media search (message mentions)
 * 6. one precise clarification
 */
export function resolveImageReference(
  input: ResolveImageReferenceInput,
): ResolvedImageReference {
  const message = input.message.trim();
  const normalized = normalizeMessage(message);
  const state = input.interactionState ?? null;
  const attachments = input.attachmentContexts ?? [];

  // 1. Current-message explicit attachment
  if (attachments.length === 1 && attachments[0]?.assetId) {
    return {
      target: { kind: "library", assetId: attachments[0].assetId },
      assetId: attachments[0].assetId,
      source: "attachment",
      needsClarification: false,
    };
  }
  if (attachments.length > 1) {
    // Multiple attachments — placement intents handled elsewhere; no single ref.
    return {
      target: null,
      assetId: null,
      source: "attachment",
      needsClarification: false,
    };
  }

  // 2. Typed pending clarification answer (image_target)
  const pending = state?.pendingClarification;
  if (pending?.kind === "image_target" && pending.pendingQuestion) {
    if (answerImpliesHero(message)) {
      return {
        target: { kind: "hero" },
        assetId:
          state?.activeTask?.assetId ??
          state?.preservation?.heroAssetId ??
          input.project.heroImageId ??
          null,
        source: "pending_clarification",
        needsClarification: false,
      };
    }
    if (answerImpliesGallery(message)) {
      const firstGallery =
        input.project.galleryImageIds?.find((id) => Boolean(id)) ?? null;
      return {
        target: { kind: "gallery", index: 0 },
        assetId: firstGallery,
        source: "pending_clarification",
        needsClarification: false,
      };
    }
  }

  // 3. Canonical activeTask
  if (state?.activeTask) {
    const fromTask = activeTaskToTarget(state);
    if (fromTask) {
      // Conversational “this/that/previous” or bare follow-ups inherit active task.
      if (
        !normalized ||
        /\b(this|that|the\s+previous|it|the\s+image|the\s+photo|the\s+picture)\b/.test(
          normalized,
        ) ||
        /\b(full\s+picture|don'?t\s+crop|show\s+more|make\s+it)\b/.test(
          normalized,
        )
      ) {
        return {
          target: fromTask.target,
          assetId:
            fromTask.assetId ??
            (fromTask.target.kind === "hero"
              ? input.project.heroImageId ?? null
              : null),
          source: "active_task",
          needsClarification: false,
        };
      }
      // Explicit hero/gallery in message while task is active
      if (/\bhero\b/.test(normalized) && fromTask.target.kind === "hero") {
        return {
          target: fromTask.target,
          assetId: fromTask.assetId ?? input.project.heroImageId ?? null,
          source: "active_task",
          needsClarification: false,
        };
      }
    }
  }

  // 4. Project visual truth
  if (/\bhero\b/.test(normalized) && input.project.heroImageId) {
    return {
      target: { kind: "hero" },
      assetId: input.project.heroImageId,
      source: "project_truth",
      needsClarification: false,
    };
  }
  if (/\blogo\b/.test(normalized) && input.project.logoAssetId) {
    return {
      target: { kind: "logo" },
      assetId: input.project.logoAssetId,
      source: "project_truth",
      needsClarification: false,
    };
  }
  if (/\bgallery\b/.test(normalized)) {
    const idxMatch = normalized.match(/\b(?:image|photo|picture)\s*(\d+)\b/);
    const index = idxMatch ? Math.max(0, Number(idxMatch[1]) - 1) : 0;
    const assetId = input.project.galleryImageIds?.[index] || null;
    if (assetId) {
      return {
        target: { kind: "gallery", index },
        assetId,
        source: "project_truth",
        needsClarification: false,
      };
    }
  }

  // Transient editor cue (non-authoritative, after project truth cues)
  const cue =
    input.transientEditorCue?.selectedImageRef ??
    input.transientEditorCue?.lastImageRef;
  if (
    cue &&
    /\b(this|that|the\s+previous)\s+(image|picture|photo)\b/.test(normalized)
  ) {
    return {
      target: cue,
      assetId: cue.kind === "library" ? cue.assetId : null,
      source: "active_task",
      needsClarification: false,
    };
  }

  // 5. Media library search by filename-ish tokens
  const library = input.project.mediaLibrary ?? [];
  if (library.length > 0 && normalized.length >= 3) {
    const hit = library.find((asset) => {
      const title = (asset.title || asset.name || "").toLowerCase();
      return title && normalized.includes(title.slice(0, Math.min(12, title.length)));
    });
    if (hit) {
      return {
        target: { kind: "library", assetId: hit.id },
        assetId: hit.id,
        source: "media_search",
        needsClarification: false,
      };
    }
  }

  // 6. Ambiguous image edit with no target → one precise clarification
  if (
    /\b(image|photo|picture)\b/.test(normalized) &&
    /\b(replace|swap|change|use|crop|fit)\b/.test(normalized) &&
    !/\b(hero|gallery|logo)\b/.test(normalized) &&
    !state?.activeTask
  ) {
    return {
      target: null,
      assetId: null,
      source: "none",
      needsClarification: true,
      clarificationKind: "image_target",
    };
  }

  // Fall back to active task if present for soft continuations
  if (state?.activeTask) {
    const fromTask = activeTaskToTarget(state);
    if (fromTask) {
      return {
        target: fromTask.target,
        assetId:
          fromTask.assetId ??
          (fromTask.target.kind === "hero"
            ? input.project.heroImageId ?? null
            : null),
        source: "active_task",
        needsClarification: false,
      };
    }
  }

  return {
    target: null,
    assetId: null,
    source: "none",
    needsClarification: false,
  };
}

/**
 * Derive a transient ImageEditorState cue from canonical activeTask.
 * Not persisted; used only for in-turn conversational “this/that”.
 */
export function imageEditorStateFromActiveTask(
  state: AtlasInteractionState | null | undefined,
  project: BusinessProject,
): { lastImageRef: ImageTargetRef | null; selectedImageRef: null } {
  if (!state?.activeTask) {
    return { lastImageRef: null, selectedImageRef: null };
  }
  const resolved = activeTaskToTarget(state);
  if (!resolved) {
    return { lastImageRef: null, selectedImageRef: null };
  }
  // Prefer project hero id when task is hero without assetId
  if (resolved.target.kind === "hero" && !resolved.assetId && project.heroImageId) {
    return { lastImageRef: { kind: "hero" }, selectedImageRef: null };
  }
  return { lastImageRef: resolved.target, selectedImageRef: null };
}
