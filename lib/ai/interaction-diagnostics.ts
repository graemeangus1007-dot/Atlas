/**
 * Sprint 29.5 — Developer-only interaction diagnostics.
 *
 * Never surfaces in production UI or production logs.
 * See: docs/atlas-interaction-ownership.md
 */

import { getLastExecution } from "@/lib/ai/atlas-action-memory";
import {
  findRetiredMirrorKeys,
  migrateToAtlasInteractionState,
  payloadHasRetiredMirrors,
} from "@/lib/ai/atlas-interaction-migrate";
import type { InteractionSource } from "@/lib/ai/atlas-interaction-types";
import {
  resolveImageReference,
  type ImageContextSource,
} from "@/lib/ai/image-reference-resolver";
import {
  getInteractionState,
  getInteractionWriteLedger,
  INTERACTION_ADAPTER_PHASE,
  INTERACTION_STATE_VERSION,
  type PendingClarificationSource,
  type SerializationMode,
  type TaskTransitionKind,
} from "@/lib/ai/interaction-state";
import type { BusinessProject } from "@/types/business-project";

export type InteractionDiagnosticsSnapshot = {
  interactionOwner: "atlasActionMemory";
  interactionVersion: typeof INTERACTION_STATE_VERSION;
  interactionSource: InteractionSource | null;
  serializationMode: SerializationMode;
  adapterPhase: typeof INTERACTION_ADAPTER_PHASE;
  adapterUsage: true;
  writeOrigin: string | null;
  writeCount: number;
  legacyDirectWrites: 0;
  legacyPayloadDetected: boolean;
  migrationPerformed: boolean;
  retiredMirrorKeysFound: string[];
  interactionSerializedBytes: number;
  imageContextSource: ImageContextSource;
  canonicalStatePresent: boolean;
  pendingClarificationSource: PendingClarificationSource;
  pendingClarificationKind: string | null;
  pendingClarificationDestination: string | null;
  lastClarificationClearReason: string | null;
  duplicateClarificationDetected: boolean;
  /** Canonical active task (all domains). */
  activeTask: ReturnType<typeof getInteractionState>["activeTask"];
  activeTaskKind: string | null;
  activeTaskTarget: string | null;
  activeTaskAssetId: string | null;
  continuationOwner: string | null;
  continuationMatched: boolean;
  taskTransition: TaskTransitionKind | null;
  taskTransitionReason: string | null;
  activePlanConsidered: boolean;
  activePlanExecuted: boolean;
  pendingClarification: ReturnType<typeof getInteractionState>["pendingClarification"];
  plan: {
    recommendationCount: number;
    applyAllPending: boolean;
    source: string | undefined;
    executionGoal: string | null;
  };
  lastVerifiedExecution: {
    request: string | null;
    success: boolean | null;
    verified: boolean | null;
    scope: string | null;
    hasPaletteBefore: boolean;
  };
  preservationConstraints: {
    brandPaletteCaptured: boolean;
    heroAssetId: string | null;
  };
  repair: ReturnType<typeof getInteractionState>["repair"];
  updatedAt: string;
};

function formatTaskTarget(
  target: NonNullable<
    ReturnType<typeof getInteractionState>["activeTask"]
  >["target"] | null | undefined,
): string | null {
  if (!target) return null;
  if (target.type === "gallery") {
    return target.itemId
      ? `gallery:${target.itemId}`
      : target.index != null
        ? `gallery:${target.index}`
        : "gallery";
  }
  if (target.type === "section") return `section:${target.section}`;
  if (target.type === "surface") return `surface:${target.surface}`;
  return target.type;
}

function isDevDiagnosticsEnabled(): boolean {
  return process.env.NODE_ENV !== "production";
}

/**
 * Build a structured diagnostics snapshot (safe to call anytime).
 * Returns null in production so callers never render it.
 */
export function getInteractionDiagnostics(
  project: BusinessProject,
  options?: { message?: string },
): InteractionDiagnosticsSnapshot | null {
  if (!isDevDiagnosticsEnabled()) return null;

  const state = getInteractionState(project);
  const migrated = migrateToAtlasInteractionState(project.atlasActionMemory);
  const last = getLastExecution({
    lastVerifiedExecution: state.lastVerifiedExecution,
    updatedAt: state.updatedAt,
  });
  const active = state.activeTask;
  const ledger = getInteractionWriteLedger();
  const pending = state.pendingClarification ?? null;
  const retired = findRetiredMirrorKeys(project.atlasActionMemory);
  const imageCtx = resolveImageReference({
    interactionState: state,
    project,
    message: options?.message ?? "",
  });

  let source: PendingClarificationSource = "none";
  if (pending?.pendingQuestion) {
    source =
      pending.context?.promotedFrom ===
      "activeVisualTask.pendingClarification"
        ? "legacy_promoted"
        : "top_level";
  } else if (ledger.pendingClarificationSource !== "none") {
    source = ledger.pendingClarificationSource;
  }

  return {
    interactionOwner: "atlasActionMemory",
    interactionVersion: INTERACTION_STATE_VERSION,
    interactionSource: migrated.source,
    serializationMode: "canonical_only",
    adapterPhase: INTERACTION_ADAPTER_PHASE,
    adapterUsage: true,
    writeOrigin: ledger.lastOrigin,
    writeCount: ledger.count,
    legacyDirectWrites: 0,
    legacyPayloadDetected:
      migrated.source === "legacy_migrated" ||
      migrated.source === "v1_with_mirrors" ||
      payloadHasRetiredMirrors(project.atlasActionMemory),
    migrationPerformed: migrated.migrationPerformed,
    retiredMirrorKeysFound: retired,
    interactionSerializedBytes:
      ledger.interactionSerializedBytes ||
      JSON.stringify(state).length,
    imageContextSource: imageCtx.source,
    canonicalStatePresent: state.version === INTERACTION_STATE_VERSION,
    pendingClarificationSource: source,
    pendingClarificationKind: pending?.kind ?? null,
    pendingClarificationDestination: pending?.destination ?? null,
    lastClarificationClearReason:
      state.lastClarificationClear?.reason ??
      ledger.lastClarificationClearReason,
    duplicateClarificationDetected: ledger.duplicateClarificationDetected,
    activeTask: active,
    activeTaskKind: active?.kind ?? null,
    activeTaskTarget: formatTaskTarget(active?.target),
    activeTaskAssetId: active?.assetId ?? null,
    continuationOwner: ledger.continuationOwner,
    continuationMatched: ledger.continuationMatched,
    taskTransition: ledger.taskTransition,
    taskTransitionReason: ledger.taskTransitionReason,
    activePlanConsidered: ledger.activePlanConsidered,
    activePlanExecuted: ledger.activePlanExecuted,
    pendingClarification: pending,
    plan: {
      recommendationCount: state.activePlan?.recommendations?.length ?? 0,
      applyAllPending: Boolean(state.activePlan?.applyAllPending),
      source: state.activePlan?.source,
      executionGoal: state.activePlan?.executionPlan?.goal ?? null,
    },
    lastVerifiedExecution: {
      request: last?.request ?? null,
      success: last?.success ?? null,
      verified: last?.verified ?? null,
      scope: last?.scope ?? null,
      hasPaletteBefore: Boolean(
        last?.paletteBefore || state.preservation?.brandPalette,
      ),
    },
    preservationConstraints: {
      brandPaletteCaptured: Boolean(
        state.preservation?.brandPalette || last?.paletteBefore,
      ),
      heroAssetId:
        state.preservation?.heroAssetId ??
        project.heroImageId ??
        active?.assetId ??
        null,
    },
    repair: state.repair ?? null,
    updatedAt: state.updatedAt,
  };
}

/** Human-readable diagnostics block for local debugging. */
export function formatInteractionDiagnostics(
  project: BusinessProject,
): string | null {
  const snap = getInteractionDiagnostics(project);
  if (!snap) return null;

  const lines = [
    "[atlas:interaction]",
    `  owner: ${snap.interactionOwner}`,
    `  version: ${snap.interactionVersion}`,
    `  source: ${snap.interactionSource ?? "-"}`,
    `  serializationMode: ${snap.serializationMode}`,
    `  adapterPhase: ${snap.adapterPhase}`,
    `  writeOrigin: ${snap.writeOrigin ?? "(none yet)"}`,
    `  writeCount: ${snap.writeCount}`,
    `  legacyPayloadDetected: ${snap.legacyPayloadDetected}`,
    `  migrationPerformed: ${snap.migrationPerformed}`,
    `  retiredMirrorKeysFound: ${snap.retiredMirrorKeysFound.join(",") || "(none)"}`,
    `  interactionSerializedBytes: ${snap.interactionSerializedBytes}`,
    `  imageContextSource: ${snap.imageContextSource}`,
    `  pendingSource: ${snap.pendingClarificationSource}`,
    `  pendingKind: ${snap.pendingClarificationKind ?? "-"}`,
    `  activeTaskKind: ${snap.activeTaskKind ?? "(none)"}`,
    `  activeTaskTarget: ${snap.activeTaskTarget ?? "-"}`,
    `  activeTaskAssetId: ${snap.activeTaskAssetId ?? "-"}`,
    `  continuationOwner: ${snap.continuationOwner ?? "-"}`,
    `  continuationMatched: ${snap.continuationMatched}`,
    `  taskTransition: ${snap.taskTransition ?? "-"}`,
    `  taskTransitionReason: ${snap.taskTransitionReason ?? "-"}`,
    `  activePlanConsidered: ${snap.activePlanConsidered}`,
    `  activePlanExecuted: ${snap.activePlanExecuted}`,
    `  plan: recs=${snap.plan.recommendationCount} applyAll=${snap.plan.applyAllPending}`,
    `  lastVerified: success=${snap.lastVerifiedExecution.success} verified=${snap.lastVerifiedExecution.verified}`,
    `  repair: ${snap.repair?.heroReadability ? `level=${snap.repair.heroReadability.level}` : "(none)"}`,
  ];
  return lines.join("\n");
}

/**
 * Log diagnostics to the console in development only.
 * No-op in production.
 */
export function logInteractionDiagnostics(project: BusinessProject): void {
  if (!isDevDiagnosticsEnabled()) return;
  const text = formatInteractionDiagnostics(project);
  if (text && typeof console !== "undefined" && console.info) {
    console.info(text);
  }
}
