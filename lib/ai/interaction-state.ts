/**
 * Sprint 29.4 / Phase 4 — Canonical AtlasInteractionState only.
 *
 * Sole mutation API for conversational/editing continuation state.
 * Persists inside `project.atlasActionMemory` (same key) as canonical v1.
 * Legacy mirrors are accepted on read (migration) and never written.
 *
 * See: docs/atlas-interaction-ownership.md
 */

import type {
  AtlasActionMemory,
  ClarificationClearReason,
} from "@/lib/ai/atlas-action-memory";
import {
  findRetiredMirrorKeys,
  measureInteractionSerializedBytes,
  migrateToAtlasInteractionState,
  payloadHasRetiredMirrors,
  serializeCanonicalInteractionState,
  validateCanonicalInteractionSafety,
} from "@/lib/ai/atlas-interaction-migrate";
import {
  ATLAS_INTERACTION_STATE_VERSION,
  emptyAtlasInteractionState,
  type AtlasInteractionState,
  type InteractionSource,
} from "@/lib/ai/atlas-interaction-types";
import type { BusinessProject } from "@/types/business-project";

/** Canonical interaction state (v1). */
export type InteractionState = AtlasInteractionState;

/** Interaction contract version. */
export const INTERACTION_STATE_VERSION = ATLAS_INTERACTION_STATE_VERSION;

export type InteractionStateVersion = typeof INTERACTION_STATE_VERSION;

/** Phase marker for diagnostics (5 = generalized canonical active tasks). */
export const INTERACTION_ADAPTER_PHASE = 5 as const;

export type SerializationMode = "canonical_only";

export type InteractionWriteMeta = {
  /** Optional stable origin label for diagnostics (e.g. "atlas-brain.rememberExecution"). */
  origin?: string;
};

export type PendingClarificationSource =
  | "top_level"
  | "legacy_promoted"
  | "none";

export type TaskTransitionKind =
  | "created"
  | "updated"
  | "preserved"
  | "replaced"
  | "cleared";

type WriteLedger = {
  count: number;
  lastOrigin: string | null;
  lastAt: string | null;
  adapterUsage: true;
  legacyDirectWrites: 0;
  pendingClarificationSource: PendingClarificationSource;
  lastClarificationClearReason: ClarificationClearReason | null;
  lastPromotionAt: string | null;
  duplicateClarificationDetected: boolean;
  interactionSource: InteractionSource | null;
  canonicalStatePresent: boolean;
  legacyPayloadDetected: boolean;
  retiredMirrorKeysFound: string[];
  migrationPerformed: boolean;
  serializationMode: SerializationMode;
  interactionSerializedBytes: number;
  safetyViolations: string[];
  /** Sprint 29.5 — active-task turn diagnostics */
  continuationOwner: string | null;
  continuationMatched: boolean;
  taskTransition: TaskTransitionKind | null;
  taskTransitionReason: string | null;
  activePlanConsidered: boolean;
  activePlanExecuted: boolean;
};

const writeLedger: WriteLedger = {
  count: 0,
  lastOrigin: null,
  lastAt: null,
  adapterUsage: true,
  legacyDirectWrites: 0,
  pendingClarificationSource: "none",
  lastClarificationClearReason: null,
  lastPromotionAt: null,
  duplicateClarificationDetected: false,
  interactionSource: null,
  canonicalStatePresent: false,
  legacyPayloadDetected: false,
  retiredMirrorKeysFound: [],
  migrationPerformed: false,
  serializationMode: "canonical_only",
  interactionSerializedBytes: 0,
  safetyViolations: [],
  continuationOwner: null,
  continuationMatched: false,
  taskTransition: null,
  taskTransitionReason: null,
  activePlanConsidered: false,
  activePlanExecuted: false,
};

function isDevOrTest(): boolean {
  return process.env.NODE_ENV !== "production";
}

function recordWrite(meta?: InteractionWriteMeta): void {
  if (!isDevOrTest()) return;
  writeLedger.count += 1;
  writeLedger.lastAt = new Date().toISOString();
  writeLedger.lastOrigin =
    meta?.origin?.trim() ||
    inferWriteOriginFromStack() ||
    "interaction-state.setInteractionState";
}

function inferWriteOriginFromStack(): string | null {
  try {
    const stack = new Error().stack ?? "";
    const lines = stack.split("\n").map((l) => l.trim());
    for (const line of lines) {
      if (!line.includes(".ts")) continue;
      if (line.includes("interaction-state.ts")) continue;
      if (line.includes("node:internal")) continue;
      const match =
        line.match(/at\s+(?:async\s+)?([^\s(]+)/) ||
        line.match(/([^/\\]+\.ts(?::\d+:\d+)?)/);
      if (match?.[1]) return match[1];
    }
  } catch {
    /* ignore */
  }
  return null;
}

function nowIso(): string {
  return new Date().toISOString();
}

function recordMigrationDiagnostics(
  migrated: ReturnType<typeof migrateToAtlasInteractionState>,
  rawInbound: unknown,
  payload: AtlasActionMemory,
): void {
  if (!isDevOrTest()) return;
  writeLedger.interactionSource = migrated.source;
  writeLedger.migrationPerformed = migrated.migrationPerformed;
  writeLedger.legacyPayloadDetected =
    migrated.source === "legacy_migrated" ||
    migrated.source === "v1_with_mirrors" ||
    payloadHasRetiredMirrors(rawInbound);
  writeLedger.retiredMirrorKeysFound = findRetiredMirrorKeys(rawInbound);
  writeLedger.canonicalStatePresent =
    migrated.state.version === ATLAS_INTERACTION_STATE_VERSION;
  writeLedger.serializationMode = "canonical_only";
  writeLedger.interactionSerializedBytes = measureInteractionSerializedBytes(
    migrated.state,
  );
  writeLedger.safetyViolations = validateCanonicalInteractionSafety(
    migrated.state,
  );
  writeLedger.pendingClarificationSource = migrated.state.pendingClarification
    ?.pendingQuestion
    ? migrated.state.pendingClarification.context?.promotedFrom ===
      "activeVisualTask.pendingClarification"
      ? "legacy_promoted"
      : "top_level"
    : "none";
  if (
    migrated.migrationPerformed &&
    writeLedger.pendingClarificationSource === "legacy_promoted"
  ) {
    writeLedger.lastPromotionAt = nowIso();
  }
  if (migrated.state.lastClarificationClear?.reason) {
    writeLedger.lastClarificationClearReason =
      migrated.state.lastClarificationClear.reason;
  }
  // Persisted payload must not retain retired keys.
  void payload;
}

/**
 * Accept canonical v1 or legacy / hybrid Action Memory payloads.
 * Always persists canonical v1 only.
 */
function toCanonicalState(
  state: AtlasInteractionState | AtlasActionMemory | null | undefined,
): ReturnType<typeof migrateToAtlasInteractionState> {
  if (!state) {
    return {
      state: emptyAtlasInteractionState(),
      source: "empty_default",
      migrationPerformed: true,
      legacyConflictDetected: false,
    };
  }
  return migrateToAtlasInteractionState(state);
}

/** Dev/test write ledger for diagnostics + contract tests. */
export function getInteractionWriteLedger(): WriteLedger {
  return { ...writeLedger };
}

/** Reset write ledger (tests only). */
export function resetInteractionWriteLedger(): void {
  writeLedger.count = 0;
  writeLedger.lastOrigin = null;
  writeLedger.lastAt = null;
  writeLedger.pendingClarificationSource = "none";
  writeLedger.lastClarificationClearReason = null;
  writeLedger.lastPromotionAt = null;
  writeLedger.duplicateClarificationDetected = false;
  writeLedger.interactionSource = null;
  writeLedger.canonicalStatePresent = false;
  writeLedger.legacyPayloadDetected = false;
  writeLedger.retiredMirrorKeysFound = [];
  writeLedger.migrationPerformed = false;
  writeLedger.serializationMode = "canonical_only";
  writeLedger.interactionSerializedBytes = 0;
  writeLedger.safetyViolations = [];
  writeLedger.continuationOwner = null;
  writeLedger.continuationMatched = false;
  writeLedger.taskTransition = null;
  writeLedger.taskTransitionReason = null;
  writeLedger.activePlanConsidered = false;
  writeLedger.activePlanExecuted = false;
}

/** Dev/test — record active-task / plan continuation diagnostics for a turn. */
export function recordActiveTaskDiagnostics(patch: {
  continuationOwner?: string | null;
  continuationMatched?: boolean;
  taskTransition?: TaskTransitionKind | null;
  taskTransitionReason?: string | null;
  activePlanConsidered?: boolean;
  activePlanExecuted?: boolean;
}): void {
  if (!isDevOrTest()) return;
  if (patch.continuationOwner !== undefined) {
    writeLedger.continuationOwner = patch.continuationOwner;
  }
  if (patch.continuationMatched !== undefined) {
    writeLedger.continuationMatched = patch.continuationMatched;
  }
  if (patch.taskTransition !== undefined) {
    writeLedger.taskTransition = patch.taskTransition;
  }
  if (patch.taskTransitionReason !== undefined) {
    writeLedger.taskTransitionReason = patch.taskTransitionReason;
  }
  if (patch.activePlanConsidered !== undefined) {
    writeLedger.activePlanConsidered = patch.activePlanConsidered;
  }
  if (patch.activePlanExecuted !== undefined) {
    writeLedger.activePlanExecuted = patch.activePlanExecuted;
  }
}

export function recordClarificationClearReason(
  reason: ClarificationClearReason,
): void {
  if (!isDevOrTest()) return;
  writeLedger.lastClarificationClearReason = reason;
}

/**
 * Read canonical AtlasInteractionState from a project.
 * Lazy-migrates legacy Action Memory; does not persist (use normalizeInteractionState).
 */
export function getInteractionState(
  project: BusinessProject | null | undefined,
): AtlasInteractionState {
  if (!project) return emptyAtlasInteractionState();
  const migrated = migrateToAtlasInteractionState(project.atlasActionMemory);
  if (isDevOrTest()) {
    writeLedger.interactionSource = migrated.source;
    writeLedger.migrationPerformed = migrated.migrationPerformed;
    writeLedger.legacyPayloadDetected =
      migrated.source === "legacy_migrated" ||
      migrated.source === "v1_with_mirrors" ||
      payloadHasRetiredMirrors(project.atlasActionMemory);
    writeLedger.retiredMirrorKeysFound = findRetiredMirrorKeys(
      project.atlasActionMemory,
    );
    writeLedger.canonicalStatePresent =
      migrated.state.version === ATLAS_INTERACTION_STATE_VERSION;
  }
  return migrated.state;
}

/**
 * Replace interaction state on a project.
 * This is the only function that may assign `project.atlasActionMemory`.
 * Accepts canonical v1 or legacy Action Memory; always writes canonical v1 only.
 */
export function setInteractionState(
  project: BusinessProject,
  state:
    | AtlasInteractionState
    | AtlasActionMemory
    | null
    | undefined,
  meta?: InteractionWriteMeta,
): BusinessProject {
  recordWrite(meta);
  const migrated = toCanonicalState(state);
  const payload = serializeCanonicalInteractionState(migrated.state);
  recordMigrationDiagnostics(migrated, state, payload);
  return {
    ...project,
    atlasActionMemory: payload as BusinessProject["atlasActionMemory"],
  };
}

/**
 * Immutably update canonical interaction state via an updater.
 */
export function updateInteractionState(
  project: BusinessProject,
  updater: (current: AtlasInteractionState) => AtlasInteractionState,
  meta?: InteractionWriteMeta,
): BusinessProject {
  const current = getInteractionState(project);
  return setInteractionState(
    project,
    updater(cloneInteractionState(current)),
    meta,
  );
}

/**
 * Normalize / lazily migrate interaction state and persist canonical v1 only.
 * Idempotent across repeated calls.
 */
export function normalizeInteractionState(
  project: BusinessProject,
): BusinessProject {
  const migrated = migrateToAtlasInteractionState(project.atlasActionMemory);
  return setInteractionState(project, migrated.state, {
    origin: "interaction-state.normalize",
  });
}

/**
 * @deprecated Sprint 29.3 — promotion lives in migrateToAtlasInteractionState.
 * Kept for exports / older tests; operates on legacy-shaped memory.
 */
export function normalizeClarificationState(
  memory: AtlasActionMemory,
): {
  memory: AtlasActionMemory;
  source: PendingClarificationSource;
  promoted: boolean;
  duplicateDetected: boolean;
} {
  const migrated = migrateToAtlasInteractionState(memory);
  const payload = serializeCanonicalInteractionState(migrated.state);
  const promoted =
    migrated.migrationPerformed &&
    Boolean(migrated.state.pendingClarification?.context?.promotedFrom);
  const duplicateDetected = Boolean(
    memory.activeVisualTask?.pendingClarification &&
      memory.pendingClarification?.pendingQuestion,
  );
  const source: PendingClarificationSource = migrated.state.pendingClarification
    ?.pendingQuestion
    ? promoted
      ? "legacy_promoted"
      : "top_level"
    : "none";
  if (isDevOrTest()) {
    writeLedger.pendingClarificationSource = source;
    writeLedger.duplicateClarificationDetected = duplicateDetected;
    if (promoted) writeLedger.lastPromotionAt = nowIso();
  }
  return { memory: payload, source, promoted, duplicateDetected };
}

/**
 * Deep-clone canonical interaction state for snapshots / tests.
 */
export function cloneInteractionState(
  state: AtlasInteractionState | null | undefined,
): AtlasInteractionState {
  if (!state) return emptyAtlasInteractionState();
  return structuredClone(state) as AtlasInteractionState;
}

/** True when the project has any interaction/Action Memory payload. */
export function hasInteractionState(
  project: BusinessProject | null | undefined,
): boolean {
  return Boolean(project?.atlasActionMemory);
}

/**
 * Round-trip helper: clone project JSON the way a refresh would.
 * Used by persistence invariants — does not hit the network.
 */
export function roundTripProjectJson(
  project: BusinessProject,
): BusinessProject {
  return JSON.parse(JSON.stringify(project)) as BusinessProject;
}

export function countProjectPendingClarifications(
  project: BusinessProject,
): number {
  const state = getInteractionState(project);
  return state.pendingClarification?.pendingQuestion ? 1 : 0;
}
