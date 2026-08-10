/**
 * Agency-style user-facing transformation report (no internal IDs).
 */

import { sanitizeCustomerFacingText } from "@/lib/presentation/customer-language";
import type {
  TransformationExecutionResult,
  TransformationGoalResult,
} from "@/lib/transformation/execution-types";
import {
  humanLabelForImprovement,
  type TransformationOutcomeAssessment,
} from "@/lib/transformation/outcome";
import { transformationTextExposesInternalIds } from "@/lib/transformation/presentation";
import { designQualityBandLabel } from "@/lib/creative-director/score-calibration";
import type { TransformationCapabilityGap } from "@/lib/transformation/capability-gaps";

function bulletForGoal(goal: TransformationGoalResult): string | null {
  if (goal.status !== "applied") return null;
  const text = goal.objective.replace(/\.$/, "");
  if (!text) return null;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function needsInputBullets(
  blocked: TransformationGoalResult[],
  gaps: TransformationCapabilityGap[],
): string[] {
  const lines: string[] = [];
  for (const g of gaps.filter((x) => x.userInputRequired)) {
    lines.push(g.recommendedNextStep);
  }
  for (const g of blocked) {
    const reason = (g.reason || "").toLowerCase();
    if (/photo|imagery|image|gallery|photograph/.test(reason)) {
      lines.push("Upload project photography");
    } else if (/testimonial|review|trust/.test(reason)) {
      lines.push("Add verified customer reviews");
    } else if (/hero/.test(reason)) {
      lines.push("Add a hero photograph");
    } else if (
      g.reason &&
      !/rolled back|did not help|measurable/i.test(g.reason)
    ) {
      lines.push(g.reason);
    }
  }
  const seen = new Set<string>();
  return lines
    .filter((l) => {
      const key = l.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 4);
}

function improvedBullets(outcome?: TransformationOutcomeAssessment): string[] {
  if (!outcome) return [];
  const labels = outcome.meaningfulImprovements.map(humanLabelForImprovement);
  const seen = new Set<string>();
  return labels
    .filter((l) => {
      if (seen.has(l)) return false;
      seen.add(l);
      return true;
    })
    .slice(0, 5);
}

function revertedBullets(result: TransformationExecutionResult): string[] {
  const lines: string[] = [];
  for (const br of result.batchResults) {
    if (!br.rolledBack) continue;
    if (br.scoreVerdict === "harmful") {
      lines.push("A change that lowered the page quality was reverted");
    } else if (/rhythm|spacing|polish/i.test(br.notes.join(" "))) {
      lines.push(
        "The spacing adjustment did not improve the overall page rhythm",
      );
    } else {
      lines.push("One adjustment did not produce a measurable improvement");
    }
  }
  const seen = new Set<string>();
  return lines
    .filter((l) => {
      if (seen.has(l)) return false;
      seen.add(l);
      return true;
    })
    .slice(0, 4);
}

function formatNoGainReport(result: TransformationExecutionResult): string[] {
  const gaps = result.capabilityGaps ?? [];
  const band =
    result.qualityBand || designQualityBandLabel(result.baselineScore);
  const score = Math.max(result.baselineScore, result.finalScore);
  const userGap = gaps.find((g) => g.userInputRequired);
  const anyGap = userGap ?? gaps[0];
  const restored =
    result.rollbackPerformed || result.rollbackScope === "full";

  // Strong but not exceptional — with a diagnosed remaining weakness
  if (score >= 80 && score < 90 && anyGap) {
    return [
      "Your website is already strong, but it is not yet exceptional.",
      "",
      `The remaining weakness is ${anyGap.affectedSection}: ${anyGap.problem}` +
        (restored
          ? " I tested the supported trust and layout changes, but they did not improve the page, so I restored the original."
          : " I tested the supported changes, but they did not improve the page, so I kept the current version."),
      "",
      `Highest-impact next step: ${anyGap.recommendedNextStep}.`,
    ];
  }

  // Already strong / exceptional — tested, no gain, no content gap
  if (score >= 80 && !userGap) {
    return [
      `Your website is already in ${band.toLowerCase()} shape. I tested a new direction, but it did not improve the result, so I kept the current version.`,
      anyGap
        ? `The remaining weakness is ${anyGap.affectedSection}: ${anyGap.problem}`
        : "",
      anyGap
        ? `Highest-impact next step: ${anyGap.recommendedNextStep}.`
        : "",
    ].filter(Boolean);
  }

  if (anyGap) {
    return [
      "I kept the current version because the remaining weaknesses need new proof content rather than another styling pass.",
      "",
      `The remaining weakness is ${anyGap.affectedSection}: ${anyGap.problem}`,
      "",
      `Highest-impact next step: ${anyGap.recommendedNextStep}.`,
    ];
  }

  // Generic no-gain with diagnosis — not undifferentiated failure
  return [
    score >= 80
      ? `Your website is already in ${band.toLowerCase()} shape. I tested a new direction, but it did not improve the result, so I kept the current version.`
      : "I tested the redesign, but the supported changes did not produce a measurable improvement, so I restored the previous version.",
    "",
    "Highest-impact next step: strengthen proof with verified reviews or project photography before another styling pass.",
  ];
}

export function formatTransformationExecutionReport(
  result: TransformationExecutionResult,
): string {
  const outcome = result.wholePage.outcome;
  const verdict = outcome?.verdict;
  const stageCount = Math.max(
    1,
    result.batchResults.filter((b) => !b.failed && !b.rolledBack).length,
  );
  const changed = result.executedGoals
    .map(bulletForGoal)
    .filter((x): x is string => Boolean(x));
  const improved = improvedBullets(outcome);
  const reverted = revertedBullets(result);
  const gaps = result.capabilityGaps ?? [];

  const lines: string[] = [];

  if (result.skippedAsRepeat) {
    lines.push(
      "I already tested this same redesign direction and it did not improve the page, so I kept the current version instead of repeating those edits.",
      "",
      gaps[0]
        ? `Highest-impact next step: ${gaps[0].recommendedNextStep}.`
        : "Highest-impact next step: add verified customer reviews or stronger project photography.",
    );
  } else if (result.status === "blocked") {
    lines.push(
      "I couldn’t start this redesign safely.",
      "",
      "What blocked it",
      ...result.preflight.issues.slice(0, 4).map((i) => `• ${i}`),
    );
  } else if (
    verdict === "neutral_no_gain" ||
    (result.status === "failed" &&
      result.rollbackScope === "full" &&
      !outcome?.criticalRegressions.length)
  ) {
    lines.push(...formatNoGainReport(result));
  } else if (
    verdict === "critical_regression" ||
    (result.status === "failed" && outcome?.criticalRegressions.length)
  ) {
    lines.push(
      "I stopped the redesign after a verification failure and restored the previous version.",
      "",
      "What went wrong",
      ...(outcome?.criticalRegressions ?? result.wholePage.notes)
        .slice(0, 4)
        .map((n) => `• ${n}`),
    );
  } else if (
    verdict === "evaluation_inconclusive" &&
    result.rollbackScope === "full"
  ) {
    lines.push(
      "I couldn’t confidently verify the redesign result, so I restored the previous version to stay safe.",
      "",
      "What I need next",
      `• ${gaps[0]?.recommendedNextStep || "Clearer trust or hero assets so the next pass can be measured"}`,
    );
  } else if (result.status === "already_satisfied") {
    const band =
      result.qualityBand || designQualityBandLabel(result.finalScore);
    lines.push(
      `Your website is already in ${band.toLowerCase()} shape for the current content.`,
      "",
      "Result",
      `Overall design score is ${result.finalScore} (${band}).`,
    );
    if (gaps[0]) {
      lines.push(
        "",
        `Highest-impact next step: ${gaps[0].recommendedNextStep}.`,
      );
    }
  } else if (
    result.status === "partially_applied" ||
    verdict === "verified_partial" ||
    result.rollbackScope === "selective"
  ) {
    lines.push(
      "I completed the parts of the redesign that measurably improved the site" +
        (reverted.length > 0
          ? " and rolled back one change that did not help."
          : "."),
    );
    const showImproved = improved.length > 0 ? improved : changed;
    if (showImproved.length > 0) {
      lines.push("", "Improved", ...showImproved.map((c) => `• ${c}`));
    }
    if (reverted.length > 0) {
      lines.push("", "Not applied", ...reverted.map((c) => `• ${c}`));
    }
    lines.push(
      "",
      "Result",
      result.verifiedScoreDelta > 0
        ? `Overall design score moved from ${result.baselineScore} to ${result.finalScore}.`
        : `Overall design score stayed near ${result.finalScore}, while targeted dimensions improved.`,
    );
  } else {
    lines.push(
      `I completed the redesign in ${stageCount} coordinated stage${stageCount === 1 ? "" : "s"}.`,
    );
    const showImproved = improved.length > 0 ? improved : changed;
    if (showImproved.length > 0) {
      lines.push("", "What changed", ...showImproved.map((c) => `• ${c}`));
    }
    lines.push(
      "",
      "Result",
      `Overall design score improved from ${result.baselineScore} to ${result.finalScore}.`,
    );
  }

  const needs = needsInputBullets(
    [...result.blockedGoals, ...result.failedGoals],
    gaps,
  );
  if (
    needs.length > 0 &&
    result.status !== "failed" &&
    !result.skippedAsRepeat &&
    verdict !== "neutral_no_gain"
  ) {
    lines.push(
      "",
      needs.length === 1
        ? "One item still needs your input:"
        : `${needs.length} items still need your input:`,
      ...needs.map((n) => `• ${n}`),
    );
  }

  if (result.refinementApplied) {
    lines.push(
      "",
      "I also ran one refinement pass on the weakest remaining area.",
    );
  }

  if (result.tastePolishApplied) {
    lines.push(
      "",
      "I finished with one restrained polish pass so the page feels more deliberate without changing brand, content, or structure.",
    );
  }

  const text = lines
    .filter((l, i, arr) => !(l === "" && arr[i - 1] === ""))
    .join("\n")
    .replace(/\bDone\.\s*/g, "");

  let cleaned = text;
  if (transformationTextExposesInternalIds(text)) {
    cleaned = text
      .replace(
        /\b(set_page_direction|strengthen_hero|establish_trust|clarify_services|strengthen_proof|sequence_proof_before_ask|clarify_primary_cta|simplify_conversion|improve_rhythm|tighten_messaging)\b/gi,
        "that improvement",
      )
      .replace(
        /\b(applyHeroPattern|moveSection|insertSection|setCreativePolish|setGalleryInteraction)\b/g,
        "update",
      );
  }
  return sanitizeCustomerFacingText(cleaned);
}

export function transformationPlanId(
  planCreatedAt: string,
  version: string,
): string {
  return `tx-${version}-${planCreatedAt.replace(/[:.]/g, "").slice(0, 18)}`;
}
