export {
  TRANSFORMATION_PLAN_VERSION,
  type TransformationConflict,
  type TransformationDependency,
  type TransformationGoal,
  type TransformationGoalId,
  type TransformationGraph,
  type TransformationPlan,
  type TransformationPhase,
  type TransformationValidation,
  type WebsiteVision,
} from "@/lib/transformation/types";

export { buildWebsiteVision } from "@/lib/transformation/vision";
export {
  planWebsiteTransformation,
  proposeTransformationGoals,
} from "@/lib/transformation/planner";
export { buildTransformationGraph } from "@/lib/transformation/graph";
export { prioritizeTransformationGoals } from "@/lib/transformation/prioritizer";
export {
  dependenciesForGoals,
  topologicalOrder,
} from "@/lib/transformation/dependencies";
export { detectTransformationConflicts } from "@/lib/transformation/conflicts";
export { validateTransformationPlan } from "@/lib/transformation/validator";
export {
  explainTransformationPlan,
  explainWebsiteVision,
  logTransformationDiagnostics,
  transformationTextExposesInternalIds,
} from "@/lib/transformation/presentation";

// Phase 2 — guarded execution
export type {
  TransformationExecutionResult,
  TransformationGoalExecutionStatus,
  TransformationGoalResult,
  TransformationPreflightReport,
  TransformationExecutionStatus,
} from "@/lib/transformation/execution-types";
export { mapTransformationGoalToOperations } from "@/lib/transformation/mapper";
export { classifyTransformationGoals } from "@/lib/transformation/classify";
export { runTransformationPreflight } from "@/lib/transformation/preflight";
export { buildExecutionBatches } from "@/lib/transformation/batches";
export {
  executeTransformationPlan,
  executeFreshWebsiteTransformation,
} from "@/lib/transformation/executor";
export { buildTransformationPlanForProject } from "@/lib/transformation/plan-from-project";
export { formatTransformationExecutionReport } from "@/lib/transformation/report";
export {
  captureTransformationUndoSnapshot,
  restoreTransformationBaseline,
  transformationRevisionPrompt,
} from "@/lib/transformation/undo";
export {
  captureBrandScopeSnapshot,
  brandIntegrityViolations,
} from "@/lib/transformation/brand-snapshot";
