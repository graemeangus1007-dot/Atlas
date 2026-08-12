/**
 * Build a fresh TransformationPlan from a BusinessProject (no LLM).
 */

import { buildDesignCritiqueContext } from "@/lib/ai/design-critique";
import {
  buildDesignStrategy,
  designStrategyInputFromContext,
} from "@/lib/ai/design-strategy";
import type { DesignStrategy } from "@/lib/ai/design-strategy-types";
import { planWebsiteTransformation } from "@/lib/transformation/planner";
import type { TransformationPlan } from "@/lib/transformation/types";
import type { BusinessProject } from "@/types/business-project";

export function buildTransformationPlanForProject(
  project: BusinessProject,
  request?: string,
): { plan: TransformationPlan; strategy: DesignStrategy } {
  const context = buildDesignCritiqueContext(project);
  const strategyInput = designStrategyInputFromContext(context, request);
  const strategy = buildDesignStrategy(strategyInput);
  // Always rebuild with the live BusinessProject so polish goals (e.g. visual
  // restraint) can observe hero overlay/blur/motion — not only strategyInput.
  const plan = planWebsiteTransformation({
    strategy,
    strategyInput,
    evaluation: strategy.creativeDirectorEvaluation,
    project,
  });
  return { plan, strategy: { ...strategy, transformationPlan: plan } };
}
