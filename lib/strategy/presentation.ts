/**
 * Strategic Director presentation — prioritization narrative, not a critique dump.
 * Mode is determined from the user command before assessment runs.
 * v1.6.4 — customer-language boundary (no internal architecture terms).
 */

import {
  presentCapabilityGap,
  presentStrategicExecution,
  presentStrategicOpportunity,
  sanitizeCustomerFacingText,
  customerFacingTextExposesArchitecture,
} from "@/lib/presentation/customer-language";
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

function weaknessLabel(assessment: StrategicAssessment): string {
  const op = assessment.highestPriorityOpportunity;
  if (!op) return "finishing polish";
  const finding = presentStrategicOpportunity(op);
  if (/focused|restraint|competing/i.test(finding.title + finding.explanation)) {
    return "visual restraint";
  }
  if (op.id === "cta") return "an unclear primary action";
  if (op.id === "trust") return "thin trust signals";
  if (op.id === "proof") return "proof arriving too late";
  if (op.id === "hero_composition" || op.id === "hero_readability") {
    return "a busy hero treatment";
  }
  return finding.title.toLowerCase();
}

function formatAdvisoryAnswer(
  assessment: StrategicAssessment,
  question: StrategicAdvisoryQuestion,
): string {
  const op = assessment.highestPriorityOpportunity;
  const finding = presentStrategicOpportunity(op);
  const label = weaknessLabel(assessment);

  switch (question) {
    case "biggest_weakness":
      return sanitizeCustomerFacingText(
        [
          `The biggest weakness is ${label}.`,
          finding.explanation,
        ].join(" "),
      );

    case "fix_first":
      return sanitizeCustomerFacingText(
        [
          `Fix ${label} first.`,
          finding.whyItMatters ||
            `${finding.title} should have more impact than additional visual polish right now.`,
        ].join(" "),
      );

    case "time_allocation": {
      const next = assessment.executionSequence[1];
      const nextTitle = next
        ? presentStrategicOpportunity(
            assessment.opportunities.find((o) => o.id === next.opportunityId) ??
              null,
          ).title.toLowerCase()
        : "confirming the contact path stays clear";
      return sanitizeCustomerFacingText(
        [
          `Spend the next hour on ${label}.`,
          `Then continue with ${nextTitle}.`,
          "Defer lower-impact polish until that foundation is sound.",
        ].join(" "),
      );
    }

    case "highest_impact":
      return sanitizeCustomerFacingText(
        [
          `The highest-impact improvement is ${label}.`,
          finding.whyItMatters ||
            "It should make the next step unmistakable before you spend more time on lower-impact polish.",
        ].join(" "),
      );

    case "general_priority":
    default:
      return sanitizeCustomerFacingText(
        [
          `What matters most right now is ${label}.`,
          finding.explanation,
        ].join(" "),
      );
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
        const gap = presentCapabilityGap({
          title: item.title,
          reason: item.blockedReason,
          nextStep: item.blockedReason,
        });
        lines.push(
          `• ${gap.title}${gap.explanation && gap.explanation !== gap.title ? ` — ${gap.explanation}` : ""}`,
        );
      }
    }

    return sanitizeCustomerFacingText(lines.join("\n"));
  }

  // execute_completion preface — customer language only.
  const lines: string[] = [presentStrategicExecution(assessment)];

  const focusItems: string[] = [];
  for (const step of assessment.executionSequence.slice(0, 5)) {
    const op =
      assessment.opportunities.find((o) => o.id === step.opportunityId) ??
      null;
    const title = presentStrategicOpportunity(
      op ??
        ({
          id: step.opportunityId,
          title: step.title,
          explanation: "",
          leader: step.leader,
          owner: step.leader,
          domain: step.opportunityId,
          sourceScore: 50,
          businessImpact: 50,
          expectedImprovement: 10,
          implementationConfidence: 70,
          verificationConfidence: 70,
          blocked: step.blocked,
          dependsOn: [],
        } as StrategicAssessment["opportunities"][number]),
    ).title.trim();
    if (!title) continue;
    const flag = step.blocked ? " — needs real business input first" : "";
    focusItems.push(`${focusItems.length + 1}. ${title}${flag}`);
  }
  // Never render "What I'll focus on" without at least one complete item.
  if (focusItems.length > 0) {
    lines.push("", "What I’ll focus on", ...focusItems);
  }

  return sanitizeCustomerFacingText(lines.join("\n"));
}

export function strategicTextExposesInternalIds(text: string): boolean {
  return (
    /\b(StrategicAssessment|priorityRanking|recommendedLeader|eligibleToJudge|overallTaste|strategicRequestMode|Apply All)\b/.test(
      text,
    ) || customerFacingTextExposesArchitecture(text)
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
