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
  const plan =
    strategy.transformationPlan ??
    planWebsiteTransformation({
      strategy,
      strategyInput,
      evaluation: strategy.creativeDirectorEvaluation,
    });
  return { plan, strategy };
}
