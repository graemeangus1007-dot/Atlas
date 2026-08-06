/**
 * Sprint 29.5 — Canonical active-task policy.
 *
 * One continuation model for hero, gallery, surface, section, brand, plan,
 * and image placement. Routing uses this policy instead of growing Action
 * Memory deny-lists.
 *
 * See: docs/atlas-interaction-ownership.md
 */

import type {
  AtlasActiveTask,
  AtlasActiveTaskKind,
  AtlasActiveTaskTarget,
  TaskClearReason,
  TaskTransition,
} from "@/lib/ai/atlas-interaction-types";
import {
  getInteractionState,
  recordActiveTaskDiagnostics,
  updateInteractionState,
} from "@/lib/ai/interaction-state";
import { isHeroVisualContinuationRequest } from "@/lib/ai/active-visual-task";
import { isGalleryLightboxRequest } from "@/lib/ai/gallery-interaction";
import { isGalleryMetadataRequest } from "@/lib/ai/gallery-metadata";
import { isHeroPatternApplicationRequest } from "@/lib/ai/hero-pattern-application";
import {
  isHeroFitRequest,
  isHeroProfessionalCompositionRequest,
  isSoftHeroVisibilityRequest,
} from "@/lib/ai/hero-image-presentation";
import { isHeroReadabilityRequest } from "@/lib/ai/hero-readability";
import { isHeroImageVisibilityComplaint } from "@/lib/ai/hero-visual-balance";
import { isSurfaceStyleRequest } from "@/lib/ai/surface-styling";
import { isSectionOrderRequest } from "@/lib/ai/section-order";
import { shouldOverridePendingClarification } from "@/lib/ai/critique-request";
import { isExecutionDisputeRequest } from "@/lib/ai/edit-execution-result";
import type { BusinessProject } from "@/types/business-project";

export type ActiveTaskIntent =
  | AtlasActiveTaskKind
  | "critique"
  | "informational"
  | "dispute"
  | "clarification"
  | "unknown";

export type ActiveTaskPolicy = {
  kind: AtlasActiveTaskKind;
  allowedTargets: Array<AtlasActiveTaskTarget["type"]>;
  continuationSignals: RegExp;
  topicSwitchSignals: RegExp;
  blocksActivePlan: boolean;
  requiresPreservation: boolean;
  clarificationKinds: string[];
};

const GALLERY_INTERACTION_CONTINUE =
  /\b(hide|show|turn\s+(that\s+)?off|captions?|swipe|navigation|lightbox|viewer|full[- ]?screen|click|tap)\b/i;

const GALLERY_METADATA_CONTINUE =
  /\b(titles?|captions?|labels?|rename|alt\s+text|the\s+(first|second|third|other|rest))\b/i;

const SURFACE_CONTINUE =
  /\b((a\s+little\s+)?(lighter|darker|brighter)|darker\s+borders?|make\s+the\s+text\s+black|undo\s+(that\s+)?color|more\s+contrast|softer)\b/i;

const SECTION_CONTINUE =
  /\b(put|move|place)\b[\s\S]{0,40}\b(above|below|before|after|higher|lower|bottom|top)\b|\b(testimonials?|services?|faq|contact|about|gallery)\b/i;

const BRAND_CONTINUE =
  /\b(restore|gold|warmer|cooler|keep\s+the\s+green|accent|palette|brand\s+color)\b/i;

const IMAGE_PLACEMENT_CONTINUE =
  /\b(move\s+it|use\s+it|make\s+that|put\s+it|about|gallery|logo|hero|full\s+(picture|photo|image))\b/i;

const PLAN_CONTINUE =
  /\b(apply\s+all|apply\s+the|do\s+those|yes\.?$|do\s+it|go\s+ahead)\b/i;

const GLOBAL_TOPIC_SWITCH =
  /\b(complete\s+my\s+website|finish\s+my\s+website|review\s+(the\s+)?(whole\s+)?(my\s+)?(website|site)|redesign\s+(the\s+)?(whole\s+)?(site|website))\b/i;

const INFORMATIONAL =
  /\b(why\s+did\s+you|why\s+is|what\s+does|how\s+come|explain|tell\s+me\s+why)\b/i;

const POLICIES: Record<AtlasActiveTaskKind, ActiveTaskPolicy> = {
  hero_readability: {
    kind: "hero_readability",
    allowedTargets: ["hero"],
    continuationSignals:
      /\b(clearer|readable|darker|lighter|overlay|contrast|still\s+too)\b/i,
    topicSwitchSignals: GLOBAL_TOPIC_SWITCH,
    blocksActivePlan: true,
    requiresPreservation: true,
    clarificationKinds: [],
  },
  hero_balance: {
    kind: "hero_balance",
    allowedTargets: ["hero"],
    continuationSignals:
      /\b(image\s+(is\s+)?hard\s+to\s+see|visible|balance|lighter|darker|scrim)\b/i,
    topicSwitchSignals: GLOBAL_TOPIC_SWITCH,
    blocksActivePlan: true,
    requiresPreservation: true,
    clarificationKinds: [],
  },
  hero_image_fit: {
    kind: "hero_image_fit",
    allowedTargets: ["hero"],
    continuationSignals:
      /\b(full\s+(picture|photo|image)|don'?t\s+crop|crop|fit|zoom|cut\s+off)\b/i,
    topicSwitchSignals: GLOBAL_TOPIC_SWITCH,
    blocksActivePlan: true,
    requiresPreservation: true,
    clarificationKinds: ["image_target"],
  },
  hero_crop: {
    kind: "hero_crop",
    allowedTargets: ["hero"],
    continuationSignals: /\b(crop|zoom|tighter|wider|focus)\b/i,
    topicSwitchSignals: GLOBAL_TOPIC_SWITCH,
    blocksActivePlan: true,
    requiresPreservation: true,
    clarificationKinds: ["crop_position"],
  },
  hero_composition: {
    kind: "hero_composition",
    allowedTargets: ["hero"],
    continuationSignals:
      /\b(professional|composition|layout|hero|cinematic|coastal|contractor|minimal|pattern)\b/i,
    topicSwitchSignals: GLOBAL_TOPIC_SWITCH,
    blocksActivePlan: true,
    requiresPreservation: true,
    clarificationKinds: [],
  },
  gallery_interaction: {
    kind: "gallery_interaction",
    allowedTargets: ["gallery"],
    continuationSignals: GALLERY_INTERACTION_CONTINUE,
    topicSwitchSignals: GLOBAL_TOPIC_SWITCH,
    blocksActivePlan: true,
    requiresPreservation: false,
    clarificationKinds: [],
  },
  gallery_metadata: {
    kind: "gallery_metadata",
    allowedTargets: ["gallery"],
    continuationSignals: GALLERY_METADATA_CONTINUE,
    topicSwitchSignals: GLOBAL_TOPIC_SWITCH,
    blocksActivePlan: true,
    requiresPreservation: false,
    clarificationKinds: [],
  },
  image_placement: {
    kind: "image_placement",
    allowedTargets: ["hero", "gallery", "section", "logo"],
    continuationSignals: IMAGE_PLACEMENT_CONTINUE,
    topicSwitchSignals: GLOBAL_TOPIC_SWITCH,
    blocksActivePlan: true,
    requiresPreservation: false,
    clarificationKinds: ["image_target"],
  },
  surface_style: {
    kind: "surface_style",
    allowedTargets: ["surface", "section", "unknown"],
    continuationSignals: SURFACE_CONTINUE,
    topicSwitchSignals: GLOBAL_TOPIC_SWITCH,
    blocksActivePlan: true,
    requiresPreservation: true,
    clarificationKinds: ["color"],
  },
  section_layout: {
    kind: "section_layout",
    allowedTargets: ["section"],
    continuationSignals: SECTION_CONTINUE,
    topicSwitchSignals: GLOBAL_TOPIC_SWITCH,
    blocksActivePlan: true,
    requiresPreservation: false,
    clarificationKinds: [],
  },
  brand_restore: {
    kind: "brand_restore",
    allowedTargets: ["unknown"],
    continuationSignals: BRAND_CONTINUE,
    topicSwitchSignals: GLOBAL_TOPIC_SWITCH,
    blocksActivePlan: true,
    requiresPreservation: true,
    clarificationKinds: ["color"],
  },
  plan_execution: {
    kind: "plan_execution",
    allowedTargets: ["plan"],
    continuationSignals: PLAN_CONTINUE,
    topicSwitchSignals: GLOBAL_TOPIC_SWITCH,
    blocksActivePlan: false,
    requiresPreservation: false,
    clarificationKinds: ["recommendation"],
  },
};

function nowIso(): string {
  return new Date().toISOString();
}

export function getActiveTaskPolicy(
  taskKind: AtlasActiveTaskKind,
): ActiveTaskPolicy {
  return POLICIES[taskKind];
}

/** Infer a fresh intent from the request (not continuation). */
export function detectFreshTaskIntent(request: string): ActiveTaskIntent {
  const text = request.trim();
  if (!text) return "unknown";
  if (shouldOverridePendingClarification(text)) return "critique";
  if (isExecutionDisputeRequest(text)) return "dispute";
  if (INFORMATIONAL.test(text)) return "informational";
  if (isGalleryLightboxRequest(text)) return "gallery_interaction";
  if (isGalleryMetadataRequest(text)) return "gallery_metadata";
  if (isSurfaceStyleRequest(text)) return "surface_style";
  if (isSectionOrderRequest(text)) return "section_layout";
  if (isHeroReadabilityRequest(text)) return "hero_readability";
  if (isHeroImageVisibilityComplaint(text) || isSoftHeroVisibilityRequest(text)) {
    return "hero_balance";
  }
  if (isHeroPatternApplicationRequest(text)) return "hero_composition";
  if (isHeroProfessionalCompositionRequest(text)) return "hero_composition";
  if (isHeroFitRequest(text)) return "hero_image_fit";
  if (PLAN_CONTINUE.test(text)) return "plan_execution";
  if (
    /\b(use\s+this\s+as|put\s+this\s+in|make\s+this\s+the|add\s+these\s+to\s+the\s+gallery)\b/i.test(
      text,
    )
  ) {
    return "image_placement";
  }
  if (/\b(restore|gold\s+accent|brand\s+colors?)\b/i.test(text)) {
    return "brand_restore";
  }
  // Contact-form copy/layout asks leave hero / gallery tasks.
  if (
    /\bcontact\s+form\b/i.test(text) &&
    /\b(shorter|update|change|make|edit|fields?)\b/i.test(text)
  ) {
    return "surface_style";
  }
  return "unknown";
}

/**
 * Explicit domain change that should clear/replace the prior task immediately
 * (even before the new domain verifies success).
 */
export function isExplicitTopicSwitch(
  current: AtlasActiveTask | null | undefined,
  request: string,
): boolean {
  if (!current) return false;
  const text = request.trim();
  if (!text) return false;
  if (INFORMATIONAL.test(text)) return false;
  if (canContinueActiveTask(current, text)) return false;
  if (GLOBAL_TOPIC_SWITCH.test(text)) return true;
  const fresh = detectFreshTaskIntent(text);
  if (fresh === "unknown" || fresh === "informational" || fresh === "dispute") {
    return false;
  }
  if (fresh === current.kind) return false;
  if (
    current.kind.startsWith("hero_") &&
    typeof fresh === "string" &&
    fresh.startsWith("hero_")
  ) {
    return false;
  }
  return shouldReplaceActiveTask(current, fresh);
}

export function canContinueActiveTask(
  task: AtlasActiveTask | null | undefined,
  request: string,
): boolean {
  if (!task) return false;
  const text = request.trim();
  if (!text) return false;
  if (shouldOverridePendingClarification(text)) return false;
  if (INFORMATIONAL.test(text)) return false;

  const policy = getActiveTaskPolicy(task.kind);
  if (policy.topicSwitchSignals.test(text)) return false;

  // Fresh command for a different domain → not a continuation
  const fresh = detectFreshTaskIntent(text);
  if (
    fresh !== "unknown" &&
    fresh !== "informational" &&
    fresh !== "dispute" &&
    fresh !== "clarification" &&
    fresh !== task.kind &&
    !(
      (task.kind.startsWith("hero_") && String(fresh).startsWith("hero_")) ||
      (task.kind === "image_placement" &&
        (fresh === "hero_image_fit" || String(fresh).startsWith("hero_")))
    )
  ) {
    // Same-family hero soft continuations still allowed via hero helpers below
    if (!(task.kind.startsWith("hero_") && String(fresh).startsWith("hero_"))) {
      return false;
    }
  }

  if (task.kind.startsWith("hero_")) {
    if (
      isHeroVisualContinuationRequest(text) ||
      isHeroFitRequest(text) ||
      isHeroReadabilityRequest(text) ||
      isHeroImageVisibilityComplaint(text) ||
      isSoftHeroVisibilityRequest(text) ||
      isHeroProfessionalCompositionRequest(text)
    ) {
      return true;
    }
  }

  if (policy.continuationSignals.test(text)) return true;

  // Explicit fresh request for the same domain also continues/updates the task
  if (fresh === task.kind) return true;

  return false;
}

export function shouldReplaceActiveTask(
  current: AtlasActiveTask | null | undefined,
  nextIntent: ActiveTaskIntent,
): boolean {
  if (!current) return nextIntent !== "unknown" && nextIntent !== "informational";
  if (nextIntent === "unknown" || nextIntent === "informational") return false;
  if (nextIntent === "dispute" || nextIntent === "clarification") return false;
  if (nextIntent === "critique") return true;
  if (nextIntent === current.kind) return false;
  // Hero family swaps are updates, not hard replaces
  if (
    current.kind.startsWith("hero_") &&
    typeof nextIntent === "string" &&
    nextIntent.startsWith("hero_")
  ) {
    return false;
  }
  if (
    current.kind === "image_placement" &&
    typeof nextIntent === "string" &&
    nextIntent.startsWith("hero_")
  ) {
    return true;
  }
  return true;
}

export function shouldClearActiveTask(
  reason: TaskClearReason | "informational" | "dispute",
  current: AtlasActiveTask | null | undefined,
  request?: string,
): boolean {
  if (!current) return false;
  if (reason === "informational") return false;
  if (reason === "dispute") return false;
  if (reason === "critique_override") return true;
  if (reason === "completed" || reason === "cancelled" || reason === "explicit") {
    return true;
  }
  if (reason === "topic_switch" || reason === "replaced") return true;
  if (request && GLOBAL_TOPIC_SWITCH.test(request)) return true;
  return false;
}

/** True when Action Memory / active plan must not run for this request. */
export function activeTaskBlocksPlanContinuation(
  memory: { activeTask?: AtlasActiveTask | null | undefined } | null | undefined,
  request: string,
): boolean {
  const task = memory?.activeTask ?? null;
  if (!task) return false;
  const policy = getActiveTaskPolicy(task.kind);
  if (!policy.blocksActivePlan) return false;
  if (canContinueActiveTask(task, request)) return true;

  // Fresh scoped command for a domain that owns the turn
  const fresh = detectFreshTaskIntent(request);
  if (
    fresh === "gallery_interaction" ||
    fresh === "gallery_metadata" ||
    fresh === "surface_style" ||
    fresh === "section_layout" ||
    fresh === "hero_readability" ||
    fresh === "hero_balance" ||
    fresh === "hero_image_fit" ||
    fresh === "hero_composition" ||
    fresh === "image_placement" ||
    fresh === "brand_restore"
  ) {
    return true;
  }
  return false;
}

export type TouchActiveTaskInput = {
  kind: AtlasActiveTaskKind;
  target: AtlasActiveTaskTarget;
  assetId?: string | null;
  userGoal: string;
  repairLevel?: number;
};

/**
 * Set or update the canonical active task after verified success / clarification.
 * Sole general writer for non-hero (and hero) domains.
 */
export function touchActiveTask(
  project: BusinessProject,
  patch: TouchActiveTaskInput,
): BusinessProject {
  const prev = getInteractionState(project).activeTask;
  const next: AtlasActiveTask = {
    kind: patch.kind,
    target: patch.target,
    assetId:
      patch.assetId === null
        ? undefined
        : (patch.assetId ?? prev?.assetId ?? undefined),
    userGoal: patch.userGoal,
    repairLevel: patch.repairLevel ?? prev?.repairLevel,
    updatedAt: nowIso(),
  };

  const { transition, reason } = classifyTaskTransition({
    before: prev,
    after: next,
  });
  recordActiveTaskDiagnostics({
    taskTransition: transition,
    taskTransitionReason: reason,
  });

  return updateInteractionState(
    project,
    (state) => ({
      ...state,
      activeTask: next,
      preservation:
        patch.kind.startsWith("hero_") || patch.target.type === "hero"
          ? {
              ...(state.preservation ?? {}),
              heroAssetId:
                next.assetId ??
                state.preservation?.heroAssetId ??
                project.heroImageId ??
                null,
            }
          : state.preservation,
      updatedAt: nowIso(),
    }),
    { origin: "active-task-policy.touchActiveTask" },
  );
}

export function clearActiveTask(
  project: BusinessProject,
  reason: TaskClearReason,
): BusinessProject {
  recordActiveTaskDiagnostics({
    taskTransition: "cleared",
    taskTransitionReason: reason,
  });
  return updateInteractionState(
    project,
    (state) => ({
      ...state,
      activeTask: null,
      updatedAt: nowIso(),
    }),
    { origin: "active-task-policy.clearActiveTask" },
  );
}

export function classifyTaskTransition(input: {
  before: AtlasActiveTask | null | undefined;
  after: AtlasActiveTask | null | undefined;
}): { transition: TaskTransition; reason: string } {
  const { before, after } = input;
  if (!before && after) {
    return { transition: "created", reason: after.kind };
  }
  if (before && !after) {
    return { transition: "cleared", reason: "cleared" };
  }
  if (before && after && before.kind !== after.kind) {
    return {
      transition: "replaced",
      reason: `${before.kind}->${after.kind}`,
    };
  }
  if (
    before &&
    after &&
    (before.userGoal !== after.userGoal ||
      before.assetId !== after.assetId ||
      JSON.stringify(before.target) !== JSON.stringify(after.target))
  ) {
    return { transition: "updated", reason: after.kind };
  }
  return { transition: "preserved", reason: after?.kind ?? "none" };
}

/** Soft gallery interaction follow-ups when a gallery_interaction task is active. */
export function isGalleryInteractionContinuation(request: string): boolean {
  return GALLERY_INTERACTION_CONTINUE.test(request.trim());
}

/** Soft gallery metadata follow-ups when a gallery_metadata task is active. */
export function isGalleryMetadataContinuation(request: string): boolean {
  return GALLERY_METADATA_CONTINUE.test(request.trim());
}

/** Soft surface follow-ups when a surface_style task is active. */
export function isSurfaceStyleContinuation(request: string): boolean {
  return SURFACE_CONTINUE.test(request.trim());
}
