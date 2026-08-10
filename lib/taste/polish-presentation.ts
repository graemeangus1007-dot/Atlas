/**
 * User-facing Taste polish copy — no internal IDs or raw scores.
 */

import { tasteDimensionLabel } from "@/lib/taste/registry";
import type { TasteEvaluation } from "@/lib/taste/types";
import type { TastePolishPlan } from "@/lib/taste/polish-types";

export function formatTastePolishExplanation(input: {
  plan: TastePolishPlan;
  tasteBefore: TasteEvaluation;
  tasteAfter: TasteEvaluation;
}): string {
  const bits: string[] = [];
  const targets = input.plan.targetDimensions;

  if (targets.includes("typographyHarmony") || targets.includes("scanability")) {
    bits.push("tightened the heading hierarchy");
  }
  if (
    targets.includes("spacingHarmony") ||
    targets.includes("visualRhythm")
  ) {
    bits.push("normalized section spacing");
  }
  if (targets.includes("restraint") || targets.includes("visualWeight")) {
    bits.push("reduced competing visual effects");
  }
  if (targets.includes("ctaPresence") || targets.includes("proportion")) {
    bits.push("improved CTA balance");
  }
  if (targets.includes("alignmentQuality")) {
    bits.push("aligned content more consistently");
  }
  if (targets.includes("componentConsistency")) {
    bits.push("unified button and surface language");
  }

  if (bits.length === 0) {
    bits.push("refined spacing, hierarchy, and finishing details");
  }

  const list =
    bits.length === 1
      ? bits[0]!
      : bits.length === 2
        ? `${bits[0]} and ${bits[1]}`
        : `${bits.slice(0, -1).join(", ")}, and ${bits[bits.length - 1]}`;

  return `I completed a final polish pass: ${list}. The content, brand, and page structure stayed unchanged.`;
}

export function formatTastePolishIneligibleExplanation(reasons: string[]): string {
  const first = reasons[0] ?? "the structure still needs work";
  return `This site isn’t ready for a final agency-quality polish yet — ${first.replace(/\.$/, "")}. Once the structural issues are solid, I can apply a restrained finishing pass.`;
}

/** Detect user requests for a taste polish pass. */
export function isTastePolishRequest(request: string): boolean {
  const text = request.trim();
  if (!text) return false;
  return (
    /\b(polish\s+(the\s+)?(website|site|page|design)|final\s+(agency[- ]quality\s+)?pass|agency[- ]quality\s+pass)\b/i.test(
      text,
    ) ||
    /\b(make\s+it\s+feel\s+more\s+professional|feel\s+more\s+professional)\b/i.test(
      text,
    ) ||
    /\b(refine\s+(the\s+)?(spacing|typography|design)|spacing\s+and\s+typography)\b/i.test(
      text,
    ) ||
    /\bmake\s+the\s+design\s+feel\s+more\s+consistent\b/i.test(text) ||
    /\bgive\s+it\s+a\s+final\b/i.test(text)
  );
}

export function tastePolishMentionsInternalIds(text: string): boolean {
  return /\b(tasteEvaluation|eligibleToJudge|overallTaste|setCreativePolish|TasteDimension|polishOperations)\b/.test(
    text,
  );
}

export function describeTargetDimensions(
  dims: TastePolishPlan["targetDimensions"],
): string {
  return dims.map((d) => tasteDimensionLabel(d)).join(", ");
}
