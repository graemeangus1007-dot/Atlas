/**
 * Sprint 29.3 — Canonical AtlasInteractionState (version 1).
 * Persisted inside content.atlasActionMemory (same key). No sibling blob.
 *
 * See: docs/atlas-interaction-ownership.md
 */

import type {
  AtlasPendingClarification,
  AtlasStoredRecommendation,
  ClarificationClearReason,
} from "@/lib/ai/atlas-action-memory";
import type { AtlasExecutionPlan } from "@/lib/ai/atlas-brain-types";
import type { AtlasLastExecution } from "@/lib/ai/edit-execution-result";
import type { ActiveVisualTaskKind } from "@/lib/ai/active-visual-task";

export const ATLAS_INTERACTION_STATE_VERSION = 1 as const;

export type AtlasActiveTaskKind =
  | ActiveVisualTaskKind
  | "gallery_interaction"
  | "gallery_metadata"
  | "surface_style"
  | "image_placement"
  | "section_layout"
  | "plan_execution"
  | "brand_restore";

export type AtlasActiveTaskTarget =
  | { type: "hero" }
  | { type: "gallery"; itemId?: string; index?: number }
  | { type: "section"; section: string }
  | { type: "surface"; surface: string }
  | { type: "logo" }
  | { type: "plan" }
  | { type: "unknown" };

/**
 * Canonical active editing task (Sprint 29.5 — all supported domains).
 * One task at a time; short follow-ups continue via active-task policy.
 */
export type AtlasActiveTask = {
  kind: AtlasActiveTaskKind;
  target: AtlasActiveTaskTarget;
  assetId?: string;
  /** Latest user goal for this task (required for new writes). */
  userGoal?: string;
  repairLevel?: number;
  updatedAt: string;
};

export type TaskTransition =
  | "created"
  | "updated"
  | "preserved"
  | "replaced"
  | "cleared";

export type TaskClearReason =
  | "critique_override"
  | "topic_switch"
  | "completed"
  | "cancelled"
  | "explicit"
  | "replaced";

/** Alias — pending clarification shape is shared with Action Memory. */
export type PendingClarification = AtlasPendingClarification;

/** Last verified execution — same fields as legacy lastExecution. */
export type LastVerifiedExecution = AtlasLastExecution;

export type InteractionPreservation = {
  brandPalette?: {
    primaryColor: string;
    secondaryColor: string;
    accentColor: string;
    backgroundColor: string;
    headingFont?: string;
    bodyFont?: string;
    theme?: "light" | "dark" | "auto";
  };
  heroAssetId?: string | null;
};

export type ActiveInteractionPlan = {
  recommendations: AtlasStoredRecommendation[];
  recommendationIds: string[];
  executionPlan?: AtlasExecutionPlan;
  creativeReport?: {
    overallCompleteness: number;
    maturityLevel: string;
    fingerprint: string;
    reviewedAt: string;
  };
  /**
   * v1.5 Transformation Engine plan (Phase 2).
   * When present, Apply All executes this coordinated plan.
   */
  transformationPlan?: import("@/lib/transformation/types").TransformationPlan | null;
  source?: "creative_director" | "business_advisor" | "design_critique" | "mixed";
  applyAllPending: boolean;
  lastSelectedId?: string | null;
};

export type InteractionRepairState = {
  heroReadability?: {
    level: 0 | 1 | 2 | 3;
    heroImageId: string | null;
    updatedAt: string;
  } | null;
};

/**
 * Canonical interaction record (v1).
 * Authoritative fields for Phase 3+.
 */
export type AtlasInteractionState = {
  version: typeof ATLAS_INTERACTION_STATE_VERSION;
  updatedAt: string;

  activeTask: AtlasActiveTask | null;
  pendingClarification: PendingClarification | null;
  lastVerifiedExecution: LastVerifiedExecution | null;
  preservation: InteractionPreservation | null;
  activePlan: ActiveInteractionPlan | null;
  repair: InteractionRepairState | null;

  lastClarificationClear?: {
    reason: ClarificationClearReason;
    at: string;
  } | null;
};

export type InteractionSource =
  | "v1_canonical"
  | "legacy_migrated"
  | "v1_with_mirrors"
  | "empty_default";

export function emptyAtlasInteractionState(
  updatedAt = new Date().toISOString(),
): AtlasInteractionState {
  return {
    version: ATLAS_INTERACTION_STATE_VERSION,
    updatedAt,
    activeTask: null,
    pendingClarification: null,
    lastVerifiedExecution: null,
    preservation: null,
    activePlan: null,
    repair: null,
    lastClarificationClear: null,
  };
}
