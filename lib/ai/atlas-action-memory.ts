/**
 * Atlas Brain Action Memory (Sprint 26.1).
 * Keeps conversational continuity — Apply All / Yes / clarification answers
 * continue the active plan instead of restarting intent routing.
 *
 * Sprint 29.1 — pure Action Memory transforms live here. Project writes must use
 * `lib/ai/interaction-state.ts` (`setInteractionState` / `updateInteractionState`).
 * `withActionMemory` is retired. See docs/atlas-interaction-ownership.md.
 */

import type { AtlasExecutionPlan } from "@/lib/ai/atlas-brain-types";
import { ATLAS_BRAIN_CLARIFICATION_OPTIONS } from "@/lib/ai/atlas-brain-types";
import type { CreativeDirectorRecommendation } from "@/lib/ai/creative-director-types";
import type { BusinessRecommendation } from "@/lib/ai/business-advisor-types";
import { shouldOverridePendingClarification } from "@/lib/ai/critique-request";
import {
  isExecutionDisputeRequest,
  type AtlasLastExecution,
} from "@/lib/ai/edit-execution-result";
import {
  type ActiveVisualTask,
} from "@/lib/ai/active-visual-task";
import { activeTaskBlocksPlanContinuation } from "@/lib/ai/active-task-policy";
import type { AtlasActiveTask } from "@/lib/ai/atlas-interaction-types";
import {
  isEditOperationKind,
  type EditOperation,
} from "@/lib/ai/edit-operations";
import type { ImageOperation } from "@/lib/ai/image-operations";
import { resolveNamedColor } from "@/lib/ai/named-colors";
import type { BusinessProject } from "@/types/business-project";
import {
  migrateToAtlasInteractionState,
  serializeCanonicalInteractionState,
} from "@/lib/ai/atlas-interaction-migrate";

export type AtlasStoredRecommendationSource =
  | "creative_director"
  | "business_advisor"
  | "design_critique";

/** Slim recommendation snapshot — enough to apply without re-reviewing. */
export type AtlasStoredRecommendation = {
  id: string;
  source: AtlasStoredRecommendationSource;
  title: string;
  /** visual | content | motion | conversion | brand | advisor category */
  kind: string;
  applyable: boolean;
  operations: Array<EditOperation | ImageOperation>;
  explanation?: string;
};

export type ClarificationDestination =
  | "visuals"
  | "copy"
  | "conversions"
  | "other"
  | "apply_all"
  | "apply_selected"
  | "restore_accent"
  | "restore_palette"
  | "apply_hero_fit"
  | "apply_gallery_fit";

export type ClarificationKind =
  | "color"
  | "section"
  | "attachment"
  | "recommendation"
  | "image_target"
  | "fit_mode"
  | "crop_position"
  | "general";

export type AtlasPendingClarification = {
  pendingQuestion: string;
  allowedAnswers: string[];
  destination: ClarificationDestination;
  /** Maps each allowed answer → destination override when present. */
  answerDestinations?: Record<string, ClarificationDestination>;
  askedAt: string;
  /** Typed clarification — color answers resolve via named-color parser. */
  kind?: ClarificationKind;
  /** Field/destination hint, e.g. accentColor. */
  resolveTo?: string;
  context?: Record<string, unknown>;
};

/** Explicit reasons for clearing top-level pending clarification (Sprint 29.2). */
export type ClarificationClearReason =
  | "critique_override"
  | "resolved"
  | "cancelled"
  | "explicit";

/**
 * Wire shape for interaction state.
 * Sprint 29.4: production readers use canonical fields only.
 * Legacy mirror fields remain optional for inbound migration of old projects.
 */
export type AtlasActionMemory = {
  version?: number;
  updatedAt: string;

  // --- Canonical v1 (authoritative) ---
  activeTask?: {
    kind: string;
    target: { type: string; [key: string]: unknown };
    assetId?: string;
    userGoal?: string;
    repairLevel?: number;
    updatedAt: string;
  } | null;
  pendingClarification?: AtlasPendingClarification | null;
  lastVerifiedExecution?: AtlasLastExecution | null;
  preservation?: {
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
  } | null;
  activePlan?: {
    recommendations: AtlasStoredRecommendation[];
    recommendationIds: string[];
    executionPlan?: AtlasExecutionPlan;
    creativeReport?: {
      overallCompleteness: number;
      maturityLevel: string;
      fingerprint: string;
      reviewedAt: string;
    };
    /** Coordinated Transformation Engine plan (Phase 2). */
    transformationPlan?: import("@/lib/transformation/types").TransformationPlan | null;
    source?: "creative_director" | "business_advisor" | "design_critique" | "mixed";
    applyAllPending: boolean;
    lastSelectedId?: string | null;
  } | null;
  repair?: {
    heroReadability?: {
      level: 0 | 1 | 2 | 3;
      heroImageId: string | null;
      updatedAt: string;
    } | null;
  } | null;
  lastClarificationClear?: {
    reason: ClarificationClearReason;
    at: string;
  } | null;

  // --- Inbound migration only (never written after 29.4) ---
  /** @deprecated migration-only */
  recommendations?: AtlasStoredRecommendation[];
  /** @deprecated migration-only */
  recommendationIds?: string[];
  /** @deprecated migration-only */
  source?: "creative_director" | "business_advisor" | "design_critique" | "mixed";
  /** @deprecated migration-only */
  creativeReport?: {
    overallCompleteness: number;
    maturityLevel: string;
    fingerprint: string;
    reviewedAt: string;
  };
  /** @deprecated migration-only */
  executionPlan?: AtlasExecutionPlan;
  /** @deprecated migration-only */
  applyAllPending?: boolean;
  /** @deprecated migration-only */
  lastRecommendationSelected?: string | null;
  /** @deprecated migration-only */
  lastExecution?: AtlasLastExecution | null;
  /** @deprecated migration-only */
  heroReadabilityRepair?: {
    level: 0 | 1 | 2 | 3;
    heroImageId: string | null;
    updatedAt: string;
  } | null;
  /** @deprecated migration-only */
  activeVisualTask?: ActiveVisualTask | null;
};

export type ActionConfirmationKind =
  | "apply_all"
  | "apply_one"
  | "affirm"
  | "ordinal"
  | "named"
  | "kind_filter"
  | "none";

export type ActionConfirmation = {
  kind: ActionConfirmationKind;
  /** 0-based index when kind is ordinal */
  ordinalIndex?: number;
  /** Stable recommendation id when kind is named / ordinal */
  recommendationId?: string;
  /** Filter kinds when kind is kind_filter (e.g. visual) */
  kindFilter?: string[];
  matchedPhrase?: string;
};

/** Result of resolving “Apply the second one” / named plan references. */
export type PlanReferenceResult = {
  matched: boolean;
  recommendationId?: string;
  /** 1-based ordinal in user language */
  ordinal?: number;
  reason?: string;
  kind?: "ordinal" | "named" | "last" | "unsupported" | "out_of_range";
};

const ORDINAL_WORD_TO_1_BASED: Record<string, number> = {
  first: 1,
  "1st": 1,
  second: 2,
  "2nd": 2,
  third: 3,
  "3rd": 3,
  fourth: 4,
  "4th": 4,
  fifth: 5,
  "5th": 5,
};

/**
 * Detect ordinal / named references to the active recommendation list.
 * Ordinals are 1-based in user language. Does not mutate memory.
 */
/** Canonical plan recommendations (Sprint 29.4). */
export function getPlanRecommendations(
  memory: AtlasActionMemory | null | undefined,
): AtlasStoredRecommendation[] {
  return memory?.activePlan?.recommendations ?? [];
}

export function resolvePlanReference(
  message: string,
  atlasActionMemory: AtlasActionMemory | null | undefined,
): PlanReferenceResult {
  const text = message.trim();
  const recs = getPlanRecommendations(atlasActionMemory);
  if (!text || recs.length === 0) return { matched: false };

  const named = text.match(
    /\b(?:just\s+)?(?:the\s+)?([a-z][a-z0-9\s/-]{1,40}?)\s+recommendation\b/i,
  );
  if (named?.[1]) {
    const needle = named[1].trim().toLowerCase();
    const hitIndex = recs.findIndex(
      (r) =>
        r.title.toLowerCase().includes(needle) ||
        r.kind.toLowerCase().includes(needle) ||
        r.id.toLowerCase().includes(needle.replace(/\s+/g, ".")),
    );
    if (hitIndex < 0) {
      return {
        matched: false,
        reason: `I couldn’t find a “${named[1].trim()}” recommendation in the current plan. Which number should I apply (1–${recs.length})?`,
      };
    }
    const hit = recs[hitIndex]!;
    if (!hit.applyable) {
      return {
        matched: true,
        recommendationId: hit.id,
        ordinal: hitIndex + 1,
        kind: "unsupported",
        reason: `Recommendation ${hitIndex + 1} (“${hit.title}”) isn’t something I can apply automatically. Pick another number from 1–${recs.length}, or ask me to handle it differently.`,
      };
    }
    return {
      matched: true,
      recommendationId: hit.id,
      ordinal: hitIndex + 1,
      kind: "named",
    };
  }

  if (
    /\b(?:the\s+)?last\s+one\b|\blast\s+recommendation\b|\bapply\s+the\s+last\b/i.test(
      text,
    )
  ) {
    const hitIndex = recs.length - 1;
    const hit = recs[hitIndex]!;
    if (!hit.applyable) {
      return {
        matched: true,
        recommendationId: hit.id,
        ordinal: hitIndex + 1,
        kind: "unsupported",
        reason: `The last recommendation (“${hit.title}”) isn’t applyable automatically. Pick another number from 1–${recs.length}.`,
      };
    }
    return {
      matched: true,
      recommendationId: hit.id,
      ordinal: hitIndex + 1,
      kind: "last",
    };
  }

  const numberMatch =
    text.match(/\b(?:number|no\.?|#)\s*(\d+)\b/i) ||
    text.match(/\bapply\s+(\d+)\b/i);

  // Match first/second/third BEFORE any bare “one” — “Apply the second one”
  // previously matched trailing \bone\b as ordinal 1.
  const wordMatch = text.match(
    /\b(?:the\s+)?(first|1st|second|2nd|third|3rd|fourth|4th|fifth|5th)\b/i,
  );

  let ordinal1Based: number | undefined;
  if (numberMatch?.[1]) {
    ordinal1Based = Number.parseInt(numberMatch[1], 10);
  } else if (wordMatch?.[1]) {
    ordinal1Based = ORDINAL_WORD_TO_1_BASED[wordMatch[1].toLowerCase()];
  } else if (
    /\b(?:the|just|that)\s+one\b/i.test(text) &&
    !/\b(second|third|fourth|fifth)\b/i.test(text)
  ) {
    ordinal1Based = 1;
  }

  if (ordinal1Based == null || !Number.isFinite(ordinal1Based)) {
    return { matched: false };
  }

  if (ordinal1Based < 1 || ordinal1Based > recs.length) {
    return {
      matched: false,
      ordinal: ordinal1Based,
      kind: "out_of_range",
      reason: `There are only ${recs.length} recommendations in the current plan. Which one should I apply (1–${recs.length})?`,
    };
  }

  const hit = recs[ordinal1Based - 1]!;
  if (!hit.applyable) {
    return {
      matched: true,
      recommendationId: hit.id,
      ordinal: ordinal1Based,
      kind: "unsupported",
      reason: `Recommendation ${ordinal1Based} (“${hit.title}”) isn’t applyable automatically. Pick another number from 1–${recs.length}, or ask me to tackle it differently.`,
    };
  }

  return {
    matched: true,
    recommendationId: hit.id,
    ordinal: ordinal1Based,
    kind: "ordinal",
  };
}

/** True when the user is pointing at an active-plan recommendation. */
export function looksLikePlanReference(request: string): boolean {
  const text = request.trim();
  if (!text) return false;
  return (
    /\b(?:the\s+)?(first|1st|second|2nd|third|3rd|fourth|4th|fifth|5th|last)\s+one\b/i.test(
      text,
    ) ||
    /\b(?:number|no\.?|#)\s*\d+\b/i.test(text) ||
    /\bapply\s+(?:the\s+)?(?:first|second|third|fourth|fifth|last|\d+)\b/i.test(
      text,
    ) ||
    /\brecommendation\b/i.test(text) ||
    /\bdo\s+the\s+last\s+one\b/i.test(text)
  );
}

/**
 * Phrases that mean “execute the pending recommendations”.
 * Never match bare “everything” — layout copy like “below everything else”
 * must not short-circuit into Apply All.
 */
export const APPLY_ALL_PHRASES =
  /\b(apply\s+all|apply\s+everything|apply\s+the\s+full\s+plan|do\s+all\s+of\s+it|do\s+all\s+of\s+(them|'?em)|all\s+of\s+(them|it)|all\s+of\s+'?em|let'?s\s+do\s+(it|that)|make\s+it\s+so|complete\s+my\s+website|finish\s+my\s+website|make\s+it\s+launch[- ]ready)\b/i;

/**
 * Bare affirmations that only count as Apply All when the whole message is short.
 * Kept separate so “do it” / “everything” / “sure” inside longer edit requests never match.
 */
const APPLY_ALL_SHORT_AFFIRMATIONS =
  /^(yes+|yep|yeah|sure|ok(ay)?|do\s+it|go\s+ahead|everything|all\s+of\s+(them|it)|proceed|sounds\s+good)[.!]?$/i;

/** First-class completion / launch-ready phrases (Sprint 28.0B). */
export const COMPLETE_WEBSITE_PHRASES =
  /\b(complete\s+my\s+website|finish\s+my\s+website|make\s+it\s+launch[- ]ready|apply\s+everything|apply\s+the\s+full\s+plan|do\s+all\s+of\s+it)\b/i;

export function isCompleteWebsiteRequest(request: string): boolean {
  return COMPLETE_WEBSITE_PHRASES.test(request.trim());
}

const APPLY_ONE_PHRASES =
  /\b(apply(\s+that|\s+this|\s+the\s+(first|top|selected))?|the\s+first\s+one|just\s+that\s+one)\b/i;

const VISUAL_FILTER =
  /\b(visuals?|images?|photos?|look|design|branding)\b/i;
const COPY_FILTER =
  /\b(copy|text|headline|wording|content|writing)\b/i;
const CONVERSION_FILTER =
  /\b(conversions?|cta|calls?|leads?|bookings?)\b/i;

function nowIso(): string {
  return new Date().toISOString();
}

export function emptyActionMemory(): AtlasActionMemory {
  return serializeCanonicalInteractionState({
    version: 1,
    updatedAt: nowIso(),
    activeTask: null,
    pendingClarification: null,
    lastVerifiedExecution: null,
    preservation: null,
    activePlan: null,
    repair: null,
    lastClarificationClear: null,
  });
}

/**
 * Read interaction memory with lazy v1 migration.
 * Returns canonical v1 fields only (Sprint 29.4 — no mirror rehydration).
 */
export function getActionMemory(
  project: BusinessProject,
): AtlasActionMemory {
  const raw = project.atlasActionMemory as AtlasActionMemory | undefined;
  if (!raw || typeof raw !== "object") return emptyActionMemory();
  return serializeCanonicalInteractionState(
    migrateToAtlasInteractionState(raw).state,
  );
}

export function hasActiveRecommendations(
  memory: AtlasActionMemory | null | undefined,
): boolean {
  return getPlanRecommendations(memory).length > 0;
}

export function hasPendingClarification(
  memory: AtlasActionMemory | null | undefined,
): boolean {
  return Boolean(memory?.pendingClarification?.pendingQuestion);
}

/**
 * Detect confirmation / selection intent against prior context.
 */
/** Layout/edit commands must never be read as plan ordinals (“…to the last”). */
function looksLikeStandaloneLayoutOrEdit(request: string): boolean {
  const text = request.trim();
  if (!text) return false;
  const moveVerb = new RegExp(
    String.raw`\b(?:move|put|place|reorder)\s+(?:the\s+)?[a-z]`,
    "i",
  );
  const layoutCue = new RegExp(
    String.raw`\b(?:section|above|below|before|after|bottom|top|higher|lower|end|last|first)\b`,
    "i",
  );
  if (moveVerb.test(text) && layoutCue.test(text)) {
    return true;
  }
  const editVerb = new RegExp(
    String.raw`\b(?:change|update|set|make|rewrite|replace|add|remove|increase|decrease|fix)\b`,
    "i",
  );
  if (editVerb.test(text) && text.split(/\s+/).length >= 4) {
    return true;
  }
  return false;
}

export function detectActionConfirmation(request: string): ActionConfirmation {
  const text = request.trim();
  if (!text) return { kind: "none" };

  // Explicit layout/edit instructions are never plan confirmations.
  if (looksLikeStandaloneLayoutOrEdit(text) && !/\brecommendation\b/i.test(text)) {
    // Still allow clear “apply the first one” style plan refs.
    if (
      !/\bapply\s+(?:the\s+)?(?:first|second|third|fourth|fifth|last|\d+)\b/i.test(
        text,
      ) &&
      !/\b(?:the\s+)?(first|1st|second|2nd|third|3rd|fourth|4th|fifth|5th|last)\s+one\b/i.test(
        text,
      )
    ) {
      return { kind: "none" };
    }
  }

  // Ordinals: "the first one", "second", "#2", "number 2"
  // Never match bare trailing "one" in "second one" as first.
  const numberMatch =
    text.match(/\b(?:number|no\.?|#)\s*(\d+)\b/i) ||
    text.match(/\bapply\s+(\d+)\b/i);
  const wordMatch = text.match(
    /\b(?:the\s+)?(first|1st|second|2nd|third|3rd|fourth|4th|fifth|5th|last)\b/i,
  );

  if (numberMatch?.[1]) {
    const n = Number.parseInt(numberMatch[1], 10);
    if (Number.isFinite(n) && n >= 1) {
      return {
        kind: "ordinal",
        ordinalIndex: n - 1,
        matchedPhrase: numberMatch[0],
      };
    }
  }

  if (wordMatch?.[1]) {
    const token = wordMatch[1].toLowerCase();
    // “last/first” as layout positions (“to the last”, “put X first”) are not ordinals
    // unless they clearly refer to a plan item (“the last one”, “apply last”).
    const isPlanOrdinal =
      /\b(?:the\s+)?(first|1st|second|2nd|third|3rd|fourth|4th|fifth|5th|last)\s+one\b/i.test(
        text,
      ) ||
      /\bapply\s+(?:the\s+)?(?:first|second|third|fourth|fifth|last)\b/i.test(
        text,
      ) ||
      (token !== "last" &&
        token !== "first" &&
        text.split(/\s+/).length <= 6);
    if (!isPlanOrdinal && (token === "last" || token === "first")) {
      // fall through — may still match apply_all / etc.
    } else if (token === "last") {
      return { kind: "ordinal", ordinalIndex: -1, matchedPhrase: wordMatch[0] };
    } else {
      const oneBased = ORDINAL_WORD_TO_1_BASED[token];
      if (oneBased != null) {
        return {
          kind: "ordinal",
          ordinalIndex: oneBased - 1,
          matchedPhrase: wordMatch[0],
        };
      }
    }
  }

  if (
    /\b(?:the|just|that)\s+one\b/i.test(text) &&
    !/\b(second|third|fourth|fifth)\b/i.test(text) &&
    !looksLikeStandaloneLayoutOrEdit(text)
  ) {
    return { kind: "ordinal", ordinalIndex: 0, matchedPhrase: "one" };
  }

  const named = text.match(
    /\b(?:just\s+)?(?:the\s+)?([a-z][a-z0-9\s/-]{1,40}?)\s+recommendation\b/i,
  );
  if (named) {
    return { kind: "named", matchedPhrase: named[0] };
  }

  // Kind filters: "actually just the visuals", "Better visuals"
  if (VISUAL_FILTER.test(text) && text.split(/\s+/).length <= 8) {
    return {
      kind: "kind_filter",
      kindFilter: ["visual", "brand", "motion"],
      matchedPhrase: text,
    };
  }
  if (COPY_FILTER.test(text) && text.split(/\s+/).length <= 8) {
    return {
      kind: "kind_filter",
      kindFilter: ["content"],
      matchedPhrase: text,
    };
  }
  if (CONVERSION_FILTER.test(text) && text.split(/\s+/).length <= 8) {
    return {
      kind: "kind_filter",
      kindFilter: ["conversion"],
      matchedPhrase: text,
    };
  }

  if (
    APPLY_ALL_PHRASES.test(text) ||
    COMPLETE_WEBSITE_PHRASES.test(text) ||
    /\bapply\s+all\b/i.test(text) ||
    APPLY_ALL_SHORT_AFFIRMATIONS.test(text)
  ) {
    return { kind: "apply_all", matchedPhrase: text };
  }

  if (APPLY_ONE_PHRASES.test(text)) {
    return { kind: "apply_one", matchedPhrase: text };
  }

  // Bare affirmations (non–apply-all)
  if (/^(yes+|yep|yeah|sure|ok(ay)?|do\s+it|go\s+ahead)[.!]?$/i.test(text)) {
    return { kind: "affirm", matchedPhrase: text };
  }

  return { kind: "none" };
}

/**
 * Match a user reply to a pending clarification option (fuzzy).
 */
export function matchClarificationAnswer(
  request: string,
  pending: AtlasPendingClarification,
): {
  answer: string;
  destination: ClarificationDestination;
  resolvedColor?: string;
} | null {
  const normalized = request.trim().toLowerCase().replace(/[.!?]+$/g, "");
  if (!normalized) return null;

  // Typed color clarification — accept named colors (e.g. "gold").
  if (pending.kind === "color") {
    const hex = resolveNamedColor(normalized);
    if (hex) {
      return {
        answer: normalized,
        destination:
          pending.destination === "restore_palette"
            ? "restore_palette"
            : "restore_accent",
        resolvedColor: hex,
      };
    }
  }

  // Typed image-target clarification — “Hero image” / “Gallery image”.
  if (pending.kind === "image_target") {
    if (/\bhero(\s+image)?\b/i.test(normalized)) {
      return {
        answer: "Hero image",
        destination: "apply_hero_fit",
      };
    }
    if (/\bgallery(\s+image)?\b/i.test(normalized)) {
      return {
        answer: "Gallery image",
        destination: "apply_gallery_fit",
      };
    }
  }

  for (const answer of pending.allowedAnswers) {
    const a = answer.toLowerCase();
    if (
      normalized === a ||
      normalized.includes(a) ||
      a.includes(normalized) ||
      // "Visuals" ↔ "Better visuals"
      a.split(/\s+/).some((word) => word.length > 3 && normalized.includes(word)) ||
      normalized.split(/\s+/).some((word) => word.length > 3 && a.includes(word))
    ) {
      const destination =
        pending.answerDestinations?.[answer] ?? pending.destination;
      return { answer, destination };
    }
  }

  // Soft match against known clarification chips (designer + legacy labels)
  if (/visual|photo|imagery|richer\s+photos/i.test(normalized)) {
    return { answer: "Richer photos", destination: "visuals" };
  }
  if (/copy|text|content|writing|sharper\s+writing/i.test(normalized)) {
    return { answer: "Sharper writing", destination: "copy" };
  }
  if (
    /conversion|lead|call|book|cta|calls?\s+to\s+action|stronger\s+calls/i.test(
      normalized,
    )
  ) {
    return { answer: "Stronger calls to action", destination: "conversions" };
  }
  if (/something\s+else|other/i.test(normalized)) {
    return { answer: "Something else", destination: "other" };
  }

  return null;
}

export function hasActiveTransformationPlan(
  memory: AtlasActionMemory | null | undefined,
): boolean {
  return Boolean(memory?.activePlan?.transformationPlan?.goals?.length);
}

export function storeRecommendations(
  memory: AtlasActionMemory | null | undefined,
  input: {
    creative?: CreativeDirectorRecommendation[];
    advisor?: BusinessRecommendation[];
    creativeReport?: AtlasActionMemory["creativeReport"];
    executionPlan?: AtlasExecutionPlan;
    transformationPlan?: import("@/lib/transformation/types").TransformationPlan | null;
  },
): AtlasActionMemory {
  const creative = (input.creative ?? []).map(
    (r): AtlasStoredRecommendation => ({
      id: r.id,
      source: "creative_director",
      title: r.title,
      kind: r.kind,
      applyable: r.applyable,
      operations: r.operations,
      explanation: r.explanation,
    }),
  );
  const advisor = (input.advisor ?? []).map(
    (r): AtlasStoredRecommendation => ({
      id: r.id,
      source: "business_advisor",
      title: r.title,
      kind: r.category,
      applyable: !r.destructive && r.operations.length > 0,
      operations: r.operations,
      explanation: r.noticed || r.narrative,
    }),
  );
  const recommendations = [...creative, ...advisor];
  const source: AtlasActionMemory["source"] =
    creative.length && advisor.length
      ? "mixed"
      : creative.length
        ? "creative_director"
        : advisor.length
          ? "business_advisor"
          : undefined;

  const transformationPlan =
    input.transformationPlan !== undefined
      ? input.transformationPlan
      : memory?.activePlan?.transformationPlan ?? null;
  const applyAllPending =
    recommendations.some((r) => r.applyable) ||
    Boolean(transformationPlan?.goals?.length);
  const creativeReport =
    input.creativeReport ?? memory?.activePlan?.creativeReport;
  const executionPlan =
    input.executionPlan ?? memory?.activePlan?.executionPlan;
  const hasPlan =
    recommendations.length > 0 ||
    Boolean(executionPlan) ||
    Boolean(creativeReport) ||
    Boolean(transformationPlan?.goals?.length);
  const activePlan = hasPlan
    ? {
        recommendations,
        recommendationIds: recommendations.map((r) => r.id),
        executionPlan,
        creativeReport,
        transformationPlan,
        source,
        applyAllPending,
        lastSelectedId: null as string | null,
      }
    : null;

  const base = memory ?? emptyActionMemory();
  return {
    version: 1,
    updatedAt: nowIso(),
    activeTask: base.activeTask ?? null,
    pendingClarification: base.pendingClarification ?? null,
    lastVerifiedExecution: base.lastVerifiedExecution ?? null,
    preservation: base.preservation ?? null,
    activePlan,
    repair: base.repair ?? null,
    lastClarificationClear: base.lastClarificationClear ?? null,
  };
}

export function storePendingClarification(
  memory: AtlasActionMemory | null | undefined,
  clarification: {
    question: string;
    allowedAnswers?: string[];
    destination?: ClarificationDestination;
    answerDestinations?: Record<string, ClarificationDestination>;
    kind?: ClarificationKind;
    resolveTo?: string;
    context?: Record<string, unknown>;
  },
): AtlasActionMemory {
  const kind = clarification.kind ?? "general";
  const allowedAnswers =
    clarification.allowedAnswers ??
    (kind === "color"
      ? ["gold", "green", "navy", "cream", "white"]
      : kind === "image_target"
        ? ["Hero image", "Gallery image"]
        : [...ATLAS_BRAIN_CLARIFICATION_OPTIONS]);
  const answerDestinations =
    clarification.answerDestinations ??
    (kind === "color" || kind === "image_target"
      ? kind === "image_target"
        ? {
            "Hero image": "apply_hero_fit" as ClarificationDestination,
            "Gallery image": "apply_gallery_fit",
          }
        : undefined
      : {
          "Richer photos": "visuals" as ClarificationDestination,
          "Sharper writing": "copy",
          "Stronger calls to action": "conversions",
          "Something else": "other",
          "Better visuals": "visuals",
          "Better copy": "copy",
          "Better conversions": "conversions",
        });

  return {
    ...(memory ?? emptyActionMemory()),
    pendingClarification: {
      pendingQuestion: clarification.question,
      allowedAnswers,
      destination: clarification.destination ?? "other",
      ...(answerDestinations ? { answerDestinations } : {}),
      askedAt: nowIso(),
      kind,
      ...(clarification.resolveTo ? { resolveTo: clarification.resolveTo } : {}),
      ...(clarification.context ? { context: clarification.context } : {}),
    },
    updatedAt: nowIso(),
  };
}

export function clearPendingClarification(
  memory: AtlasActionMemory | null | undefined,
  options?: { reason?: ClarificationClearReason },
): AtlasActionMemory {
  const reason = options?.reason ?? "explicit";
  return {
    ...(memory ?? emptyActionMemory()),
    pendingClarification: null,
    lastClarificationClear: {
      reason,
      at: nowIso(),
    },
    updatedAt: nowIso(),
  };
}

/** Count authoritative pending clarifications (must be 0 or 1). */
export function countPendingClarifications(
  memory: AtlasActionMemory | null | undefined,
): number {
  return memory?.pendingClarification?.pendingQuestion ? 1 : 0;
}

export function clearRecommendations(
  memory: AtlasActionMemory | null | undefined,
): AtlasActionMemory {
  const base = memory ?? emptyActionMemory();
  return {
    version: 1,
    updatedAt: nowIso(),
    activeTask: base.activeTask ?? null,
    pendingClarification: base.pendingClarification ?? null,
    lastVerifiedExecution: base.lastVerifiedExecution ?? null,
    preservation: base.preservation ?? null,
    activePlan: null,
    repair: base.repair ?? null,
    lastClarificationClear: base.lastClarificationClear ?? null,
  };
}

export function clearActionMemory(): AtlasActionMemory {
  return emptyActionMemory();
}

export function storeLastExecution(
  memory: AtlasActionMemory | null | undefined,
  execution: AtlasLastExecution,
): AtlasActionMemory {
  const base = memory ?? emptyActionMemory();
  const brandPalette = execution.paletteBefore
    ? {
        primaryColor: execution.paletteBefore.primaryColor,
        secondaryColor: execution.paletteBefore.secondaryColor,
        accentColor: execution.paletteBefore.accentColor,
        backgroundColor: execution.paletteBefore.backgroundColor,
        theme: execution.paletteBefore.theme,
      }
    : base.preservation?.brandPalette;
  return {
    version: 1,
    updatedAt: nowIso(),
    activeTask: base.activeTask ?? null,
    pendingClarification: base.pendingClarification ?? null,
    lastVerifiedExecution: execution,
    preservation: {
      ...(base.preservation ?? {}),
      ...(brandPalette ? { brandPalette } : {}),
      heroAssetId:
        base.preservation?.heroAssetId ?? base.activeTask?.assetId ?? null,
    },
    activePlan: base.activePlan ?? null,
    repair: base.repair ?? null,
    lastClarificationClear: base.lastClarificationClear ?? null,
  };
}

export function getLastExecution(
  memory: AtlasActionMemory | null | undefined,
): AtlasLastExecution | null {
  return memory?.lastVerifiedExecution ?? null;
}

/**
 * @deprecated Sprint 29.1 — project writes must use
 * `setInteractionState` / `updateInteractionState` from
 * `@/lib/ai/interaction-state`. This helper throws outside production so
 * accidental direct writes fail in tests/dev.
 */
export function withActionMemory(
  project: BusinessProject,
  memory: AtlasActionMemory | null | undefined,
): BusinessProject {
  if (process.env.NODE_ENV !== "production") {
    throw new Error(
      "withActionMemory is retired for interaction writes. Use setInteractionState / updateInteractionState from @/lib/ai/interaction-state.",
    );
  }
  return {
    ...project,
    atlasActionMemory: (memory ?? undefined) as BusinessProject["atlasActionMemory"],
  };
}

/**
 * Select which stored recommendations to apply given a confirmation.
 * Ordinals index the full ordered recommendation list (display order), not
 * applyable-only — matching what the user saw in the critique UI.
 */
export function selectRecommendationsToApply(
  memory: AtlasActionMemory,
  confirmation: ActionConfirmation,
  destination?: ClarificationDestination | null,
): AtlasStoredRecommendation[] {
  const ordered = getPlanRecommendations(memory);
  const applyable = ordered.filter((r) => r.applyable);
  if (applyable.length === 0 && confirmation.kind !== "ordinal") return [];

  if (confirmation.recommendationId) {
    const pick = ordered.find((r) => r.id === confirmation.recommendationId);
    return pick?.applyable ? [pick] : [];
  }

  if (destination === "visuals" || confirmation.kindFilter?.includes("visual")) {
    const filtered = applyable.filter((r) =>
      ["visual", "brand", "motion"].includes(r.kind),
    );
    return filtered.length > 0 ? filtered : applyable;
  }
  if (destination === "copy" || confirmation.kindFilter?.includes("content")) {
    const filtered = applyable.filter((r) => r.kind === "content");
    return filtered.length > 0 ? filtered : applyable;
  }
  if (
    destination === "conversions" ||
    confirmation.kindFilter?.includes("conversion")
  ) {
    const filtered = applyable.filter(
      (r) =>
        r.kind === "conversion" ||
        r.source === "business_advisor" ||
        /cta|lead|call|contact/i.test(r.id + r.title),
    );
    return filtered.length > 0 ? filtered : applyable;
  }

  if (confirmation.kind === "ordinal" && confirmation.ordinalIndex != null) {
    const index =
      confirmation.ordinalIndex === -1
        ? ordered.length - 1
        : confirmation.ordinalIndex;
    const pick = ordered[index];
    return pick?.applyable ? [pick] : [];
  }

  if (confirmation.kind === "named") {
    const ref = resolvePlanReference(confirmation.matchedPhrase ?? "", memory);
    if (ref.matched && ref.recommendationId) {
      const pick = ordered.find((r) => r.id === ref.recommendationId);
      return pick?.applyable ? [pick] : [];
    }
    return [];
  }

  if (confirmation.kind === "apply_one") {
    const first = applyable[0];
    return first ? [first] : [];
  }

  // apply_all / affirm / default
  return applyable;
}

/** Remove applied recommendations; keep the rest of the active plan. */
export function removeAppliedRecommendations(
  memory: AtlasActionMemory | null | undefined,
  appliedIds: string[],
): AtlasActionMemory {
  const idSet = new Set(appliedIds);
  const remaining = getPlanRecommendations(memory).filter(
    (r) => !idSet.has(r.id),
  );
  const applyAllPending = remaining.some((r) => r.applyable);
  const lastSelected =
    appliedIds[0] ?? memory?.activePlan?.lastSelectedId ?? null;
  const base = memory ?? emptyActionMemory();
  return {
    version: 1,
    updatedAt: nowIso(),
    activeTask: base.activeTask ?? null,
    // Preserve unanswered clarification — clear only via clearPendingClarification.
    pendingClarification: base.pendingClarification ?? null,
    lastVerifiedExecution: base.lastVerifiedExecution ?? null,
    preservation: base.preservation ?? null,
    activePlan: {
      recommendations: remaining,
      recommendationIds: remaining.map((r) => r.id),
      executionPlan: base.activePlan?.executionPlan,
      creativeReport: base.activePlan?.creativeReport,
      source: base.activePlan?.source,
      applyAllPending,
      lastSelectedId: lastSelected,
    },
    repair: base.repair ?? null,
    lastClarificationClear: base.lastClarificationClear ?? null,
  };
}

/**
 * Convert stored creative recommendations back into CD shapes for apply helpers.
 */
export function toCreativeRecommendations(
  items: AtlasStoredRecommendation[],
): CreativeDirectorRecommendation[] {
  return items
    .filter((r) => r.source === "creative_director")
    .map((r) => ({
      id: r.id,
      kind: (["visual", "content", "motion", "conversion", "brand"].includes(
        r.kind,
      )
        ? r.kind
        : "visual") as CreativeDirectorRecommendation["kind"],
      title: r.title,
      explanation: r.explanation || r.title,
      impact: "high" as const,
      impactScore: 80,
      confidence: 0.9,
      operations: r.operations,
      capabilityIds: [],
      applyable: r.applyable,
      estimatedTime: "<10 seconds",
    }));
}

export function toAdvisorRecommendations(
  items: AtlasStoredRecommendation[],
): BusinessRecommendation[] {
  return items
    .filter((r) => r.source === "business_advisor")
    .map((r) => ({
      id: r.id,
      category: "conversion" as const,
      title: r.title,
      why: r.explanation || r.title,
      noticed: r.explanation || r.title,
      whyItMatters: r.explanation || r.title,
      expectedOutcome: "Stronger results",
      estimatedTime: "<10 seconds",
      impact: "high" as const,
      impactScore: 80,
      confidence: 0.9,
      operations: r.operations.filter(
        (op): op is EditOperation =>
          typeof op === "object" &&
          op != null &&
          "operation" in op &&
          isEditOperationKind(op.operation),
      ),
      destructive: false,
      narrative: r.explanation || r.title,
      scoreCategory: "conversion" as const,
    }));
}

/**
 * True when the request should short-circuit routing and execute action memory.
 * Critique / redesign asks never short-circuit sticky clarification — they re-route.
 */
function hasApplyableRecommendations(
  memory: AtlasActionMemory | null | undefined,
): boolean {
  return (
    getPlanRecommendations(memory).some((r) => r.applyable) ||
    hasActiveTransformationPlan(memory)
  );
}

/** Explicit plan continuation only — not short hero replies. */
function isExplicitPlanContinuation(request: string): boolean {
  const text = request.trim();
  if (!text) return false;
  if (APPLY_ALL_PHRASES.test(text)) return true;
  if (APPLY_ONE_PHRASES.test(text)) return true;
  if (looksLikePlanReference(text)) return true;
  if (
    /\b(do\s+those\s+improvements|apply\s+the\s+(second|first|third|top)\s+one)\b/i.test(
      text,
    )
  ) {
    return true;
  }
  // Short affirmations only count as plan continuation when a plan is applyable.
  if (APPLY_ALL_SHORT_AFFIRMATIONS.test(text)) return true;
  const confirmation = detectActionConfirmation(text);
  // kind_filter (“visuals”) is clarification-chip territory, not Apply All.
  return (
    confirmation.kind === "apply_all" ||
    confirmation.kind === "apply_one" ||
    confirmation.kind === "affirm" ||
    confirmation.kind === "ordinal" ||
    confirmation.kind === "named"
  );
}

export function shouldExecuteActionMemory(
  request: string,
  memory: AtlasActionMemory | null | undefined,
): boolean {
  if (shouldOverridePendingClarification(request)) {
    return false;
  }

  // “I don’t see it” / dispute → execution repair, not Apply All.
  if (isExecutionDisputeRequest(request)) {
    return false;
  }

  // Sprint 29.5 — active-task policy owns scoped continuation vs plan hijack.
  if (
    activeTaskBlocksPlanContinuation(
      memory as { activeTask?: AtlasActiveTask | null } | null | undefined,
      request,
    )
  ) {
    return false;
  }

  // Typed pending clarifications (e.g. color “gold”, “Hero image”) resolve first.
  if (hasPendingClarification(memory) && memory?.pendingClarification) {
    const matched = matchClarificationAnswer(
      request,
      memory.pendingClarification,
    );
    if (matched) return true;
  }

  // Bare “Hero image” without a matching image_target clarification — never Apply All.
  if (/^hero(\s+image)?[.!]?$/i.test(request.trim())) {
    return false;
  }

  // Ordinal / named plan references beat sticky clarification chips.
  if (hasApplyableRecommendations(memory) && looksLikePlanReference(request)) {
    return true;
  }

  // Explicit layout / edit commands never depend on an active plan.
  if (
    looksLikeStandaloneLayoutOrEdit(request) &&
    !looksLikePlanReference(request)
  ) {
    return false;
  }

  // Action Memory only for explicit recommendation-plan continuation.
  if (!hasApplyableRecommendations(memory)) {
    return false;
  }

  return isExplicitPlanContinuation(request);
}
