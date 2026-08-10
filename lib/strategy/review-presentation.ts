/**
 * v1.6.3 — Agency-quality Strategic Review presentation.
 * Derives from existing specialist / Strategic outputs — no new evaluator.
 */

import type { CreativeDirectorRecommendation } from "@/lib/ai/creative-director-types";
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

/** Translate internal taxonomy into customer-facing language. */
export function toCustomerFacingImprovementTitle(title: string): string {
  const t = title.trim();
  const lower = t.toLowerCase();
  if (/restraint|quality gap|close the remaining restraint/i.test(lower)) {
    return "Simplify a few remaining visual treatments";
  }
  if (/apply final visual polish|visual polish|finishing polish/i.test(lower)) {
    return "Tighten a few finishing details";
  }
  if (/refine spacing|open the spacing|spacing harmony/i.test(lower)) {
    return "Open up the spacing for a calmer read";
  }
  if (/premium landscape-led|landscape-led direction|commit to a premium/i.test(lower)) {
    return "Preserve the current photography-led direction";
  }
  if (/make the primary (cta|action)|clarify the primary cta/i.test(lower)) {
    return "Clarify the primary CTA";
  }
  if (/sequence_proof|put proof before/i.test(lower)) {
    return "Show proof before the ask";
  }
  return t;
}

function extractStrengthLines(critiqueExplanation: string): string[] {
  const blocks = critiqueExplanation.split(/\n{2,}/);
  const strengthBlock = blocks.find((b) =>
    /^strengths?\b/i.test(b.trim().slice(0, 40)),
  );
  if (!strengthBlock) return [];
  return strengthBlock
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => /^[-•]/.test(l) || /^\d+\./.test(l))
    .map((l) =>
      l
        .replace(/^[-•]\s*/, "")
        .replace(/^\d+\.\s*/, "")
        .replace(/\s+[—–-]\s+.*$/, "")
        .trim(),
    )
    .filter((l) => l.length >= 8 && !/^strengths?$/i.test(l))
    .slice(0, 4);
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
    return `${foundation} The remaining work is mostly refinement.`;
  }

  if (top.id === "cta" || top.domain === "cta") {
    return `${foundation} The biggest remaining opportunity is conversion clarity: visitors can understand the business, but the primary next step could be more specific.`;
  }
  if (top.id === "trust" || top.id === "proof" || top.domain === "trust") {
    return `${foundation} The biggest remaining opportunity is trust: visitors need clearer proof before they’re ready to act.`;
  }
  if (top.id === "hero_composition" || top.id === "hero_readability") {
    return `${foundation} The biggest remaining opportunity is the first impression — the hero should do more work in the first few seconds.`;
  }
  return `${foundation} The biggest remaining opportunity is ${toCustomerFacingImprovementTitle(top.title).replace(/^Clarify the primary CTA$/i, "conversion clarity").toLowerCase()}.`;
}

function priorityReasonFor(
  assessment: StrategicAssessment,
): string | null {
  const top = assessment.highestPriorityOpportunity;
  if (!top) return null;
  if (top.id === "cta" || top.domain === "cta") {
    return "A more specific action would make the visitor’s next step unmistakable and should have more impact than additional visual polish.";
  }
  const explanation = (top.explanation || "").trim();
  if (explanation.length > 20) {
    return explanation.length > 220
      ? `${explanation.slice(0, 217).trim()}…`
      : explanation;
  }
  return `This should lead before lower-impact polish.`;
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
    .map((s) => s.trim())
    .filter((s) => s.length >= 8)
    .slice(0, 4);
  const strengths =
    strengthsFromCritique.length > 0
      ? strengthsFromCritique
      : extractStrengthLines(input.critiqueExplanation);

  const top = input.assessment.highestPriorityOpportunity;
  const highestPriority = top
    ? toCustomerFacingImprovementTitle(top.title)
    : null;

  const nextImprovements: string[] = [];
  const seen = new Set<string>();
  for (const rec of input.recommendations) {
    const title = toCustomerFacingImprovementTitle(rec.title);
    const key = title.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    nextImprovements.push(title);
    if (nextImprovements.length >= 5) break;
  }
  // Ensure highest priority leads the list when present.
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
      blockedByUserInput.push(toCustomerFacingImprovementTitle(rec.title));
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
 */
export function formatReviewPresentation(
  presentation: ReviewPresentation,
): string {
  const lines: string[] = [presentation.summary];

  if (presentation.strengths.length > 0) {
    lines.push("", "What's working");
    for (const s of presentation.strengths) {
      lines.push(`• ${s}`);
    }
  }

  if (presentation.highestPriority) {
    lines.push("", "Highest priority");
    lines.push(presentation.highestPriority);
    if (presentation.priorityReason) {
      lines.push("", presentation.priorityReason);
    }
  }

  if (presentation.nextImprovements.length > 0) {
    lines.push("", "Next improvements");
    presentation.nextImprovements.forEach((title, i) => {
      lines.push(`${i + 1}. ${title}`);
    });
  }

  if (presentation.blockedByUserInput.length > 0) {
    lines.push("", "Needs your input");
    for (const item of presentation.blockedByUserInput) {
      lines.push(`• ${item}`);
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

  return lines.join("\n");
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
  // Heading followed immediately by another heading or end
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
