/**
 * v1.6.4 — Customer-language presentation boundary.
 * Internal intelligence retains canonical IDs; this layer converts at the edge.
 */

import type { StrategicAssessment, StrategicOpportunity } from "@/lib/strategy/types";

export type CustomerFacingFinding = {
  title: string;
  explanation: string;
  recommendedAction?: string;
  whyItMatters?: string;
};

/** Architecture / system terms that must not appear in normal customer copy. */
const FORBIDDEN_CUSTOMER_TERMS =
  /\b(Creative Director|Conversion Director|Strategic Director|Taste Engine|Visual Composition Engine|Transformation Engine|Visual Composition|Taste Engine)\b|owns the first pass|restraint quality gap|quality gap|benchmarkId|patternId|goalId|recommendationId|activeTask|executionPlan|capability gap|\bspecialist\b|\bowner\b:\s|\bdomain\b:\s/i;

const PHRASE_REPLACEMENTS: Array<[RegExp, string]> = [
  [/close the restraint quality gap/gi, "simplify a few competing visual treatments"],
  [/close the ([a-z ]+) quality gap/gi, "improve $1 so the page feels more polished"],
  [/restraint quality gap/gi, "visual restraint"],
  [/quality gap/gi, "quality shortfall"],
  [/Hero composition owns the first pass\.?/gi, "Start by simplifying the hero treatment."],
  [/hero composition owns the first pass\.?/gi, "Start by simplifying the hero treatment."],
  [/Creative Director should lead( the fix)?\.?/gi, "This should be the next design priority."],
  [/Conversion Director should lead( the fix)?\.?/gi, "The biggest opportunity is making the next step clearer for visitors."],
  [/Visual Composition should lead( the fix)?\.?/gi, "Start by simplifying the hero treatment."],
  [/Taste should lead( the fix)?\.?/gi, "This should be the next design priority."],
  [/\bCreative Director\b/g, "the design priority"],
  [/\bConversion Director\b/g, "conversion focus"],
  [/\bStrategic Director\b/g, "the priority"],
  [/\bVisual Composition Engine\b/g, "hero treatment"],
  [/\bVisual Composition\b/g, "hero treatment"],
  [/\bTaste Engine\b/g, "visual polish"],
  [/\bTransformation Engine\b/g, "the redesign"],
  [/Aim for the [“"]([^”"]+)[”"] quality bar — not its look\.?/gi,
    "The page would benefit from a more restrained, premium finish with fewer competing visual treatments."],
  [/Against the ([^.]+) quality bar,[^.]*\./gi,
    "The page would benefit from a more restrained, premium finish with fewer competing visual treatments."],
  [/Deferred until higher-priority specialist work lands\.?/gi,
    "This can wait until higher-priority work is finished."],
  [/I’m executing the coordinated plan with [^.]+ leading on [^.]+./gi,
    "I’ll apply the highest-priority improvements while preserving the current brand and photography."],
  [/I'm executing the coordinated plan with [^.]+ leading on [^.]+./gi,
    "I’ll apply the highest-priority improvements while preserving the current brand and photography."],
];

/** Remove list markers — UI owns bullets. */
export function stripListMarkers(text: string): string {
  return text
    .replace(/^[\s]*[-–—*•●◦]\s+/gm, "")
    .replace(/^[\s]*\d+\.\s+/gm, "")
    .trim();
}

export function customerFacingTextExposesArchitecture(text: string): boolean {
  return FORBIDDEN_CUSTOMER_TERMS.test(text);
}

/** Final safety scrub for any customer-facing string. */
export function sanitizeCustomerFacingText(text: string): string {
  let out = text;
  for (const [pattern, replacement] of PHRASE_REPLACEMENTS) {
    out = out.replace(pattern, replacement);
  }
  // Collapse awkward doubles after replacement.
  out = out
    .replace(/\s{2,}/g, " ")
    .replace(/\.\s*\./g, ".")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return out;
}

export function humanizeRecommendationTitle(title: string): string {
  const raw = stripListMarkers(title);
  const lower = raw.toLowerCase();

  if (/restraint|quality gap|competing (visual |)?(accents|effects|treatments)/i.test(lower)) {
    return "Make the design feel more focused";
  }
  if (/clarify the primary cta|make the primary (cta|action)|primary action unmistakable/i.test(lower)) {
    return "Make the main call to action clearer";
  }
  if (/put proof before|sequence proof|proof before the ask/i.test(lower)) {
    return "Show proof before asking visitors to contact you";
  }
  if (/strengthen trust|establish trust|trust before/i.test(lower)) {
    return "Build more trust earlier on the page";
  }
  if (/simplify (the )?conversion|simplify the contact|contact path/i.test(lower)) {
    return "Make the next step easier";
  }
  if (/refine spacing|open (up )?the spacing|spacing harmony/i.test(lower)) {
    return "Open up the spacing for a calmer read";
  }
  if (/visual polish|final polish|finishing polish|finishing details/i.test(lower)) {
    return "Tighten a few finishing details";
  }
  if (/landscape-led|photography-led|premium direction/i.test(lower)) {
    return "Preserve the current photography-led direction";
  }
  if (/hero (composition|readability|treatment)|simplify the hero/i.test(lower)) {
    return "Simplify the hero treatment";
  }
  if (/rewrite seo|seo for search/i.test(lower)) {
    return "Improve how the site appears in search";
  }
  if (/tighten the hero message|hero (copy|message)/i.test(lower)) {
    return "Sharpen the hero message";
  }
  if (/close the .+ quality gap/i.test(lower)) {
    return "Make the design feel more focused";
  }

  return raw;
}

function weaknessNoun(op: StrategicOpportunity): string {
  const title = op.title.toLowerCase();
  const id = op.id;
  if (
    id === "benchmark_gap" &&
    /restraint/.test(title + op.domain)
  ) {
    return "visual restraint";
  }
  if (/restraint/.test(title)) return "visual restraint";
  if (id === "cta" || op.domain === "cta") return "an unclear primary action";
  if (id === "trust") return "thin trust signals";
  if (id === "proof") return "proof arriving too late";
  if (id === "contact_flow") return "a harder-than-needed contact path";
  if (id === "hero_composition") return "a busy hero treatment";
  if (id === "hero_readability") return "hero readability";
  if (id === "spacing_polish") return "uneven spacing";
  if (id === "visual_polish") return "finishing polish";
  if (id === "narrative") return "an unclear page story";
  if (id === "benchmark_gap") return "visual restraint";
  return humanizeRecommendationTitle(op.title).toLowerCase();
}

export function presentStrategicOpportunity(
  op: StrategicOpportunity | null | undefined,
): CustomerFacingFinding {
  if (!op) {
    return {
      title: "Refine the highest-impact remaining gaps",
      explanation:
        "The remaining work is mostly refinement — keep the brand and photography, and tighten what still competes for attention.",
      recommendedAction: "Tighten finishing details without changing the brand.",
    };
  }

  const title = humanizeRecommendationTitle(op.title);
  const noun = weaknessNoun(op);

  if (noun === "visual restraint" || /restraint|quality gap/i.test(op.title)) {
    return {
      title: "Make the design feel more focused",
      explanation:
        "A few elements are competing for attention, especially in the hero. Simplifying those treatments would make the page feel more polished and premium without changing the brand.",
      recommendedAction:
        "Simplify competing overlays, accents, and effects in the hero first.",
      whyItMatters:
        "A calmer first impression helps visitors focus on the message and next step.",
    };
  }

  if (op.id === "cta" || op.domain === "cta") {
    return {
      title: "Make the main call to action clearer",
      explanation:
        "Visitors can understand the business, but the primary next step could be more specific.",
      recommendedAction: "Use a clearer action that matches a real destination on the site.",
      whyItMatters:
        "A specific next step usually improves conversion more than additional visual polish.",
    };
  }

  if (op.id === "trust" || op.id === "proof") {
    return {
      title: humanizeRecommendationTitle(op.title),
      explanation:
        "Visitors need clearer proof before they’re ready to act. Show evidence earlier, then make the ask.",
      recommendedAction: title,
      whyItMatters: "Trust at the decision moment raises the chance visitors inquire.",
    };
  }

  if (op.id === "hero_composition" || op.id === "hero_readability") {
    return {
      title: "Simplify the hero treatment",
      explanation:
        "The first screen has too much competing treatment. Simplifying the hero would make the photo and headline feel more intentional.",
      recommendedAction: "Start by simplifying the hero treatment.",
      whyItMatters: "The hero sets the tone for everything that follows.",
    };
  }

  const cleanedExplanation = sanitizeCustomerFacingText(
    stripListMarkers(op.explanation || ""),
  );

  return {
    title,
    explanation:
      cleanedExplanation ||
      `The biggest remaining opportunity is ${noun}.`,
    recommendedAction: title,
    whyItMatters:
      "Addressing this before lower-impact polish should improve the visitor experience more.",
  };
}

export function presentStrategicExecution(
  assessment: StrategicAssessment,
): string {
  const op = assessment.highestPriorityOpportunity;
  const finding = presentStrategicOpportunity(op);

  if (!op) {
    return sanitizeCustomerFacingText(
      "I’ll refine the highest-impact remaining details while preserving the current brand and photography.",
    );
  }

  if (
    weaknessNoun(op) === "visual restraint" ||
    /restraint|quality gap/i.test(op.title)
  ) {
    return sanitizeCustomerFacingText(
      [
        `The highest priority is simplifying the visual treatment so the page feels more polished and focused.`,
        `I’ll start with the hero, then refine any remaining competing effects while preserving the current brand and photography.`,
      ].join(" "),
    );
  }

  if (op.id === "cta" || op.domain === "cta") {
    return sanitizeCustomerFacingText(
      [
        `The highest priority is making the main call to action clearer.`,
        `I’ll refine that next step while keeping the rest of the page and brand unchanged.`,
      ].join(" "),
    );
  }

  return sanitizeCustomerFacingText(
    [
      `The highest priority is ${finding.title.toLowerCase()}.`,
      finding.recommendedAction
        ? `${finding.recommendedAction.replace(/\.$/, "")}, while preserving the current brand and photography.`
        : "I’ll apply the highest-priority improvements while preserving the current brand and photography.",
    ].join(" "),
  );
}

export function presentRecommendation(input: {
  title: string;
  explanation?: string;
}): CustomerFacingFinding {
  const title = humanizeRecommendationTitle(input.title);
  const explanation = sanitizeCustomerFacingText(
    stripListMarkers(input.explanation || ""),
  );
  return {
    title,
    explanation: explanation || title,
    recommendedAction: title,
  };
}

export function presentCapabilityGap(input: {
  title?: string;
  reason?: string;
  nextStep?: string;
}): CustomerFacingFinding {
  const title = humanizeRecommendationTitle(
    input.title || input.nextStep || "Additional business input needed",
  );
  const explanation = sanitizeCustomerFacingText(
    stripListMarkers(
      input.reason ||
        input.nextStep ||
        "I need real business information before I can finish this safely.",
    ),
  );
  return {
    title,
    explanation,
    recommendedAction: stripListMarkers(input.nextStep || title),
  };
}

export function presentSpecialistFinding(input: {
  title: string;
  explanation?: string;
}): CustomerFacingFinding {
  return presentRecommendation(input);
}

/** Present benchmark guidance without exposing profile names/IDs. */
export function presentBenchmarkGuidance(input: {
  dimension?: string | null;
  characteristic?: string | null;
  recommendedFocus?: string | null;
}): string {
  const dim = (input.dimension || "").toLowerCase();
  if (/restraint|visual/.test(dim) || /restraint/i.test(input.characteristic || "")) {
    return "The page would benefit from a more restrained, premium finish with fewer competing visual treatments.";
  }
  if (/hero/.test(dim)) {
    return "The hero would feel stronger with fewer competing treatments so the photo and headline can lead.";
  }
  if (/trust|proof/.test(dim)) {
    return "The page would feel more trustworthy if proof appeared earlier, before the ask.";
  }
  if (/cta|conversion/.test(dim)) {
    return "The page would convert better with a clearer, more specific next step for visitors.";
  }
  const focus = sanitizeCustomerFacingText(
    stripListMarkers(input.recommendedFocus || ""),
  );
  if (focus && !customerFacingTextExposesArchitecture(focus) && !/quality bar|benchmark/i.test(focus)) {
    return focus;
  }
  return "The page would benefit from a more polished, premium finish with fewer competing visual treatments.";
}

type StrengthGroup = {
  id: string;
  match: RegExp;
  preferred: (businessName?: string) => string;
};

const STRENGTH_GROUPS: StrengthGroup[] = [
  {
    id: "service_clarity",
    match: /service clarity|concrete services|what .+ offers|services are clear|understand the (services|offer)/i,
    preferred: (name) =>
      name
        ? `Visitors can quickly understand what ${name} offers.`
        : "Visitors can quickly understand what the business offers.",
  },
  {
    id: "photography",
    match: /photograph|imagery|gallery|photo/i,
    preferred: () => "Strong photography gives the page personality.",
  },
  {
    id: "hierarchy",
    match: /hierarchy|easy to scan|scanab/i,
    preferred: () => "The page hierarchy is easy to scan.",
  },
  {
    id: "consistency",
    match: /consistent|cohesive|visual consistency/i,
    preferred: () => "The overall presentation is visually consistent.",
  },
];

/**
 * Collapse near-equivalent strengths. Prefer specific customer-useful wording.
 * Deterministic — no LLM.
 */
export function dedupeReviewStrengths(
  strengths: string[],
  options?: { businessName?: string },
): string[] {
  const seenGroups = new Set<string>();
  const result: string[] = [];

  for (const raw of strengths) {
    const plain = stripListMarkers(raw);
    if (!plain || plain.length < 4) continue;

    let grouped = false;
    for (const group of STRENGTH_GROUPS) {
      if (group.match.test(plain)) {
        if (!seenGroups.has(group.id)) {
          seenGroups.add(group.id);
          result.push(group.preferred(options?.businessName));
        }
        grouped = true;
        break;
      }
    }
    if (!grouped) {
      const key = plain.toLowerCase();
      if (!result.some((r) => r.toLowerCase() === key)) {
        result.push(plain);
      }
    }
  }

  return result.slice(0, 4);
}

export function formatCustomerFacingFinding(
  finding: CustomerFacingFinding,
): string {
  const parts = [finding.title];
  if (finding.explanation) parts.push(finding.explanation);
  if (finding.whyItMatters) parts.push(finding.whyItMatters);
  return sanitizeCustomerFacingText(parts.join(" "));
}
