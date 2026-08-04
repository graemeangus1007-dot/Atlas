/**
 * Atlas Brain Action Memory (Sprint 26.1).
 * Keeps conversational continuity — Apply All / Yes / clarification answers
 * continue the active plan instead of restarting intent routing.
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
import { isHeroReadabilityRequest } from "@/lib/ai/hero-readability";
import { isHeroImageVisibilityComplaint } from "@/lib/ai/hero-visual-balance";
import {
  isEditOperationKind,
  type EditOperation,
} from "@/lib/ai/edit-operations";
import type { ImageOperation } from "@/lib/ai/image-operations";
import { resolveNamedColor } from "@/lib/ai/named-colors";
import { isSurfaceStyleRequest } from "@/lib/ai/surface-styling";
import type { BusinessProject } from "@/types/business-project";

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
  | "restore_palette";

export type ClarificationKind =
  | "color"
  | "section"
  | "attachment"
  | "recommendation"
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

export type AtlasActionMemory = {
  /** Last recommendations shown to the user. */
  recommendations?: AtlasStoredRecommendation[];
  recommendationIds?: string[];
  source?: "creative_director" | "business_advisor" | "design_critique" | "mixed";
  /** Slim Creative Director report context. */
  creativeReport?: {
    overallCompleteness: number;
    maturityLevel: string;
    fingerprint: string;
    reviewedAt: string;
  };
  /** Active execution plan awaiting confirmation / continuation. */
  executionPlan?: AtlasExecutionPlan;
  /** True when Atlas offered recommendations and is ready for Apply All. */
  applyAllPending?: boolean;
  pendingClarification?: AtlasPendingClarification | null;
  lastRecommendationSelected?: string | null;
  /** Last edit attempt — used for “I don’t see it” conversation repair. */
  lastExecution?: AtlasLastExecution | null;
  /**
   * Bounded hero-readability repair escalation (0–3).
   * Resets when heroImageId changes.
   */
  heroReadabilityRepair?: {
    level: 0 | 1 | 2 | 3;
    heroImageId: string | null;
    updatedAt: string;
  } | null;
  updatedAt: string;
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
export function resolvePlanReference(
  message: string,
  atlasActionMemory: AtlasActionMemory | null | undefined,
): PlanReferenceResult {
  const text = message.trim();
  const recs = atlasActionMemory?.recommendations ?? [];
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
  return { updatedAt: nowIso() };
}

export function getActionMemory(
  project: BusinessProject,
): AtlasActionMemory {
  const raw = project.atlasActionMemory as AtlasActionMemory | undefined;
  return raw ?? emptyActionMemory();
}

export function hasActiveRecommendations(
  memory: AtlasActionMemory | null | undefined,
): boolean {
  return Boolean(memory?.recommendations && memory.recommendations.length > 0);
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

export function storeRecommendations(
  memory: AtlasActionMemory | null | undefined,
  input: {
    creative?: CreativeDirectorRecommendation[];
    advisor?: BusinessRecommendation[];
    creativeReport?: AtlasActionMemory["creativeReport"];
    executionPlan?: AtlasExecutionPlan;
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

  return {
    ...(memory ?? {}),
    recommendations,
    recommendationIds: recommendations.map((r) => r.id),
    source,
    creativeReport: input.creativeReport ?? memory?.creativeReport,
    executionPlan: input.executionPlan ?? memory?.executionPlan,
    applyAllPending: recommendations.some((r) => r.applyable),
    pendingClarification: null,
    lastRecommendationSelected: null,
    updatedAt: nowIso(),
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
      : [...ATLAS_BRAIN_CLARIFICATION_OPTIONS]);
  const answerDestinations =
    clarification.answerDestinations ??
    (kind === "color"
      ? undefined
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
): AtlasActionMemory {
  return {
    ...(memory ?? emptyActionMemory()),
    pendingClarification: null,
    updatedAt: nowIso(),
  };
}

export function clearRecommendations(
  memory: AtlasActionMemory | null | undefined,
): AtlasActionMemory {
  return {
    ...(memory ?? emptyActionMemory()),
    recommendations: [],
    recommendationIds: [],
    applyAllPending: false,
    lastRecommendationSelected: null,
    updatedAt: nowIso(),
  };
}

export function clearActionMemory(): AtlasActionMemory {
  return emptyActionMemory();
}

export function storeLastExecution(
  memory: AtlasActionMemory | null | undefined,
  execution: AtlasLastExecution,
): AtlasActionMemory {
  return {
    ...(memory ?? emptyActionMemory()),
    lastExecution: execution,
    updatedAt: nowIso(),
  };
}

export function getLastExecution(
  memory: AtlasActionMemory | null | undefined,
): AtlasLastExecution | null {
  return memory?.lastExecution ?? null;
}

export function withActionMemory(
  project: BusinessProject,
  memory: AtlasActionMemory | null | undefined,
): BusinessProject {
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
  const ordered = memory.recommendations ?? [];
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
  const remaining = (memory?.recommendations ?? []).filter(
    (r) => !idSet.has(r.id),
  );
  return {
    ...(memory ?? emptyActionMemory()),
    recommendations: remaining,
    recommendationIds: remaining.map((r) => r.id),
    applyAllPending: remaining.some((r) => r.applyable),
    pendingClarification: null,
    lastRecommendationSelected: appliedIds[0] ?? memory?.lastRecommendationSelected ?? null,
    updatedAt: nowIso(),
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

  // Hero readability / corrective hero contrast — never Action Memory.
  if (isHeroReadabilityRequest(request)) {
    return false;
  }

  // “Image hard to see” after overlay — hero balance repair, not empty plan.
  if (isHeroImageVisibilityComplaint(request)) {
    return false;
  }

  // Scoped surface styling — never Apply All / generic clarification chips.
  if (isSurfaceStyleRequest(request)) {
    return false;
  }

  // Ordinal / named plan references beat sticky clarification chips.
  if (hasActiveRecommendations(memory) && looksLikePlanReference(request)) {
    return true;
  }

  // Typed pending clarifications (e.g. color “gold”) resolve before edit short-circuit.
  if (hasPendingClarification(memory) && memory?.pendingClarification) {
    const matched = matchClarificationAnswer(
      request,
      memory.pendingClarification,
    );
    if (matched) return true;
  }

  // Explicit layout / edit commands never depend on an active plan.
  if (
    looksLikeStandaloneLayoutOrEdit(request) &&
    !looksLikePlanReference(request)
  ) {
    return false;
  }

  if (hasPendingClarification(memory)) {
    // Only short-circuit when the reply looks like a clarification answer / confirm.
    const matched = memory?.pendingClarification
      ? matchClarificationAnswer(request, memory.pendingClarification)
      : null;
    const confirmation = detectActionConfirmation(request);
    return Boolean(matched) || confirmation.kind !== "none";
  }
  if (!hasActiveRecommendations(memory) && !memory?.applyAllPending) {
    return false;
  }
  const confirmation = detectActionConfirmation(request);
  return confirmation.kind !== "none";
}
