/**
 * Validate transformation plan completeness and safety (advisory).
 */

import type { DesignStrategy } from "@/lib/ai/design-strategy-types";
import { detectDependencyCycle } from "@/lib/transformation/dependencies";
import type {
  TransformationConflict,
  TransformationGoal,
  TransformationGraph,
  TransformationValidation,
  WebsiteVision,
} from "@/lib/transformation/types";

export function validateTransformationPlan(input: {
  vision: WebsiteVision;
  goals: TransformationGoal[];
  graph: TransformationGraph;
  conflicts: TransformationConflict[];
  strategy: DesignStrategy;
}): TransformationValidation {
  const issues: string[] = [];

  const complete =
    Boolean(input.vision.overallDirection) &&
    input.vision.designGoals.length > 0 &&
    input.goals.length > 0;
  if (!complete) issues.push("Plan is incomplete — vision or goals are missing.");

  const dependencySafe = !detectDependencyCycle(
    input.goals,
    input.graph.edges,
  );
  if (!dependencySafe) issues.push("Dependency graph is not cycle-safe.");

  const highConflicts = input.conflicts.filter((c) => c.severity === "high");
  const consistent = highConflicts.length === 0;
  if (!consistent) {
    issues.push(
      `Unresolved high-severity conflict: ${highConflicts[0]!.explanation}`,
    );
  }

  const achievable =
    input.goals.every((g) => g.expectedImprovement > 0) &&
    input.goals.filter((g) => g.risk === "high").length <= 2;
  if (!achievable) {
    issues.push("Plan looks hard to achieve as currently scoped.");
  }

  const patternCompatible =
    !input.strategy.patternComposition ||
    input.strategy.patternComposition.compositionScore >= 40 ||
    input.goals.some((g) => g.id === "set_page_direction");
  if (!patternCompatible) {
    issues.push("Plan is not pattern-compatible with the current composition score.");
  }

  const brandCompatible = input.vision.constraints.some((c) =>
    /brand palette|brand identity/i.test(c),
  );
  if (!brandCompatible) {
    issues.push("Brand compatibility constraint is missing from the vision.");
  }

  // Order should mention hero/trust before conversion when both exist
  const order = input.graph.dependencyOrder;
  const heroIdx = order.indexOf("strengthen_hero");
  const trustIdx = order.indexOf("establish_trust");
  const convIdx = order.indexOf("simplify_conversion");
  if (convIdx >= 0 && trustIdx >= 0 && convIdx < trustIdx) {
    issues.push("Conversion is ordered before trust in the dependency graph.");
  }
  if (convIdx >= 0 && heroIdx >= 0 && convIdx < heroIdx) {
    issues.push("Conversion is ordered before first-impression work.");
  }

  const passed =
    complete &&
    dependencySafe &&
    consistent &&
    achievable &&
    patternCompatible &&
    brandCompatible &&
    issues.length === 0;

  return {
    complete,
    dependencySafe,
    consistent,
    achievable,
    patternCompatible,
    brandCompatible,
    issues,
    passed,
  };
}
