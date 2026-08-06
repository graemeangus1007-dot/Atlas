/**
 * Agency-style user-facing transformation report (no internal IDs).
 */

import type {
  TransformationExecutionResult,
  TransformationGoalResult,
} from "@/lib/transformation/execution-types";
import { transformationTextExposesInternalIds } from "@/lib/transformation/presentation";

function bulletForGoal(goal: TransformationGoalResult): string | null {
  if (goal.status !== "applied" && goal.status !== "already_satisfied") {
    return null;
  }
  const text = goal.objective.replace(/\.$/, "");
  if (!text) return null;
  // Prefer past-tense agency phrasing for applied goals
  if (goal.status === "already_satisfied") return null;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function needsInputBullets(blocked: TransformationGoalResult[]): string[] {
  const lines: string[] = [];
  for (const g of blocked) {
    const reason = (g.reason || "").toLowerCase();
    if (/photo|imagery|image|gallery|photograph/.test(reason)) {
      lines.push("Upload project photography");
    } else if (/testimonial|review|trust/.test(reason)) {
      lines.push("Add verified customer reviews");
    } else if (/hero/.test(reason)) {
      lines.push("Add a hero photograph");
    } else if (g.classification === "blocked_unsupported") {
      lines.push(g.reason || "Complete an unsupported layout change manually");
    } else if (g.reason) {
      lines.push(g.reason);
    }
  }
  // Dedupe
  const seen = new Set<string>();
  return lines.filter((l) => {
    const key = l.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 4);
}

export function formatTransformationExecutionReport(
  result: TransformationExecutionResult,
): string {
  const stageCount = Math.max(1, result.batchResults.filter((b) => !b.failed).length);
  const changed = result.executedGoals
    .map(bulletForGoal)
    .filter((x): x is string => Boolean(x));

  const lines: string[] = [];

  if (result.status === "blocked") {
    lines.push(
      "I couldn’t start this redesign safely.",
      "",
      "What blocked it",
      ...result.preflight.issues.slice(0, 4).map((i) => `• ${i}`),
    );
  } else if (result.status === "failed") {
    lines.push(
      "I stopped the redesign after a verification failure.",
      "",
      "What happened",
      ...result.wholePage.notes.slice(0, 4).map((n) => `• ${n}`),
      ...result.failedGoals
        .slice(0, 3)
        .map((g) => `• ${g.reason || g.objective}`),
    );
  } else if (result.status === "already_satisfied") {
    lines.push(
      "This website already matches the planned redesign direction.",
      "",
      "Result",
      `Overall design score is ${result.finalScore}.`,
    );
  } else {
    lines.push(
      `I completed the redesign in ${stageCount} coordinated stage${stageCount === 1 ? "" : "s"}.`,
    );
    if (changed.length > 0) {
      lines.push("", "What changed", ...changed.map((c) => `• ${c}`));
    }
    lines.push(
      "",
      "Result",
      `Overall design score improved from ${result.baselineScore} to ${result.finalScore}.`,
    );
    if (result.status === "partially_applied") {
      lines.push(
        "Some planned improvements still need your input before they can finish.",
      );
    }
  }

  const needs = needsInputBullets([
    ...result.blockedGoals,
    ...result.failedGoals,
  ]);
  if (needs.length > 0) {
    lines.push(
      "",
      needs.length === 1
        ? "One item still needs your input:"
        : `${needs.length} items still need your input:`,
      ...needs.map((n) => `• ${n}`),
    );
  }

  if (result.refinementApplied) {
    lines.push("", "I also ran one refinement pass on the weakest remaining area.");
  }

  const text = lines.filter((l, i, arr) => !(l === "" && arr[i - 1] === "")).join("\n");
  if (transformationTextExposesInternalIds(text)) {
    return text
      .replace(/\b(set_page_direction|strengthen_hero|establish_trust|clarify_services|strengthen_proof|sequence_proof_before_ask|simplify_conversion|improve_rhythm|tighten_messaging)\b/gi, "that improvement")
      .replace(/\b(applyHeroPattern|moveSection|insertSection|setCreativePolish|setGalleryInteraction)\b/g, "update");
  }
  return text;
}

export function transformationPlanId(planCreatedAt: string, version: string): string {
  return `tx-${version}-${planCreatedAt.replace(/[:.]/g, "").slice(0, 18)}`;
}
