/**
 * Continuous hero / visual editing context (v1.3).
 * Short follow-ups inherit the active hero task unless the topic clearly changes.
 *
 * Sprint 29.3: ActiveVisualTask merges into canonical `activeTask`.
 * Legacy `activeVisualTask` is a derived mirror only.
 * Clarification lives only on top-level pending via the interaction adapter.
 * See docs/atlas-interaction-ownership.md.
 */

import type { AtlasActionMemory } from "@/lib/ai/atlas-action-memory";
import type { AtlasActiveTask, AtlasInteractionState } from "@/lib/ai/atlas-interaction-types";
import {
  getInteractionState,
  updateInteractionState,
} from "@/lib/ai/interaction-state";
import type { BusinessProject } from "@/types/business-project";

export type ActiveVisualTaskKind =
  | "hero_readability"
  | "hero_balance"
  | "hero_image_fit"
  | "hero_crop"
  | "hero_composition";

/**
 * @deprecated Sprint 29.2 — nested clarification retired. Kept for typing legacy
 * payloads during normalize/promotion only.
 */
export type ActiveVisualTaskPendingClarification = {
  kind: "image_target" | "fit_mode" | "crop_position";
  allowedTargets?: string[];
};

export type ActiveVisualTask = {
  kind: ActiveVisualTaskKind;
  target: "hero";
  assetId?: string;
  lastUserGoal?: string;
  repairLevel?: number;
  /**
   * @deprecated Sprint 29.2 — do not write. Legacy projects may still have this;
   * `normalizeInteractionState` promotes it once to top-level pending.
   */
  pendingClarification?: ActiveVisualTaskPendingClarification;
  updatedAt: string;
};

const HERO_CONTINUATION =
  /\b(make\s+it\s+clearer|a\s+little\s+(more\s+)?(visible|easier|lighter|clearer)|still\s+(too\s+dark|bad|hard)|use\s+the\s+(full|entire|whole)\s+(hero\s+)?(picture|photo|image)|show\s+(more\s+of\s+)?the\s+(full\s+|entire\s+|whole\s+)?(hero\s+)?(photo|image|picture)|don'?t\s+crop|stop\s+cropping|fit\s+the\s+entire|show\s+the\s+whole|make\s+it\s+(look\s+)?professional|fill\s+the\s+hero|crop\s+it\s+tighter|zoom\s+in|hero\s+image|(being\s+)?cut\s+off|is\s+cropped)\b/i;

const TOPIC_SWITCH =
  /\b(complete\s+my\s+website|finish\s+my\s+website|review\s+my\s+(website|site)|apply\s+all|change\s+the\s+(colors?|fonts?|typography)|redesign\s+(the\s+)?(whole\s+)?(site|website)|about\s+section|services\s+section|contact\s+section|gallery)\b/i;

function nowIso(): string {
  return new Date().toISOString();
}

function isHeroKind(kind: string): kind is ActiveVisualTaskKind {
  return (
    kind === "hero_readability" ||
    kind === "hero_balance" ||
    kind === "hero_image_fit" ||
    kind === "hero_crop" ||
    kind === "hero_composition"
  );
}

function activeTaskToVisualTask(
  task: AtlasActiveTask | null | undefined,
): ActiveVisualTask | null {
  if (!task || !isHeroKind(task.kind)) return null;
  if (task.target.type !== "hero" && !String(task.kind).startsWith("hero_")) {
    return null;
  }
  return {
    kind: task.kind,
    target: "hero",
    assetId: task.assetId,
    lastUserGoal: task.userGoal,
    repairLevel: task.repairLevel,
    updatedAt: task.updatedAt || nowIso(),
  };
}

function visualTaskToActiveTask(task: ActiveVisualTask): AtlasActiveTask {
  return {
    kind: task.kind,
    target: { type: "hero" },
    assetId: task.assetId,
    userGoal: task.lastUserGoal,
    repairLevel: task.repairLevel,
    updatedAt: task.updatedAt || nowIso(),
  };
}

export function getActiveVisualTask(
  memory:
    | AtlasActionMemory
    | AtlasInteractionState
    | null
    | undefined,
): ActiveVisualTask | null {
  if (!memory) return null;
  // Sprint 29.4 — canonical activeTask only (legacy mirrors are migration-inbound).
  if ("activeTask" in memory && memory.activeTask) {
    return activeTaskToVisualTask(memory.activeTask as AtlasActiveTask);
  }
  return null;
}

export function withActiveVisualTask(
  project: BusinessProject,
  task: ActiveVisualTask | null,
): BusinessProject {
  // Never persist nested clarification on write.
  const sanitized =
    task && task.pendingClarification
      ? (() => {
          const rest = { ...task };
          delete rest.pendingClarification;
          return { ...rest, updatedAt: nowIso() };
        })()
      : task;

  return updateInteractionState(
    project,
    (state) => ({
      ...state,
      activeTask: sanitized ? visualTaskToActiveTask(sanitized) : null,
      preservation: {
        ...(state.preservation ?? {}),
        heroAssetId:
          sanitized?.assetId ??
          state.preservation?.heroAssetId ??
          project.heroImageId ??
          null,
      },
      updatedAt: nowIso(),
    }),
    { origin: "active-visual-task.withActiveVisualTask" },
  );
}

export function touchActiveVisualTask(
  project: BusinessProject,
  patch: {
    kind: ActiveVisualTaskKind;
    lastUserGoal?: string;
    repairLevel?: number;
    /**
     * @deprecated Sprint 29.2 — ignored. Clarification is top-level only.
     */
    pendingClarification?: ActiveVisualTaskPendingClarification | null;
    assetId?: string | null;
  },
): BusinessProject {
  const prev = getActiveVisualTask(getInteractionState(project));
  const next: ActiveVisualTask = {
    kind: patch.kind,
    target: "hero",
    assetId:
      patch.assetId === null
        ? undefined
        : (patch.assetId ?? prev?.assetId ?? project.heroImageId ?? undefined),
    lastUserGoal: patch.lastUserGoal ?? prev?.lastUserGoal,
    repairLevel: patch.repairLevel ?? prev?.repairLevel,
    // Intentionally omit pendingClarification — top-level only (Sprint 29.2).
    updatedAt: nowIso(),
  };
  return withActiveVisualTask(project, next);
}

/**
 * @deprecated Sprint 29.2 — nested clarification retired. No-op identity helper
 * kept briefly so call sites can be removed without behavior change.
 */
export function clearActiveVisualTaskPending(
  project: BusinessProject,
): BusinessProject {
  const prev = getActiveVisualTask(getInteractionState(project));
  if (!prev) return project;
  if (!prev.pendingClarification) return project;
  return withActiveVisualTask(project, {
    kind: prev.kind,
    target: "hero",
    assetId: prev.assetId,
    lastUserGoal: prev.lastUserGoal,
    repairLevel: prev.repairLevel,
    updatedAt: nowIso(),
  });
}

export function hasActiveHeroVisualTask(
  memory:
    | AtlasActionMemory
    | AtlasInteractionState
    | null
    | undefined,
): boolean {
  return getActiveVisualTask(memory)?.target === "hero";
}

/** Short follow-ups that continue an active hero visual task. */
export function isHeroVisualContinuationRequest(request: string): boolean {
  const text = request.trim();
  if (!text || TOPIC_SWITCH.test(text)) return false;
  return HERO_CONTINUATION.test(text);
}

export function shouldContinueActiveHeroTask(
  request: string,
  memory:
    | AtlasActionMemory
    | AtlasInteractionState
    | null
    | undefined,
): boolean {
  if (!hasActiveHeroVisualTask(memory)) return false;
  if (TOPIC_SWITCH.test(request)) return false;
  return isHeroVisualContinuationRequest(request);
}
