/**
 * Sprint 29.4 — Lazy migration into AtlasInteractionState v1 (canonical-only persist).
 *
 * Legacy mirrors are accepted on read only. Serialization never writes them.
 */

import type { AtlasActionMemory } from "@/lib/ai/atlas-action-memory";
import type { ActiveVisualTask } from "@/lib/ai/active-visual-task";
import {
  ATLAS_INTERACTION_STATE_VERSION,
  emptyAtlasInteractionState,
  type ActiveInteractionPlan,
  type AtlasActiveTask,
  type AtlasInteractionState,
  type InteractionPreservation,
  type InteractionSource,
  type InteractionRepairState,
  type LastVerifiedExecution,
} from "@/lib/ai/atlas-interaction-types";

function nowIso(): string {
  return new Date().toISOString();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value != null && !Array.isArray(value);
}

export function isAtlasInteractionStateV1(
  value: unknown,
): value is AtlasInteractionState {
  return (
    isRecord(value) &&
    value.version === ATLAS_INTERACTION_STATE_VERSION &&
    typeof value.updatedAt === "string"
  );
}

function activeVisualTaskToActiveTask(
  task: ActiveVisualTask | null | undefined,
): AtlasActiveTask | null {
  if (!task || task.target !== "hero") return null;
  return {
    kind: task.kind,
    target: { type: "hero" },
    assetId: task.assetId,
    userGoal: task.lastUserGoal,
    repairLevel: task.repairLevel,
    updatedAt: task.updatedAt || nowIso(),
  };
}

/** Retired compatibility mirror keys — never written after Sprint 29.4. */
export const RETIRED_MIRROR_KEYS = [
  "activeVisualTask",
  "lastExecution",
  "recommendations",
  "recommendationIds",
  "executionPlan",
  "creativeReport",
  "applyAllPending",
  "lastRecommendationSelected",
  "heroReadabilityRepair",
  "source",
] as const;

export type RetiredMirrorKey = (typeof RETIRED_MIRROR_KEYS)[number];

/** Soft ceiling for ordinary interaction payloads (bytes of JSON). */
export const INTERACTION_STATE_SOFT_MAX_BYTES = 48_000;

export function findRetiredMirrorKeys(
  raw: unknown,
): RetiredMirrorKey[] {
  if (!isRecord(raw)) return [];
  return RETIRED_MIRROR_KEYS.filter((key) => key in raw && raw[key] != null);
}

function planFromRecommendations(
  memory: AtlasActionMemory,
): ActiveInteractionPlan | null {
  const recommendations = memory.recommendations ?? [];
  if (
    recommendations.length === 0 &&
    !memory.executionPlan &&
    !memory.creativeReport &&
    !memory.applyAllPending
  ) {
    return null;
  }
  return {
    recommendations,
    recommendationIds:
      memory.recommendationIds ?? recommendations.map((r) => r.id),
    executionPlan: memory.executionPlan,
    creativeReport: memory.creativeReport,
    source: memory.source,
    applyAllPending: Boolean(memory.applyAllPending),
    lastSelectedId: memory.lastRecommendationSelected ?? null,
  };
}

function planFromLegacy(memory: AtlasActionMemory): ActiveInteractionPlan | null {
  const fromRecs = planFromRecommendations(memory);
  if (memory.activePlan) {
    const canonRecs = memory.activePlan.recommendations ?? [];
    // Empty canonical plan must not hide a non-empty legacy recommendation list
    // from fixtures that patch recommendations after storeRecommendations([]).
    if (canonRecs.length === 0 && (fromRecs?.recommendations.length ?? 0) > 0) {
      return fromRecs;
    }
    return {
      recommendations: canonRecs.length > 0 ? canonRecs : fromRecs?.recommendations ?? [],
      recommendationIds:
        memory.activePlan.recommendationIds ??
        memory.recommendationIds ??
        (canonRecs.length > 0
          ? canonRecs.map((r) => r.id)
          : fromRecs?.recommendationIds ?? []),
      executionPlan: memory.activePlan.executionPlan ?? memory.executionPlan,
      creativeReport: memory.activePlan.creativeReport ?? memory.creativeReport,
      transformationPlan: memory.activePlan.transformationPlan ?? null,
      source: memory.activePlan.source ?? memory.source,
      applyAllPending: Boolean(
        memory.activePlan.applyAllPending ?? memory.applyAllPending,
      ),
      lastSelectedId:
        memory.activePlan.lastSelectedId ??
        memory.lastRecommendationSelected ??
        null,
    };
  }
  return fromRecs;
}

function preservationFromLegacy(
  memory: AtlasActionMemory,
): InteractionPreservation | null {
  if (memory.preservation) {
    return memory.preservation as InteractionPreservation;
  }
  const palette = memory.lastVerifiedExecution?.paletteBefore ??
    memory.lastExecution?.paletteBefore;
  const heroFromTask =
    memory.activeTask?.assetId ?? memory.activeVisualTask?.assetId;
  if (!palette && heroFromTask == null) return null;
  return {
    brandPalette: palette
      ? {
          primaryColor: palette.primaryColor,
          secondaryColor: palette.secondaryColor,
          accentColor: palette.accentColor,
          backgroundColor: palette.backgroundColor,
          theme: palette.theme,
        }
      : undefined,
    heroAssetId: heroFromTask ?? null,
  };
}

function repairFromLegacy(memory: AtlasActionMemory): InteractionRepairState | null {
  if (memory.repair?.heroReadability) {
    return { heroReadability: memory.repair.heroReadability };
  }
  if (!memory.heroReadabilityRepair) return null;
  return { heroReadability: memory.heroReadabilityRepair };
}

function pickActiveTask(
  raw: Record<string, unknown>,
  legacy: AtlasActionMemory,
): { task: AtlasActiveTask | null; conflict: boolean } {
  const canonical = isRecord(raw.activeTask)
    ? (raw.activeTask as AtlasActiveTask)
    : raw.activeTask === null
      ? null
      : undefined;
  const fromLegacy = activeVisualTaskToActiveTask(legacy.activeVisualTask);
  if (canonical !== undefined) {
    let conflict = false;
    if (
      canonical &&
      fromLegacy &&
      canonical.kind !== fromLegacy.kind
    ) {
      conflict = true;
    }
    return { task: canonical, conflict };
  }
  return { task: fromLegacy, conflict: false };
}

function pickVerifiedExecution(
  raw: Record<string, unknown>,
  legacy: AtlasActionMemory,
): { execution: LastVerifiedExecution | null; conflict: boolean } {
  const canonical = (raw.lastVerifiedExecution as LastVerifiedExecution | null | undefined);
  const mirror = legacy.lastExecution ?? null;
  if (canonical != null) {
    const conflict =
      mirror != null &&
      JSON.stringify(canonical) !== JSON.stringify(mirror);
    return { execution: canonical, conflict };
  }
  return { execution: mirror, conflict: false };
}

function promoteNestedPending(
  legacy: AtlasActionMemory,
): AtlasInteractionState["pendingClarification"] {
  let pending = legacy.pendingClarification ?? null;
  const nested = legacy.activeVisualTask?.pendingClarification;
  if (!pending?.pendingQuestion && nested?.kind === "image_target") {
    pending = {
      pendingQuestion:
        "Which image should use the full-photo fit: the hero image or a gallery image?",
      allowedAnswers: ["Hero image", "Gallery image"],
      destination: "apply_hero_fit",
      askedAt: nowIso(),
      kind: "image_target",
      context: {
        intent: "hero_full_picture",
        promotedFrom: "activeVisualTask.pendingClarification",
        allowedTargets: nested.allowedTargets ?? ["hero", "gallery"],
      },
    };
  }
  return pending;
}

/**
 * Migrate any persisted payload → clean AtlasInteractionState v1.
 * Canonical v1 fields win over conflicting legacy mirrors (I14).
 */
export function migrateToAtlasInteractionState(
  raw: unknown,
): {
  state: AtlasInteractionState;
  source: InteractionSource;
  migrationPerformed: boolean;
  legacyConflictDetected: boolean;
} {
  if (!raw || !isRecord(raw)) {
    return {
      state: emptyAtlasInteractionState(),
      source: "empty_default",
      migrationPerformed: true,
      legacyConflictDetected: false,
    };
  }

  const version = typeof raw.version === "number" ? raw.version : undefined;
  // Unknown future version: preserve recognizable fields, do not destroy.
  if (version != null && version > ATLAS_INTERACTION_STATE_VERSION) {
    const legacy = raw as AtlasActionMemory;
    const { task } = pickActiveTask(raw, legacy);
    const { execution } = pickVerifiedExecution(raw, legacy);
    return {
      state: {
        version: ATLAS_INTERACTION_STATE_VERSION,
        updatedAt:
          typeof raw.updatedAt === "string" && raw.updatedAt
            ? raw.updatedAt
            : nowIso(),
        activeTask: task,
        pendingClarification: promoteNestedPending(legacy),
        lastVerifiedExecution: execution,
        preservation: preservationFromLegacy(legacy),
        activePlan: planFromLegacy(legacy),
        repair: repairFromLegacy(legacy),
        lastClarificationClear: legacy.lastClarificationClear ?? null,
        lastTransformationAttempt:
          (raw.lastTransformationAttempt as AtlasInteractionState["lastTransformationAttempt"]) ??
          legacy.lastTransformationAttempt ??
          null,
      },
      source: "v1_canonical",
      migrationPerformed: true,
      legacyConflictDetected: false,
    };
  }

  const hasV1Marker = version === ATLAS_INTERACTION_STATE_VERSION;
  const hasCanonicalFields =
    "activeTask" in raw ||
    "lastVerifiedExecution" in raw ||
    "activePlan" in raw ||
    "repair" in raw ||
    "preservation" in raw;

  const legacy = raw as AtlasActionMemory;
  const mirrorsPresent = Boolean(
    legacy.activeVisualTask ||
      legacy.lastExecution ||
      (legacy.recommendations && legacy.recommendations.length > 0) ||
      legacy.heroReadabilityRepair,
  );

  if (hasV1Marker || hasCanonicalFields) {
    const { task, conflict: taskConflict } = pickActiveTask(raw, legacy);
    const { execution, conflict: execConflict } = pickVerifiedExecution(
      raw,
      legacy,
    );
    const legacyConflictDetected = taskConflict || execConflict;

    const state: AtlasInteractionState = {
      version: ATLAS_INTERACTION_STATE_VERSION,
      updatedAt:
        typeof raw.updatedAt === "string" && raw.updatedAt
          ? raw.updatedAt
          : nowIso(),
      activeTask: task,
      pendingClarification: promoteNestedPending(legacy),
      lastVerifiedExecution: execution,
      preservation:
        (raw.preservation as InteractionPreservation | null | undefined) ??
        preservationFromLegacy(legacy) ??
        null,
      activePlan: planFromLegacy(legacy),
      repair:
        (raw.repair as InteractionRepairState | null | undefined) ??
        repairFromLegacy(legacy) ??
        null,
      lastClarificationClear:
        (raw.lastClarificationClear as AtlasInteractionState["lastClarificationClear"]) ??
        legacy.lastClarificationClear ??
        null,
      lastTransformationAttempt:
        (raw.lastTransformationAttempt as AtlasInteractionState["lastTransformationAttempt"]) ??
        legacy.lastTransformationAttempt ??
        null,
    };

    return {
      state,
      source: hasV1Marker
        ? mirrorsPresent
          ? "v1_with_mirrors"
          : "v1_canonical"
        : "legacy_migrated",
      migrationPerformed: !hasV1Marker,
      legacyConflictDetected,
    };
  }

  // Pure legacy Action Memory → v1
  const state: AtlasInteractionState = {
    version: ATLAS_INTERACTION_STATE_VERSION,
    updatedAt:
      typeof legacy.updatedAt === "string" && legacy.updatedAt
        ? legacy.updatedAt
        : nowIso(),
    activeTask: activeVisualTaskToActiveTask(legacy.activeVisualTask),
    pendingClarification: promoteNestedPending(legacy),
    lastVerifiedExecution: legacy.lastExecution ?? null,
    preservation: preservationFromLegacy(legacy),
    activePlan: planFromLegacy(legacy),
    repair: repairFromLegacy(legacy),
    lastClarificationClear: legacy.lastClarificationClear ?? null,
    lastTransformationAttempt: legacy.lastTransformationAttempt ?? null,
  };

  return {
    state,
    source: "legacy_migrated",
    migrationPerformed: true,
    legacyConflictDetected: false,
  };
}

/**
 * Persistable payload: canonical v1 fields only (Sprint 29.4).
 * Ensures lastVerifiedExecution.paletteBefore is filled from preservation when needed.
 */
export function serializeCanonicalInteractionState(
  state: AtlasInteractionState,
): AtlasActionMemory {
  let lastVerified = state.lastVerifiedExecution;
  const palette = state.preservation?.brandPalette;
  if (lastVerified && palette && !lastVerified.paletteBefore) {
    lastVerified = {
      ...lastVerified,
      paletteBefore: {
        primaryColor: palette.primaryColor,
        secondaryColor: palette.secondaryColor,
        accentColor: palette.accentColor,
        backgroundColor: palette.backgroundColor,
        theme: palette.theme ?? "light",
      },
    };
  }

  return {
    version: ATLAS_INTERACTION_STATE_VERSION,
    updatedAt: state.updatedAt,
    activeTask: state.activeTask,
    pendingClarification: state.pendingClarification,
    lastVerifiedExecution: lastVerified,
    preservation: state.preservation,
    activePlan: state.activePlan,
    repair: state.repair,
    lastClarificationClear: state.lastClarificationClear ?? null,
    lastTransformationAttempt: state.lastTransformationAttempt ?? null,
  };
}

/** @deprecated Sprint 29.4 — use serializeCanonicalInteractionState */
export function serializeInteractionPayload(
  state: AtlasInteractionState,
): AtlasActionMemory {
  return serializeCanonicalInteractionState(state);
}

/** @deprecated Sprint 29.4 — mirrors are no longer written */
export function deriveLegacyMirrors(
  state: AtlasInteractionState,
): AtlasActionMemory {
  return serializeCanonicalInteractionState(state);
}

export function measureInteractionSerializedBytes(
  state: AtlasInteractionState,
): number {
  return JSON.stringify(serializeCanonicalInteractionState(state)).length;
}

const TRANSIENT_URL =
  /^(blob:|data:|https?:\/\/[^/]+\/storage\/v1\/object\/sign\/)/i;

/**
 * I22 — reject File/Blob/object-URL / signed-URL / oversized payloads.
 * Returns violation messages (empty = safe).
 */
export function validateCanonicalInteractionSafety(
  state: AtlasInteractionState,
): string[] {
  const violations: string[] = [];
  let json: string;
  try {
    json = JSON.stringify(serializeCanonicalInteractionState(state));
  } catch {
    violations.push("not JSON-serializable");
    return violations;
  }

  if (json.length > INTERACTION_STATE_SOFT_MAX_BYTES) {
    violations.push(
      `serialized size ${json.length} exceeds soft max ${INTERACTION_STATE_SOFT_MAX_BYTES}`,
    );
  }

  const scan = (value: unknown, path: string): void => {
    if (value == null) return;
    if (typeof File !== "undefined" && value instanceof File) {
      violations.push(`${path}: File`);
      return;
    }
    if (typeof Blob !== "undefined" && value instanceof Blob) {
      violations.push(`${path}: Blob`);
      return;
    }
    if (typeof value === "string" && TRANSIENT_URL.test(value)) {
      violations.push(`${path}: transient URL`);
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((item, i) => scan(item, `${path}[${i}]`));
      return;
    }
    if (typeof value === "object") {
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        scan(v, path ? `${path}.${k}` : k);
      }
    }
  };
  scan(state, "");

  // Slim recommendations only — operations arrays are allowed; full project forbidden.
  if (isRecord(state as unknown) && "primaryColor" in (state as object)) {
    violations.push("must not embed project visual truth roots");
  }

  return violations;
}

/** True when a persisted payload still carries retired mirror keys. */
export function payloadHasRetiredMirrors(raw: unknown): boolean {
  return findRetiredMirrorKeys(raw).length > 0;
}

/**
 * Canonical equivalence for idempotency checks (I15) — ignores updatedAt drift
 * when structurally equal otherwise is too strict for clock-based stamps.
 */
export function canonicalStatesEquivalent(
  a: AtlasInteractionState,
  b: AtlasInteractionState,
): boolean {
  const strip = (s: AtlasInteractionState) => ({
    version: s.version,
    activeTask: s.activeTask,
    pendingClarification: s.pendingClarification,
    lastVerifiedExecution: s.lastVerifiedExecution,
    preservation: s.preservation,
    activePlan: s.activePlan,
    repair: s.repair,
    lastClarificationClear: s.lastClarificationClear ?? null,
    lastTransformationAttempt: s.lastTransformationAttempt ?? null,
  });
  return JSON.stringify(strip(a)) === JSON.stringify(strip(b));
}
