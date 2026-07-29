/**
 * Intent routing (Sprint 22.2).
 * Classify every editor message before design/business reasoning.
 * Explicit content edits always win over business goals.
 */

import type { BusinessProject } from "@/types/business-project";

export const INTENT_CATEGORIES = [
  "explicit_content_edit",
  "explicit_design_edit",
  "business_goal",
  "question",
  "clarification",
  "mixed",
  "unknown",
] as const;

export type IntentCategory = (typeof INTENT_CATEGORIES)[number];

/** Routing priority (highest first). */
export const INTENT_PRIORITY: IntentCategory[] = [
  "explicit_content_edit",
  "mixed",
  "explicit_design_edit",
  "business_goal",
  "clarification",
  "question",
  "unknown",
];

export type IntentRouteResult = {
  category: IntentCategory;
  confidence: number;
  /** Business/goal reasoning must not override this request. */
  skipBusinessReasoning: boolean;
  /** Signals used for debugging / tests. */
  signals: {
    hasEditVerb: boolean;
    hasContentTarget: boolean;
    hasDesignTarget: boolean;
    hasBusinessGoal: boolean;
    hasQuestionShape: boolean;
  };
};

export type IntentRouterInput = {
  request: string;
  project?: BusinessProject;
  history?: Array<{ role: string; content: string }>;
};

const EDIT_VERBS =
  /\b(change|update|replace|rewrite|rename|fix|edit|correct|remove|delete|set)\b/i;

const CONTENT_TARGETS =
  /\b(faq|answer|question|hero|headline|subheadline|title|button|cta|about|service|services|contact|copy|text|wording|label)\b/i;

const DESIGN_TARGETS =
  /\b(color|colour|colors|colours|theme|font|typography|modern|luxury|premium|elegant|professional|whitespace|spacing|template|dark\s*mode|light\s*mode|button\s*style|rounded|pill|layout|branding)\b/i;

const BUSINESS_GOAL =
  /\b(more\s+calls?|more\s+leads?|more\s+bookings?|increase\s+(calls?|leads?|bookings?|trust|conversions?)|get\s+more\s+(people\s+)?(to\s+)?call|want\s+more\s+customers?|grow\s+(my\s+)?business|convert\s+better)\b/i;

const QUESTION_SHAPE =
  /^(who|what|why|how|when|where|which|can\s+you|could\s+you|should\s+i|is\s+it|are\s+there)\b|\?\s*$/i;

const CLARIFICATION =
  /\b(i\s+meant|no\s+i\s+meant|actually|instead|not\s+that|the\s+other\s+one|clarify|to\s+clarify)\b/i;

/** Structured FAQ answer / question edits — always explicit content. */
const FAQ_ANSWER_EDIT =
  /\b(update|change|replace|rewrite|edit|correct|fix)\b[\s\S]{0,80}\b(answer|faq)\b/i;
const FAQ_QUESTION_EDIT =
  /\b(update|change|replace|rewrite|edit|rename)\b[\s\S]{0,80}\b(question)\b/i;
const FAQ_ANSWER_TO_PATTERN =
  /\b(?:update|change|replace|rewrite|edit|correct)\s+(?:the\s+)?(?:faq\s+)?answer\s+(?:to|for)\b/i;

/**
 * Classify a user message before any design/business reasoning.
 */
export function routeIntent(input: IntentRouterInput): IntentRouteResult {
  const request = input.request.trim();
  if (!request) {
    return {
      category: "unknown",
      confidence: 0,
      skipBusinessReasoning: false,
      signals: {
        hasEditVerb: false,
        hasContentTarget: false,
        hasDesignTarget: false,
        hasBusinessGoal: false,
        hasQuestionShape: false,
      },
    };
  }

  const hasEditVerb = EDIT_VERBS.test(request);
  const hasContentTarget =
    CONTENT_TARGETS.test(request) ||
    FAQ_ANSWER_EDIT.test(request) ||
    FAQ_QUESTION_EDIT.test(request) ||
    FAQ_ANSWER_TO_PATTERN.test(request);
  const hasDesignTarget = DESIGN_TARGETS.test(request);
  const hasBusinessGoal = BUSINESS_GOAL.test(request);
  const hasQuestionShape = QUESTION_SHAPE.test(request);
  const hasClarification = CLARIFICATION.test(request);

  const signals = {
    hasEditVerb,
    hasContentTarget,
    hasDesignTarget,
    hasBusinessGoal,
    hasQuestionShape,
  };

  const explicitFaq =
    FAQ_ANSWER_TO_PATTERN.test(request) ||
    (FAQ_ANSWER_EDIT.test(request) && hasEditVerb) ||
    (FAQ_QUESTION_EDIT.test(request) && hasEditVerb);

  const explicitContent =
    explicitFaq || (hasEditVerb && hasContentTarget);

  const explicitDesign =
    hasDesignTarget &&
    (hasEditVerb ||
      /\b(make\s+it|feel|look|more)\b/i.test(request) ||
      /\b(modern|luxury|premium|professional|darker|lighter)\b/i.test(request));

  // Priority: explicit content > mixed > design > business > clarification > question > unknown
  if (explicitContent && (explicitDesign || hasBusinessGoal)) {
    return {
      category: "mixed",
      confidence: 0.9,
      skipBusinessReasoning: false, // design/goal half may run after content
      signals,
    };
  }

  if (explicitContent) {
    return {
      category: "explicit_content_edit",
      confidence: explicitFaq ? 0.98 : 0.92,
      skipBusinessReasoning: true,
      signals,
    };
  }

  if (explicitDesign && hasBusinessGoal) {
    return {
      category: "mixed",
      confidence: 0.85,
      skipBusinessReasoning: false,
      signals,
    };
  }

  if (explicitDesign) {
    return {
      category: "explicit_design_edit",
      confidence: 0.88,
      skipBusinessReasoning: true,
      signals,
    };
  }

  if (hasBusinessGoal) {
    return {
      category: "business_goal",
      confidence: 0.86,
      skipBusinessReasoning: false,
      signals,
    };
  }

  if (hasClarification) {
    return {
      category: "clarification",
      confidence: 0.8,
      skipBusinessReasoning: true,
      signals,
    };
  }

  if (hasQuestionShape && !hasEditVerb) {
    return {
      category: "question",
      confidence: 0.75,
      skipBusinessReasoning: true,
      signals,
    };
  }

  return {
    category: "unknown",
    confidence: 0.4,
    skipBusinessReasoning: false,
    signals,
  };
}

/**
 * True when business/goal reasoning must not produce operations for this message.
 */
export function shouldSkipBusinessReasoning(intent: IntentRouteResult): boolean {
  return (
    intent.skipBusinessReasoning ||
    intent.category === "explicit_content_edit" ||
    intent.category === "explicit_design_edit" ||
    intent.category === "question" ||
    intent.category === "clarification"
  );
}
