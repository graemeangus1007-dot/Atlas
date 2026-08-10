/**
 * Strategic Director presentation — prioritization narrative, not a critique dump.
 * Mode is determined from the user command before assessment runs.
 */

import type { StrategicAssessment } from "@/lib/strategy/types";

export type StrategicRequestMode = "advisory" | "execute_completion";

export type StrategicAdvisoryQuestion =
  | "biggest_weakness"
  | "fix_first"
  | "time_allocation"
  | "highest_impact"
  | "general_priority";

export type StrategicRequestClassification = {
  mode: StrategicRequestMode;
  advisoryQuestion: StrategicAdvisoryQuestion | null;
};

/** Explicit completion / launch-ready execution authorization. */
export const STRATEGIC_COMPLETION_PHRASES =
  /\b(complete\s+((my|the)\s+)?(website|site)|finish\s+((my|the)\s+)?(website|site)|make\s+((the|my)\s+)?(website|site)\s+complete|make\s+it\s+launch[- ]ready)\b/i;

/**
 * Classify Strategic Director intent from the user command.
 * Mode must not be inferred from the assessment after the fact.
 */
export function classifyStrategicRequest(
  request: string,
): StrategicRequestClassification | null {
  const text = request.trim();
  if (!text) return null;

  if (STRATEGIC_COMPLETION_PHRASES.test(text)) {
    return { mode: "execute_completion", advisoryQuestion: null };
  }

  if (
    /\b(what'?s\s+the\s+biggest\s+weakness|biggest\s+weakness)\b/i.test(text)
  ) {
    return { mode: "advisory", advisoryQuestion: "biggest_weakness" };
  }
  if (/\bwhat\s+should\s+i\s+fix\s+first\b/i.test(text)) {
    return { mode: "advisory", advisoryQuestion: "fix_first" };
  }
  if (/\bwhere\s+should\s+i\s+spend\s+another\s+hour\b/i.test(text)) {
    return { mode: "advisory", advisoryQuestion: "time_allocation" };
  }
  if (
    /\bwhat\s+would\s+improve\s+(this\s+site|it|the\s+site)\s+the\s+most\b/i.test(
      text,
    ) ||
    /\bhighest[- ]impact\s+(improvement|opportunity)\b/i.test(text)
  ) {
    return { mode: "advisory", advisoryQuestion: "highest_impact" };
  }
  if (
    /\b(what\s+matters\s+most|biggest\s+(opportunity|priority)|single\s+highest[- ]impact)\b/i.test(
      text,
    ) ||
    /^(what\s+matters\s+most)[.!?]?$/i.test(text)
  ) {
    return { mode: "advisory", advisoryQuestion: "general_priority" };
  }

  return null;
}

export function isStrategicDirectorRequest(request: string): boolean {
  return classifyStrategicRequest(request) != null;
}

/** Advisory strategic asks — analysis only. */
export function isStrategicAdvisoryRequest(request: string): boolean {
  const classified = classifyStrategicRequest(request);
  return classified?.mode === "advisory";
}

export function isStrategicCompletionRequest(request: string): boolean {
  return classifyStrategicRequest(request)?.mode === "execute_completion";
}

function opportunityPlainName(
  assessment: StrategicAssessment,
): { title: string; short: string } {
  const highest = assessment.highestPriorityOpportunity;
  if (!highest) {
    return { title: "overall polish", short: "finishing details" };
  }
  const title = highest.title.replace(/\.$/, "");
  const short = /cta/i.test(title)
    ? "the primary CTA"
    : /trust|proof/i.test(title)
      ? "trust and proof"
      : /hero|composition|readability/i.test(title)
        ? "hero composition"
        : /spacing|polish/i.test(title)
          ? "spacing and polish"
          : title.toLowerCase();
  return { title, short };
}

function formatAdvisoryAnswer(
  assessment: StrategicAssessment,
  question: StrategicAdvisoryQuestion,
): string {
  const { title, short } = opportunityPlainName(assessment);
  const leader = labelLeader(assessment.recommendedLeader);

  switch (question) {
    case "biggest_weakness":
      return [
        `The biggest weakness is ${short}.`,
        assessment.highestPriorityOpportunity?.explanation ||
          "Visitors can understand the business, but this gap is holding the experience back.",
        `${leader} should lead the fix.`,
      ].join(" ");

    case "fix_first":
      return [
        `Fix ${short} first.`,
        `Making progress on “${title}” should have more impact than additional visual polish right now.`,
        `${leader} owns that work.`,
      ].join(" ");

    case "time_allocation":
      return [
        `Spend the next hour on the conversion and clarity path: start with ${short}.`,
        assessment.executionSequence[1]
          ? `Then continue with ${assessment.executionSequence[1].title.toLowerCase()}.`
          : "Then confirm the contact path continues the same action clearly.",
        `Defer lower-impact polish until that foundation is sound.`,
      ].join(" ");

    case "highest_impact":
      return [
        `The highest-impact improvement is ${short}.`,
        `It should make the next step unmistakable before you spend more time on lower-impact polish.`,
        `${leader} should lead.`,
      ].join(" ");

    case "general_priority":
    default:
      return [
        `What matters most right now is ${short}.`,
        assessment.highestPriorityOpportunity?.explanation ||
          assessment.summary,
        `${leader} should lead that work.`,
      ].join(" ");
  }
}

export function formatStrategicDirectorReport(
  assessment: StrategicAssessment,
  options?: {
    mode?: StrategicRequestMode;
    advisoryQuestion?: StrategicAdvisoryQuestion | null;
  },
): string {
  const mode = options?.mode ?? "advisory";
  const question = options?.advisoryQuestion ?? "general_priority";

  if (mode === "advisory") {
    const lines: string[] = [formatAdvisoryAnswer(assessment, question)];

    if (assessment.blockedWork.length > 0) {
      lines.push("", "Needs real business input before Atlas can finish it");
      for (const item of assessment.blockedWork.slice(0, 2)) {
        lines.push(
          `• ${item.title}${item.blockedReason ? ` — ${item.blockedReason}` : ""}`,
        );
      }
    }

    return lines.join("\n");
  }

  // execute_completion preface — brief priority, then Transformation owns the rest.
  const { short, title } = opportunityPlainName(assessment);
  const lines: string[] = [
    `Highest priority: ${title}.`,
    `I’m executing the coordinated plan with ${labelLeader(assessment.recommendedLeader)} leading on ${short}.`,
  ];

  if (assessment.executionSequence.length > 0) {
    lines.push("", "Execution order");
    for (const step of assessment.executionSequence.slice(0, 5)) {
      const flag = step.blocked ? " — blocked until real inputs arrive" : "";
      lines.push(`• ${step.order}. ${step.title}${flag}`);
    }
  }

  return lines.join("\n");
}

function labelLeader(leader: StrategicAssessment["recommendedLeader"]): string {
  switch (leader) {
    case "visual_composition":
      return "Visual Composition";
    case "conversion_director":
      return "Conversion Director";
    case "taste":
      return "Taste";
    case "creative_director":
      return "Creative Director";
    case "transformation":
      return "Transformation";
    case "capability_gap":
      return "a capability gap";
    default:
      return "the right specialist";
  }
}

export function strategicTextExposesInternalIds(text: string): boolean {
  return /\b(StrategicAssessment|priorityRanking|recommendedLeader|eligibleToJudge|overallTaste|strategicRequestMode|Apply All)\b/.test(
    text,
  );
}

export const STRATEGIC_DIRECTOR_FOLLOW_UPS = [
  "What should I fix first?",
  "How do we improve conversion?",
  "Polish the website.",
] as const;

export const STRATEGIC_COMPLETION_FOLLOW_UPS = [
  "Review my website",
  "What should I fix first?",
  "Improve SEO",
] as const;
