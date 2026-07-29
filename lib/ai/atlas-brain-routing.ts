/**
 * Atlas Brain agent selection — Sprint 26.0A / 26.2.
 * Delegates to the Decision Engine so stages stay ordered and deterministic.
 */

import {
  decideWithAtlasBrainEngine,
  type AtlasDecisionEngineInput,
} from "@/lib/ai/atlas-brain-decision-engine";
import type {
  AtlasBrainDecision,
  AtlasExecutionPlan,
} from "@/lib/ai/atlas-brain-types";

export type AtlasBrainRouteInput = AtlasDecisionEngineInput;

/**
 * Decide which specialists should participate — never mutates the project.
 * Always uses the Sprint 26.2 ordered pipeline.
 */
export function decideAtlasBrain(input: AtlasBrainRouteInput): AtlasBrainDecision {
  return decideWithAtlasBrainEngine(input).decision;
}

/**
 * Format an execution plan for the conversation (no agent names).
 */
export function formatExecutionPlanForUser(plan: AtlasExecutionPlan): string {
  if (!plan.steps.length) return "";
  const lines = [
    `Goal`,
    "",
    plan.goal,
    "",
    `Plan`,
    "",
    ...plan.steps.map((step) => `✓ ${step.label}`),
    "",
    `Estimated impact`,
    "",
    plan.estimatedImpact === "high"
      ? "High"
      : plan.estimatedImpact === "medium"
        ? "Medium"
        : "Low",
  ];
  return lines.join("\n");
}
