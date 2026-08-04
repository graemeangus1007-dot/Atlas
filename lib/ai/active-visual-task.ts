/**
 * Continuous hero / visual editing context (v1.3).
 * Short follow-ups inherit the active hero task unless the topic clearly changes.
 */

import type { AtlasActionMemory } from "@/lib/ai/atlas-action-memory";
import type { BusinessProject } from "@/types/business-project";

export type ActiveVisualTaskKind =
  | "hero_readability"
  | "hero_balance"
  | "hero_image_fit"
  | "hero_crop"
  | "hero_composition";

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

export function getActiveVisualTask(
  memory: AtlasActionMemory | null | undefined,
): ActiveVisualTask | null {
  const task = memory?.activeVisualTask;
  if (!task || task.target !== "hero") return null;
  return task;
}

export function withActiveVisualTask(
  project: BusinessProject,
  task: ActiveVisualTask | null,
): BusinessProject {
  const memory = (project.atlasActionMemory ?? {
    updatedAt: nowIso(),
  }) as AtlasActionMemory;
  return {
    ...project,
    atlasActionMemory: {
      ...memory,
      activeVisualTask: task,
      updatedAt: nowIso(),
    },
  };
}

export function touchActiveVisualTask(
  project: BusinessProject,
  patch: {
    kind: ActiveVisualTaskKind;
    lastUserGoal?: string;
    repairLevel?: number;
    pendingClarification?: ActiveVisualTaskPendingClarification | null;
    assetId?: string | null;
  },
): BusinessProject {
  const prev = getActiveVisualTask(
    project.atlasActionMemory as AtlasActionMemory | undefined,
  );
  const next: ActiveVisualTask = {
    kind: patch.kind,
    target: "hero",
    assetId:
      patch.assetId === null
        ? undefined
        : (patch.assetId ?? prev?.assetId ?? project.heroImageId ?? undefined),
    lastUserGoal: patch.lastUserGoal ?? prev?.lastUserGoal,
    repairLevel: patch.repairLevel ?? prev?.repairLevel,
    ...(patch.pendingClarification === null
      ? {}
      : patch.pendingClarification
        ? { pendingClarification: patch.pendingClarification }
        : prev?.pendingClarification
          ? { pendingClarification: prev.pendingClarification }
          : {}),
    updatedAt: nowIso(),
  };
  return withActiveVisualTask(project, next);
}

export function clearActiveVisualTaskPending(
  project: BusinessProject,
): BusinessProject {
  const prev = getActiveVisualTask(
    project.atlasActionMemory as AtlasActionMemory | undefined,
  );
  if (!prev) return project;
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
  memory: AtlasActionMemory | null | undefined,
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
  memory: AtlasActionMemory | null | undefined,
): boolean {
  if (!hasActiveHeroVisualTask(memory)) return false;
  if (TOPIC_SWITCH.test(request)) return false;
  return isHeroVisualContinuationRequest(request);
}
