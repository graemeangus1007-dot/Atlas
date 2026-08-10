/**
 * Conversion Director presentation — analysis only, no Apply All / chips.
 */

import type { ConversionEvaluation } from "@/lib/conversion/types";

export function isConversionDirectorRequest(request: string): boolean {
  const text = request.trim();
  if (!text) return false;
  return (
    /\b(how\s+do\s+we\s+improve\s+conversion|how\s+can\s+(this\s+site\s+)?convert\s+better|improve\s+(lead\s+generation|conversion)|increase\s+(inquir(?:y|ies)|leads?|conversions?)|how\s+do\s+we\s+get\s+more\s+leads|get\s+more\s+leads|lead\s+generation)\b/i.test(
      text,
    ) ||
    /^(improve\s+conversion|increase\s+inquiries)[.!?]?$/i.test(text)
  );
}

export function formatConversionDirectorReport(
  evaluation: ConversionEvaluation,
): string {
  const strengths = evaluation.strengths.slice(0, 3);
  const weaknesses = evaluation.weaknesses.slice(0, 3);
  const recs = evaluation.recommendations.slice(0, 4);

  const lines: string[] = [
    "Here’s a conversion-focused review — analysis only, no changes applied.",
    "",
    "Top conversion strengths",
    ...strengths.map((s) => `• ${s}`),
    "",
    "Top conversion weaknesses",
    ...weaknesses.map((w) => `• ${w}`),
    "",
    "Highest-ROI improvements",
  ];

  if (recs.length === 0) {
    lines.push("• Conversion fundamentals look solid — no urgent gaps.");
  } else {
    for (const r of recs) {
      lines.push(`• ${r.title} — ${r.explanation}`);
    }
  }

  if (evaluation.businessInputNeeded.length > 0) {
    lines.push("", "Needs real business input before changing");
    for (const item of evaluation.businessInputNeeded.slice(0, 3)) {
      lines.push(`• ${item}`);
    }
  }

  lines.push("", evaluation.summary);
  return lines.join("\n");
}

export function conversionTextExposesInternalIds(text: string): boolean {
  return /\b(ConversionEvaluation|overallConversion|conversion_director|eligibleToJudge|Apply All)\b/.test(
    text,
  );
}

/** Follow-ups stay in conversion lane — never Apply All / Homepage Review. */
export const CONVERSION_DIRECTOR_FOLLOW_UPS = [
  "How do we get more leads?",
  "Is the offer obvious?",
  "Is contact easy?",
] as const;
