/**
 * Per-project AI questionnaire persistence (localStorage).
 * Client-only — safe for resume after refresh / tab switches.
 *
 * Snapshots used by useSyncExternalStore MUST be referentially stable when
 * localStorage contents have not changed (React error #185 / max update depth).
 *
 * Sprint fix: last-write-wins via revision/updatedAt, BroadcastChannel + storage
 * sync, and APIs that support flush-before-hide.
 */

import {
  AI_QUESTIONNAIRE_STEPS,
  EMPTY_AI_QUESTIONNAIRE,
  type AiBrandTone,
  type AiQuestionnaireAnswers,
  type AiQuestionnaireProgress,
} from "@/components/ai/ai-types";
import {
  normalizeOptionalSections,
  type AiOptionalSectionsState,
} from "@/lib/ai/optional-sections";

const STORAGE_PREFIX = "atlas.ai.questionnaire.v1:";
export const AI_QUESTIONNAIRE_STORAGE_EVENT = "atlas-ai-questionnaire";
export const AI_QUESTIONNAIRE_BROADCAST_CHANNEL = "atlas-ai-questionnaire";

const MAX_STEP_INDEX = AI_QUESTIONNAIRE_STEPS.length - 1;

/** Stable server/SSR snapshot for useSyncExternalStore. */
const SERVER_SNAPSHOT: AiQuestionnaireProgress | null = null;

type SnapshotCacheEntry = {
  /** Exact localStorage string (or null when missing). */
  raw: string | null;
  value: AiQuestionnaireProgress | null;
};

const snapshotCache = new Map<string, SnapshotCacheEntry>();

type BroadcastPayload = {
  projectId: string;
  revision: number;
  updatedAt: string;
  reason: "save" | "clear";
};

let broadcastChannel: BroadcastChannel | null | undefined;

function storageKey(projectId: string): string {
  return `${STORAGE_PREFIX}${projectId}`;
}

export function aiQuestionnaireStorageKey(projectId: string): string {
  return storageKey(projectId.trim());
}

function isTone(value: unknown): value is AiBrandTone {
  return (
    value === "professional" ||
    value === "friendly" ||
    value === "luxury" ||
    value === "modern" ||
    value === "bold"
  );
}

function parseAnswers(raw: unknown): AiQuestionnaireAnswers {
  if (!raw || typeof raw !== "object") return { ...EMPTY_AI_QUESTIONNAIRE };
  const row = raw as Record<string, unknown>;
  return {
    businessName:
      typeof row.businessName === "string" ? row.businessName : "",
    industry: typeof row.industry === "string" ? row.industry : "",
    oneSentenceDescription:
      typeof row.oneSentenceDescription === "string"
        ? row.oneSentenceDescription
        : "",
    yearsInBusiness:
      typeof row.yearsInBusiness === "string" ? row.yearsInBusiness : "",
    primaryServices:
      typeof row.primaryServices === "string" ? row.primaryServices : "",
    secondaryServices:
      typeof row.secondaryServices === "string" ? row.secondaryServices : "",
    targetCustomer:
      typeof row.targetCustomer === "string" ? row.targetCustomer : "",
    serviceArea: typeof row.serviceArea === "string" ? row.serviceArea : "",
    tone: isTone(row.tone) ? row.tone : "",
    primaryColor:
      typeof row.primaryColor === "string" && row.primaryColor
        ? row.primaryColor
        : EMPTY_AI_QUESTIONNAIRE.primaryColor,
    accentColor:
      typeof row.accentColor === "string" && row.accentColor
        ? row.accentColor
        : EMPTY_AI_QUESTIONNAIRE.accentColor,
    logoPlaceholderNote:
      typeof row.logoPlaceholderNote === "string"
        ? row.logoPlaceholderNote
        : "",
    phone: typeof row.phone === "string" ? row.phone : "",
    email: typeof row.email === "string" ? row.email : "",
    address: typeof row.address === "string" ? row.address : "",
    website: typeof row.website === "string" ? row.website : "",
    facebook: typeof row.facebook === "string" ? row.facebook : "",
    instagram: typeof row.instagram === "string" ? row.instagram : "",
    optionalSections: normalizeOptionalSections(row.optionalSections),
  };
}

function parseProgress(
  raw: string,
  projectId: string,
): AiQuestionnaireProgress | null {
  try {
    const parsed = JSON.parse(raw) as Partial<AiQuestionnaireProgress>;
    if (parsed.version !== 1 || parsed.projectId !== projectId) return null;
    const stepIndex =
      typeof parsed.stepIndex === "number" && Number.isFinite(parsed.stepIndex)
        ? Math.max(0, Math.min(MAX_STEP_INDEX, Math.floor(parsed.stepIndex)))
        : 0;
    const revision =
      typeof parsed.revision === "number" && Number.isFinite(parsed.revision)
        ? Math.max(0, Math.floor(parsed.revision))
        : 0;
    return {
      version: 1,
      projectId,
      stepIndex,
      answers: parseAnswers(parsed.answers),
      updatedAt:
        typeof parsed.updatedAt === "string"
          ? parsed.updatedAt
          : new Date().toISOString(),
      revision,
    };
  } catch {
    return null;
  }
}

function optionalSectionsEqual(
  a: AiOptionalSectionsState,
  b: AiOptionalSectionsState,
): boolean {
  return (Object.keys(a) as Array<keyof AiOptionalSectionsState>).every(
    (key) => a[key] === b[key],
  );
}

function answersEqual(
  a: AiQuestionnaireAnswers,
  b: AiQuestionnaireAnswers,
): boolean {
  const keys = Object.keys(EMPTY_AI_QUESTIONNAIRE) as Array<
    keyof AiQuestionnaireAnswers
  >;
  return keys.every((key) => {
    if (key === "optionalSections") {
      return optionalSectionsEqual(a.optionalSections, b.optionalSections);
    }
    return a[key] === b[key];
  });
}

function readRaw(projectId: string): string | null {
  try {
    return window.localStorage.getItem(storageKey(projectId));
  } catch {
    return snapshotCache.get(projectId)?.raw ?? null;
  }
}

function writeCache(
  projectId: string,
  raw: string | null,
  value: AiQuestionnaireProgress | null,
): void {
  snapshotCache.set(projectId, { raw, value });
}

/** Test helper — drop cached snapshots between cases. */
export function clearAiQuestionnaireSnapshotCache(): void {
  snapshotCache.clear();
}

/**
 * True when `candidate` is strictly newer than `base` (revision, then updatedAt).
 */
export function isAiQuestionnaireNewer(
  candidate: Pick<AiQuestionnaireProgress, "revision" | "updatedAt">,
  base: Pick<AiQuestionnaireProgress, "revision" | "updatedAt"> | null | undefined,
): boolean {
  if (!base) return true;
  if (candidate.revision !== base.revision) {
    return candidate.revision > base.revision;
  }
  return candidate.updatedAt > base.updatedAt;
}

function getBroadcastChannel(): BroadcastChannel | null {
  if (typeof window === "undefined") return null;
  if (typeof BroadcastChannel === "undefined") return null;
  if (broadcastChannel === undefined) {
    try {
      broadcastChannel = new BroadcastChannel(AI_QUESTIONNAIRE_BROADCAST_CHANNEL);
    } catch {
      broadcastChannel = null;
    }
  }
  return broadcastChannel ?? null;
}

function notifyQuestionnaireChange(
  projectId: string,
  meta: { revision: number; updatedAt: string; reason: "save" | "clear" },
): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(AI_QUESTIONNAIRE_STORAGE_EVENT, {
      detail: { projectId, ...meta },
    }),
  );
  const channel = getBroadcastChannel();
  if (channel) {
    const payload: BroadcastPayload = {
      projectId,
      revision: meta.revision,
      updatedAt: meta.updatedAt,
      reason: meta.reason,
    };
    try {
      channel.postMessage(payload);
    } catch {
      // ignore
    }
  }
}

/**
 * Referentially stable snapshot for useSyncExternalStore.
 * Re-parses only when the underlying localStorage string changes.
 */
export function getAiQuestionnaireSnapshot(
  projectId: string,
): AiQuestionnaireProgress | null {
  if (typeof window === "undefined") return SERVER_SNAPSHOT;
  const id = projectId.trim();
  if (!id) return null;

  const raw = readRaw(id);
  const cached = snapshotCache.get(id);
  if (cached && cached.raw === raw) {
    return cached.value;
  }

  const value = raw ? parseProgress(raw, id) : null;
  writeCache(id, raw, value);
  return value;
}

export function getAiQuestionnaireServerSnapshot(): AiQuestionnaireProgress | null {
  return SERVER_SNAPSHOT;
}

/**
 * Subscribe to questionnaire storage updates for one project.
 * Custom events / BroadcastChannel / storage events from other project ids are ignored.
 */
export function subscribeAiQuestionnaire(
  projectId: string,
  onStoreChange: () => void,
): () => void {
  const id = projectId.trim();
  const key = storageKey(id);

  const handler = (event: Event) => {
    if (typeof window === "undefined") return;

    if (event.type === "storage") {
      const storageEvent = event as StorageEvent;
      // null key = clear(); otherwise only our project key
      if (storageEvent.key != null && storageEvent.key !== key) return;
      onStoreChange();
      return;
    }

    if (event.type === AI_QUESTIONNAIRE_STORAGE_EVENT) {
      const detail = (event as CustomEvent<{ projectId?: string }>).detail;
      if (detail?.projectId && detail.projectId !== id) return;
      onStoreChange();
    }
  };

  const onBroadcast = (event: MessageEvent<BroadcastPayload>) => {
    const data = event.data;
    if (!data || data.projectId !== id) return;
    onStoreChange();
  };

  window.addEventListener(AI_QUESTIONNAIRE_STORAGE_EVENT, handler);
  window.addEventListener("storage", handler);

  const channel = getBroadcastChannel();
  channel?.addEventListener("message", onBroadcast);

  return () => {
    window.removeEventListener(AI_QUESTIONNAIRE_STORAGE_EVENT, handler);
    window.removeEventListener("storage", handler);
    channel?.removeEventListener("message", onBroadcast);
  };
}

/**
 * Load questionnaire progress (stable when storage unchanged).
 */
export function loadAiQuestionnaire(
  projectId: string,
): AiQuestionnaireProgress | null {
  return getAiQuestionnaireSnapshot(projectId);
}

export type SaveAiQuestionnaireResult = {
  progress: AiQuestionnaireProgress;
  /** True when localStorage (or cache) was written. */
  wrote: boolean;
  /** True when a newer tab/revision rejected this write. */
  rejectedStale: boolean;
};

export function saveAiQuestionnaire(input: {
  projectId: string;
  stepIndex: number;
  answers: AiQuestionnaireAnswers;
  /**
   * Caller’s last-seen revision/updatedAt. If storage is newer, the write is
   * rejected so a stale tab cannot overwrite a fresher draft.
   */
  baseRevision?: number | null;
  baseUpdatedAt?: string | null;
  /** Bypass last-write-wins (tests / explicit recovery). */
  force?: boolean;
}): SaveAiQuestionnaireResult {
  const projectId = input.projectId.trim();
  const stepIndex = Math.max(0, Math.min(MAX_STEP_INDEX, input.stepIndex));
  const answers: AiQuestionnaireAnswers = {
    ...input.answers,
    optionalSections: normalizeOptionalSections(input.answers.optionalSections),
  };

  const existing = getAiQuestionnaireSnapshot(projectId);

  if (
    existing &&
    existing.stepIndex === stepIndex &&
    answersEqual(existing.answers, answers)
  ) {
    // No-op: avoid rewriting localStorage / dispatching (prevents store churn).
    return { progress: existing, wrote: false, rejectedStale: false };
  }

  if (
    !input.force &&
    existing &&
    (input.baseRevision != null || input.baseUpdatedAt != null)
  ) {
    const base = {
      revision: input.baseRevision ?? existing.revision,
      updatedAt: input.baseUpdatedAt ?? existing.updatedAt,
    };
    // Storage moved ahead of what this tab last loaded/saved.
    if (isAiQuestionnaireNewer(existing, base)) {
      return { progress: existing, wrote: false, rejectedStale: true };
    }
  }

  const progress: AiQuestionnaireProgress = {
    version: 1,
    projectId,
    stepIndex,
    answers,
    updatedAt: new Date().toISOString(),
    revision: (existing?.revision ?? 0) + 1,
  };

  if (typeof window !== "undefined" && projectId) {
    try {
      const raw = JSON.stringify(progress);
      window.localStorage.setItem(storageKey(projectId), raw);
      writeCache(projectId, raw, progress);
      notifyQuestionnaireChange(projectId, {
        revision: progress.revision,
        updatedAt: progress.updatedAt,
        reason: "save",
      });
    } catch {
      // Quota / private mode — keep in-memory cache so the wizard still works.
      writeCache(projectId, null, progress);
      notifyQuestionnaireChange(projectId, {
        revision: progress.revision,
        updatedAt: progress.updatedAt,
        reason: "save",
      });
    }
  } else {
    writeCache(projectId, null, progress);
  }

  return { progress, wrote: true, rejectedStale: false };
}

export function clearAiQuestionnaire(projectId: string): void {
  if (typeof window === "undefined") return;
  const id = projectId.trim();
  if (!id) return;
  const updatedAt = new Date().toISOString();
  try {
    window.localStorage.removeItem(storageKey(id));
    writeCache(id, null, null);
    notifyQuestionnaireChange(id, {
      revision: 0,
      updatedAt,
      reason: "clear",
    });
  } catch {
    writeCache(id, null, null);
  }
}
