/**
 * Fallback critique presentation helpers (Sprint 28.0D).
 * Keeps error cards short and critique bodies structured — no duplicate banners.
 */

import {
  formatFallbackUserMessage,
  type OpenAiFailureCategory,
} from "@/lib/ai/openai-error-categories";

export const CRITIQUE_FALLBACK_START = "[[ATLAS_FALLBACK]]";
export const CRITIQUE_FALLBACK_END = "[[/ATLAS_FALLBACK]]";

export type ParsedCritiqueAssistantContent = {
  fallbackCard: string | null;
  body: string;
};

/** Short error card for schema (and other) critique fallbacks. */
export function formatCritiqueFallbackCard(input: {
  category: OpenAiFailureCategory;
  requestId?: string | null;
  audience?: "customer" | "owner";
  failingStage?: string | null;
}): string {
  if (input.category === "schema") {
    return [
      "AI critique could not run because the response schema was rejected.",
      "Atlas used its local review instead.",
      input.requestId ? `Request ID: ${input.requestId}` : null,
    ]
      .filter(Boolean)
      .join("\n");
  }
  return formatFallbackUserMessage({
    category: input.category,
    requestId: input.requestId,
    audience: input.audience,
    failingStage: input.failingStage,
  });
}

/**
 * Compose assistant content: optional short fallback card + structured critique body.
 * Markers are stripped before sending history back to the model.
 */
export function composeCritiqueAssistantContent(input: {
  body: string;
  usedFallback?: boolean;
  fallbackReason?: OpenAiFailureCategory | null;
  requestId?: string | null;
  audience?: "customer" | "owner";
  failingStage?: string | null;
}): string {
  const body = input.body.trim();
  if (!input.usedFallback) return body;
  const card = formatCritiqueFallbackCard({
    category: input.fallbackReason ?? "unknown",
    requestId: input.requestId,
    audience: input.audience,
    failingStage: input.failingStage,
  });
  return [
    CRITIQUE_FALLBACK_START,
    card,
    CRITIQUE_FALLBACK_END,
    "",
    body,
  ].join("\n");
}

/** Parse composed assistant content into card + body for UI rendering. */
export function parseCritiqueAssistantContent(
  content: string,
): ParsedCritiqueAssistantContent {
  const start = content.indexOf(CRITIQUE_FALLBACK_START);
  const end = content.indexOf(CRITIQUE_FALLBACK_END);
  if (start === -1 || end === -1 || end < start) {
    return { fallbackCard: null, body: content };
  }
  const card = content
    .slice(start + CRITIQUE_FALLBACK_START.length, end)
    .trim();
  const body = content.slice(end + CRITIQUE_FALLBACK_END.length).trim();
  return { fallbackCard: card || null, body };
}

/** Strip fallback markers when feeding conversation history to the model. */
export function stripCritiqueFallbackMarkers(content: string): string {
  return parseCritiqueAssistantContent(content).body;
}
