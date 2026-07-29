/**
 * Atlas Brain Action Memory (Sprint 26.1).
 * Keeps conversational continuity — Apply All / Yes / clarification answers
 * continue the active plan instead of restarting intent routing.
 */

import type { AtlasExecutionPlan } from "@/lib/ai/atlas-brain-types";
import { ATLAS_BRAIN_CLARIFICATION_OPTIONS } from "@/lib/ai/atlas-brain-types";
import type { CreativeDirectorRecommendation } from "@/lib/ai/creative-director-types";
import type { BusinessRecommendation } from "@/lib/ai/business-advisor-types";
import {
  isEditOperationKind,
  type EditOperation,
} from "@/lib/ai/edit-operations";
import type { ImageOperation } from "@/lib/ai/image-operations";
import type { BusinessProject } from "@/types/business-project";

export type AtlasStoredRecommendationSource =
  | "creative_director"
  | "business_advisor";

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
  | "apply_selected";

export type AtlasPendingClarification = {
  pendingQuestion: string;
  allowedAnswers: string[];
  destination: ClarificationDestination;
  /** Maps each allowed answer → destination override when present. */
  answerDestinations?: Record<string, ClarificationDestination>;
  askedAt: string;
};

export type AtlasActionMemory = {
  /** Last recommendations shown to the user. */
  recommendations?: AtlasStoredRecommendation[];
  recommendationIds?: string[];
  source?: "creative_director" | "business_advisor" | "mixed";
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
  updatedAt: string;
};

export type ActionConfirmationKind =
  | "apply_all"
  | "apply_one"
  | "affirm"
  | "ordinal"
  | "kind_filter"
  | "none";

export type ActionConfirmation = {
  kind: ActionConfirmationKind;
  /** 0-based index when kind is ordinal */
  ordinalIndex?: number;
  /** Filter kinds when kind is kind_filter (e.g. visual) */
  kindFilter?: string[];
  matchedPhrase?: string;
};

/** Phrases that mean “execute the pending recommendations”. */
export const APPLY_ALL_PHRASES =
  /\b(apply\s+all|apply\s+everything|do\s+(it|all)|go\s+ahead|yes+|yep|yeah|sure|ok(ay)?|everything|all\s+of\s+(them|it)|all\s+of\s+'?em|proceed|sounds\s+good|let'?s\s+do\s+(it|that)|make\s+it\s+so)\b/i;

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
export function detectActionConfirmation(request: string): ActionConfirmation {
  const text = request.trim();
  if (!text) return { kind: "none" };

  // Ordinals: "the first one", "second", "#2"
  const ordinal =
    text.match(/\b(?:the\s+)?(first|1st|one|#?\s*1)\b/i) ||
    text.match(/\b(?:the\s+)?(second|2nd|#?\s*2)\b/i) ||
    text.match(/\b(?:the\s+)?(third|3rd|#?\s*3)\b/i) ||
    text.match(/\b(?:the\s+)?(fourth|4th|#?\s*4)\b/i) ||
    text.match(/\b(?:the\s+)?(fifth|5th|#?\s*5)\b/i);

  if (ordinal) {
    const token = ordinal[1]!.toLowerCase().replace(/[#\s]/g, "");
    const map: Record<string, number> = {
      first: 0,
      "1st": 0,
      one: 0,
      "1": 0,
      second: 1,
      "2nd": 1,
      "2": 1,
      third: 2,
      "3rd": 2,
      "3": 3 - 1,
      fourth: 3,
      "4th": 3,
      "4": 3,
      fifth: 4,
      "5th": 4,
      "5": 4,
    };
    const ordinalIndex = map[token];
    if (ordinalIndex !== undefined) {
      return { kind: "ordinal", ordinalIndex, matchedPhrase: ordinal[0] };
    }
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

  if (APPLY_ALL_PHRASES.test(text) || /\bapply\s+all\b/i.test(text)) {
    return { kind: "apply_all", matchedPhrase: text };
  }

  if (APPLY_ONE_PHRASES.test(text)) {
    return { kind: "apply_one", matchedPhrase: text };
  }

  // Bare affirmations
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
): { answer: string; destination: ClarificationDestination } | null {
  const normalized = request.trim().toLowerCase().replace(/[.!?]+$/g, "");
  if (!normalized) return null;

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

  // Soft match against known clarification chips
  if (/visual/i.test(normalized)) {
    return { answer: "Better visuals", destination: "visuals" };
  }
  if (/copy|text|content/i.test(normalized)) {
    return { answer: "Better copy", destination: "copy" };
  }
  if (/conversion|lead|call|book/i.test(normalized)) {
    return { answer: "Better conversions", destination: "conversions" };
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
  },
): AtlasActionMemory {
  const allowedAnswers =
    clarification.allowedAnswers ?? [...ATLAS_BRAIN_CLARIFICATION_OPTIONS];
  const answerDestinations = clarification.answerDestinations ?? {
    "Better visuals": "visuals",
    "Better copy": "copy",
    "Better conversions": "conversions",
    "Something else": "other",
  };

  return {
    ...(memory ?? emptyActionMemory()),
    pendingClarification: {
      pendingQuestion: clarification.question,
      allowedAnswers,
      destination: clarification.destination ?? "other",
      answerDestinations,
      askedAt: nowIso(),
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
 */
export function selectRecommendationsToApply(
  memory: AtlasActionMemory,
  confirmation: ActionConfirmation,
  destination?: ClarificationDestination | null,
): AtlasStoredRecommendation[] {
  const all = (memory.recommendations ?? []).filter((r) => r.applyable);
  if (all.length === 0) return [];

  if (destination === "visuals" || confirmation.kindFilter?.includes("visual")) {
    const filtered = all.filter((r) =>
      ["visual", "brand", "motion"].includes(r.kind),
    );
    return filtered.length > 0 ? filtered : all;
  }
  if (destination === "copy" || confirmation.kindFilter?.includes("content")) {
    const filtered = all.filter((r) => r.kind === "content");
    return filtered.length > 0 ? filtered : all;
  }
  if (
    destination === "conversions" ||
    confirmation.kindFilter?.includes("conversion")
  ) {
    const filtered = all.filter(
      (r) =>
        r.kind === "conversion" ||
        r.source === "business_advisor" ||
        /cta|lead|call|contact/i.test(r.id + r.title),
    );
    return filtered.length > 0 ? filtered : all;
  }

  if (confirmation.kind === "ordinal" && confirmation.ordinalIndex != null) {
    const pick = all[confirmation.ordinalIndex];
    return pick ? [pick] : [];
  }

  if (confirmation.kind === "apply_one") {
    const first = all[0];
    return first ? [first] : [];
  }

  // apply_all / affirm / default
  return all;
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
 */
export function shouldExecuteActionMemory(
  request: string,
  memory: AtlasActionMemory | null | undefined,
): boolean {
  if (hasPendingClarification(memory)) return true;
  if (!hasActiveRecommendations(memory) && !memory?.applyAllPending) {
    return false;
  }
  const confirmation = detectActionConfirmation(request);
  return confirmation.kind !== "none";
}
