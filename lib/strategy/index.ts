export {
  STRATEGIC_DIRECTOR_VERSION,
  type StrategicLeader,
  type WebsiteStateBand,
  type StrategicOpportunityId,
  type StrategicOpportunity,
  type StrategicConflict,
  type StrategicRoadmapStep,
  type StrategicAssessment,
  type StrategicGatheredInputs,
} from "@/lib/strategy/types";

export {
  assessStrategicPriorities,
  gatherStrategicInputs,
  strategicExecutionTitles,
} from "@/lib/strategy/orchestrator";

export {
  computePriorityScore,
  rankOpportunities,
  selectRecommendedLeader,
  inferWebsiteState,
  estimateBusinessImpact,
} from "@/lib/strategy/priority";

export {
  detectStrategicConflicts,
  applyConflictResolutions,
} from "@/lib/strategy/conflicts";

export {
  DEPENDENCY_LANE,
  defaultDependsOn,
  resolveDependencyOrder,
  executionOrderRespectsDependencies,
  laneOrder,
} from "@/lib/strategy/dependencies";

export {
  buildStrategicRoadmap,
  buildStrategicSummary,
  assembleStrategicAssessment,
} from "@/lib/strategy/planner";

export {
  classifyStrategicRequest,
  isStrategicDirectorRequest,
  isStrategicAdvisoryRequest,
  isStrategicCompletionRequest,
  formatStrategicDirectorReport,
  strategicTextExposesInternalIds,
  STRATEGIC_DIRECTOR_FOLLOW_UPS,
  STRATEGIC_COMPLETION_FOLLOW_UPS,
  STRATEGIC_COMPLETION_PHRASES,
  type StrategicRequestMode,
  type StrategicAdvisoryQuestion,
  type StrategicRequestClassification,
} from "@/lib/strategy/presentation";

export {
  formatStrategicCompletionReport,
  isIdempotentCompletion,
  logStrategicCompletionDiagnostics,
  type StrategicCompletionDiagnostics,
} from "@/lib/strategy/handoff";

export {
  verifyStrategicAssessment,
  logStrategicDiagnostics,
  type StrategicVerificationResult,
} from "@/lib/strategy/verification";
