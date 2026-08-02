/**
 * Edit execution result model (v1.2 truthfulness).
 * Success claims must be derived from verified outcomes only.
 */

import type { EditOperation } from "@/lib/ai/edit-operations";
import type { ImageOperation } from "@/lib/ai/image-operations";

export type EditExecutionResult = {
  success: boolean;
  verified: boolean;
  operationType: string;
  verificationFailures: string[];
  createdEntities: string[];
  modifiedEntities: string[];
  warnings: string[];
  followUpRecommendation?: string;
  /** Human-readable outcome after verification (not intent speculation). */
  explanation: string;
};

/** Persisted brand palette for undo / brand-regression repair. */
export type AtlasPreservedPalette = {
  primaryColor: string;
  accentColor: string;
  secondaryColor: string;
  backgroundColor: string;
  theme: "light" | "dark" | "auto";
};

/** Persisted snapshot of the last edit attempt for conversation repair. */
export type AtlasLastExecution = {
  request: string;
  at: string;
  success: boolean;
  verified: boolean;
  operationTypes: string[];
  operations: Array<EditOperation | ImageOperation>;
  verificationFailures: string[];
  createdEntities: string[];
  modifiedEntities: string[];
  explanation: string;
  followUpRecommendation?: string;
  /** Palette before this turn — restore if brand regression is reported. */
  paletteBefore?: AtlasPreservedPalette | null;
  scope?: "hero" | "global" | "unknown";
};

export function emptyExecutionResult(
  operationType = "unknown",
): EditExecutionResult {
  return {
    success: false,
    /** Verification ran; success is separate. */
    verified: true,
    operationType,
    verificationFailures: [],
    createdEntities: [],
    modifiedEntities: [],
    warnings: [],
    explanation: "",
  };
}

export function mergeExecutionResults(
  results: EditExecutionResult[],
): EditExecutionResult {
  if (results.length === 0) {
    return emptyExecutionResult();
  }
  if (results.length === 1) {
    return results[0]!;
  }

  const success = results.every((r) => r.success);
  const verified = results.every((r) => r.verified);
  const anySuccess = results.some((r) => r.success && r.verified);
  const failures = results.flatMap((r) => r.verificationFailures);
  const created = unique(results.flatMap((r) => r.createdEntities));
  const modified = unique(results.flatMap((r) => r.modifiedEntities));
  const warnings = unique(results.flatMap((r) => r.warnings));
  const followUp =
    results.find((r) => r.followUpRecommendation)?.followUpRecommendation;

  let explanation: string;
  if (success && verified) {
    explanation = results
      .map((r) => r.explanation)
      .filter(Boolean)
      .join(" ");
  } else if (anySuccess) {
    const okParts = results
      .filter((r) => r.success && r.verified)
      .map((r) => r.explanation)
      .filter(Boolean);
    const failParts = results
      .filter((r) => !r.success || !r.verified)
      .map((r) => r.explanation || r.verificationFailures[0] || "")
      .filter(Boolean);
    explanation = [...okParts, ...failParts].join(" ");
  } else {
    explanation =
      results.find((r) => r.explanation)?.explanation ||
      failures[0] ||
      "I wasn’t able to complete that change.";
  }

  return {
    success: success && verified,
    verified,
    operationType: results.map((r) => r.operationType).join("+"),
    verificationFailures: failures,
    createdEntities: created,
    modifiedEntities: modified,
    warnings,
    followUpRecommendation: followUp,
    explanation: explanation.trim(),
  };
}

function unique(items: string[]): string[] {
  return [...new Set(items.filter(Boolean))];
}

/** User disputes a prior edit — enter verification/repair, not a new plan. */
export function isExecutionDisputeRequest(request: string): boolean {
  const text = request.trim();
  if (!text) return false;
  return (
    /\b(i\s+don'?t\s+see\s+it)\b/i.test(text) ||
    /\b(i\s+don'?t\s+see\s+(the\s+)?(change|difference|update|section))\b/i.test(
      text,
    ) ||
    /\b(nothing\s+changed)\b/i.test(text) ||
    /\b(that\s+didn'?t\s+happen)\b/i.test(text) ||
    /\b(where\s+is\s+it)\b/i.test(text) ||
    /\b(it'?s\s+still\s+the\s+same)\b/i.test(text) ||
    /\bstill\s+the\s+same\b/i.test(text) ||
    /\b(nothing\s+(happened|moved|updated))\b/i.test(text) ||
    /\b(didn'?t\s+(work|change|move|update|happen))\b/i.test(text) ||
    /\b(i\s+don'?t\s+see\s+(any|a)\s+change)\b/i.test(text)
  );
}

export function sectionDisplayName(sectionId: string): string {
  const map: Record<string, string> = {
    hero: "Hero",
    about: "About",
    services: "Services",
    features: "Features",
    gallery: "Gallery",
    contact: "Contact",
    testimonials: "Testimonials",
    faq: "FAQ",
    team: "Team",
    pricing: "Pricing",
    bookingCta: "Booking",
    newsletter: "Newsletter",
  };
  return map[sectionId] ?? sectionId;
}
