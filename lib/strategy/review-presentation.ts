/**
 * v1.6.3 / v1.6.4 — Agency-quality Strategic Review presentation.
 * Derives from existing specialist / Strategic outputs — no new evaluator.
 * Customer-language boundary applied at format time.
 */

import type { CreativeDirectorRecommendation } from "@/lib/ai/creative-director-types";
import {
  dedupeReviewStrengths,
  humanizeRecommendationTitle,
  presentStrategicOpportunity,
  sanitizeCustomerFacingText,
  stripListMarkers,
} from "@/lib/presentation/customer-language";
import type {
  EnrichedReviewRecommendation,
} from "@/lib/strategy/review-plan";
import type { StrategicAssessment } from "@/lib/strategy/types";

export type ReviewPresentation = {
  summary: string;
  strengths: string[];
  highestPriority: string | null;
  priorityReason: string | null;
  nextImprovements: string[];
  blockedByUserInput: string[];
  recommendationCount: number;
};

/** @deprecated Prefer humanizeRecommendationTitle — kept for callers. */
export function toCustomerFacingImprovementTitle(title: string): string {
  return humanizeRecommendationTitle(title);
}

function extractStrengthLines(critiqueExplanation: string): string[] {
  const blocks = critiqueExplanation.split(/\n{2,}/);
  const strengthBlock = blocks.find((b) =>
    /^strengths?\b/i.test(b.trim().slice(0, 40)),
  );
  if (!strengthBlock) return [];
  return strengthBlock
    .split("\n")
    .map((l) => stripListMarkers(l))
    .filter((l) => l.length >= 8 && !/^strengths?$/i.test(l))
    .slice(0, 6);
}

function buildSummary(input: {
  assessment: StrategicAssessment;
  businessName: string;
}): string {
  const { assessment, businessName } = input;
  const top = assessment.highestPriorityOpportunity;
  const name = businessName.trim() || "This site";
  const state = assessment.websiteState;
  const foundation =
    state === "excellent"
      ? `${name} already has a strong visual foundation and a clear sense of place.`
      : state === "developing"
        ? `${name} has a readable foundation, with room to sharpen the visitor experience.`
        : `${name} has a workable starting point; the next gains come from focus, not more decoration.`;

  if (!top) {
    return sanitizeCustomerFacingText(
      `${foundation} The remaining work is mostly refinement.`,
    );
  }

  const finding = presentStrategicOpportunity(top);
  if (top.id === "cta" || top.domain === "cta") {
    return sanitizeCustomerFacingText(
      `${foundation} The biggest remaining opportunity is conversion clarity: visitors can understand the business, but the primary next step could be more specific.`,
    );
  }
  if (top.id === "trust" || top.id === "proof" || top.domain === "trust") {
    return sanitizeCustomerFacingText(
      `${foundation} The biggest remaining opportunity is trust: visitors need clearer proof before they’re ready to act.`,
    );
  }
  if (top.id === "hero_composition" || top.id === "hero_readability") {
    return sanitizeCustomerFacingText(
      `${foundation} The biggest remaining opportunity is the first impression — the hero should do more work in the first few seconds.`,
    );
  }
  if (/restraint|focused|competing/i.test(finding.title + finding.explanation)) {
    return sanitizeCustomerFacingText(
      `${foundation} The biggest remaining opportunity is visual restraint: a few treatments are competing for attention.`,
    );
  }
  return sanitizeCustomerFacingText(
    `${foundation} The biggest remaining opportunity is ${finding.title.toLowerCase()}.`,
  );
}

function priorityReasonFor(
  assessment: StrategicAssessment,
): string | null {
  const finding = presentStrategicOpportunity(
    assessment.highestPriorityOpportunity,
  );
  if (finding.whyItMatters) return finding.whyItMatters;
  if (finding.explanation) {
    return finding.explanation.length > 220
      ? `${finding.explanation.slice(0, 217).trim()}…`
      : finding.explanation;
  }
  return "This should lead before lower-impact polish.";
}

export function buildReviewPresentation(input: {
  assessment: StrategicAssessment;
  recommendations: Array<
    EnrichedReviewRecommendation | CreativeDirectorRecommendation
  >;
  critiqueExplanation: string;
  businessName: string;
  /** Optional structured strengths from critique — preferred over parsing. */
  critiqueStrengthTitles?: string[];
}): ReviewPresentation {
  const strengthsFromCritique = (input.critiqueStrengthTitles ?? [])
    .map((s) => stripListMarkers(s))
    .filter((s) => s.length >= 4);
  const extracted = extractStrengthLines(input.critiqueExplanation);
  const strengths = dedupeReviewStrengths(
    strengthsFromCritique.length > 0 ? strengthsFromCritique : extracted,
    { businessName: input.businessName },
  );

  const top = input.assessment.highestPriorityOpportunity;
  const highestPriority = top
    ? presentStrategicOpportunity(top).title
    : null;

  const nextImprovements: string[] = [];
  const seen = new Set<string>();
  for (const rec of input.recommendations) {
    const title = humanizeRecommendationTitle(rec.title);
    const key = title.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    nextImprovements.push(title);
    if (nextImprovements.length >= 5) break;
  }
  if (highestPriority) {
    const without = nextImprovements.filter(
      (t) => t.toLowerCase() !== highestPriority.toLowerCase(),
    );
    nextImprovements.length = 0;
    nextImprovements.push(highestPriority, ...without);
    while (nextImprovements.length > 5) nextImprovements.pop();
  }

  const blockedByUserInput: string[] = [];
  for (const rec of input.recommendations) {
    const deferred = "deferred" in rec && Boolean(rec.deferred);
    const needsInput =
      rec.supportStatus === "needs_images" ||
      /needs? (your )?input|requires? uploaded|testimonial|customer proof|business input/i.test(
        rec.blockedReason ?? rec.explanation ?? "",
      );
    if (!rec.applyable && needsInput && !deferred) {
      blockedByUserInput.push(humanizeRecommendationTitle(rec.title));
    }
  }

  return {
    summary: buildSummary({
      assessment: input.assessment,
      businessName: input.businessName,
    }),
    strengths,
    highestPriority,
    priorityReason: priorityReasonFor(input.assessment),
    nextImprovements,
    blockedByUserInput: [...new Set(blockedByUserInput)].slice(0, 4),
    recommendationCount: input.recommendations.length,
  };
}

/**
 * Format for chat + Action Memory. Omits empty sections entirely (invariant).
 * Strength/improvement items are plain text — UI owns list markers.
 */
export function formatReviewPresentation(
  presentation: ReviewPresentation,
): string {
  const lines: string[] = [presentation.summary];

  if (presentation.strengths.length > 0) {
    lines.push("", "What's working");
    for (const s of presentation.strengths) {
      lines.push(`• ${stripListMarkers(s)}`);
    }
  }

  if (presentation.highestPriority) {
    lines.push("", "Highest priority");
    lines.push(stripListMarkers(presentation.highestPriority));
    if (presentation.priorityReason) {
      lines.push(
        "",
        sanitizeCustomerFacingText(presentation.priorityReason),
      );
    }
  }

  if (presentation.nextImprovements.length > 0) {
    lines.push("", "Next improvements");
    presentation.nextImprovements.forEach((title, i) => {
      lines.push(`${i + 1}. ${stripListMarkers(title)}`);
    });
  }

  if (presentation.blockedByUserInput.length > 0) {
    lines.push("", "Needs your input");
    for (const item of presentation.blockedByUserInput) {
      lines.push(`• ${stripListMarkers(item)}`);
    }
  }

  if (presentation.recommendationCount > 0) {
    lines.push(
      "",
      `${presentation.recommendationCount} improvement${presentation.recommendationCount === 1 ? "" : "s"} ready`,
    );
  }

  lines.push(
    "",
    "Say Apply all when you’re ready, or pick any single improvement.",
  );

  return sanitizeCustomerFacingText(lines.join("\n"));
}

/** Empty-section invariant helper for tests and diagnostics. */
export function reviewPresentationEmptySections(
  presentation: ReviewPresentation,
): string[] {
  const empty: string[] = [];
  if (presentation.strengths.length === 0) empty.push("strengths");
  if (!presentation.highestPriority) empty.push("highestPriority");
  if (presentation.nextImprovements.length === 0) empty.push("nextImprovements");
  if (presentation.blockedByUserInput.length === 0) {
    empty.push("blockedByUserInput");
  }
  return empty;
}

export function formatContainsEmptySectionHeadings(text: string): boolean {
  const sections = [
    { heading: /^What's working\s*$/im, hasItems: /What's working\s*\n\s*[•\-\d]/m },
    { heading: /^Strengths\s*$/im, hasItems: /Strengths\s*\n\s*[•\-\d]/m },
    { heading: /^Needs your input\s*$/im, hasItems: /Needs your input\s*\n\s*[•\-]/m },
    {
      heading: /^Next improvements\s*$/im,
      hasItems: /Next improvements\s*\n\s*\d+\./im,
    },
  ];
  for (const s of sections) {
    if (s.heading.test(text) && !s.hasItems.test(text)) return true;
  }
  if (
    /(?:^|\n)(What's working|Strengths|Needs your input|Next improvements)\s*\n\s*(What's working|Highest priority|Next improvements|Needs your input|Say Apply|\d+ improvement|$)/im.test(
      text,
    )
  ) {
    return true;
  }
  return false;
}

export function logReviewPresentationDiagnostics(input: {
  presentation: ReviewPresentation;
  requestId?: string | null;
}): void {
  if (process.env.NODE_ENV !== "development") return;
  const empty = reviewPresentationEmptySections(input.presentation);
  console.info("[atlas:strategic-director:review-presentation]", {
    requestId: input.requestId ?? null,
    reviewPresentationSections: {
      summary: Boolean(input.presentation.summary),
      strengths: input.presentation.strengths.length,
      highestPriority: Boolean(input.presentation.highestPriority),
      nextImprovements: input.presentation.nextImprovements.length,
      blockedByUserInput: input.presentation.blockedByUserInput.length,
      recommendationCount: input.presentation.recommendationCount,
    },
    emptySectionsSuppressed: empty,
  });
}
