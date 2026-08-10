/**
 * Transformation Engine Phase 2 — guarded execution types.
 */

import type { EditChangeSummary, EditOperation } from "@/lib/ai/edit-operations";
import type {
  TransformationGoalId,
  TransformationPhaseId,
  TransformationPlan,
} from "@/lib/transformation/types";
import type { WebsiteSectionId } from "@/lib/creative-director";
import type { BusinessProject } from "@/types/business-project";

export type TransformationGoalExecutionStatus =
  | "ready"
  | "blocked_missing_asset"
  | "blocked_unsupported"
  | "blocked_conflict"
  | "already_satisfied"
  | "deferred_high_risk";

export type TransformationGoalApplyStatus =
  | "applied"
  | "skipped"
  | "blocked"
  | "failed"
  | "already_satisfied"
  | "deferred";

export type TransformationExecutionStatus =
  | "applied"
  | "partially_applied"
  | "blocked"
  | "failed"
  | "already_satisfied";

export type GoalVerificationResult = {
  passed: boolean;
  scoreContribution: number;
  notes: string[];
};

export type TransformationGoalResult = {
  goalId: TransformationGoalId;
  objective: string;
  classification: TransformationGoalExecutionStatus;
  status: TransformationGoalApplyStatus;
  operations: EditOperation[];
  affectedSections: WebsiteSectionId[];
  verification: GoalVerificationResult;
  reason?: string;
  batchId?: string;
};

export type TransformationBatchId =
  | "direction_hero"
  | "trust_proof"
  | "offer_services"
  | "conversion"
  | "polish";

export type TransformationBatch = {
  id: TransformationBatchId;
  title: string;
  phaseIds: TransformationPhaseId[];
  goalIds: TransformationGoalId[];
};

export type TransformationBatchResult = {
  batchId: TransformationBatchId;
  revisionId: string;
  appliedGoalIds: TransformationGoalId[];
  failed: boolean;
  rolledBack: boolean;
  verificationPassed: boolean;
  notes: string[];
  /** Score checkpoint after the batch (null when no ops applied). */
  scoreVerdict?: "beneficial" | "neutral" | "harmful" | "inconclusive";
  overallDelta?: number;
  targetedDelta?: number;
};

export type BrandScopeSnapshot = {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string;
  headingFont: string;
  bodyFont: string;
  heroImageId: string | null;
  mediaLibraryIds: string[];
  businessName: string;
  businessType: string;
  description: string;
  contactPhone: string;
  contactEmail: string;
  contactFormEnabled: boolean;
  formFieldSurface: unknown;
  galleryImageIds: string[];
  sectionContentFingerprint: string;
};

export type TransformationPreflightReport = {
  passed: boolean;
  planValidationPassed: boolean;
  dependenciesSatisfiable: boolean;
  brandCaptured: boolean;
  revisionBaselineValid: boolean;
  issues: string[];
  blockedGoalIds: TransformationGoalId[];
  readyGoalIds: TransformationGoalId[];
};

export type WholePageVerificationResult = {
  passed: boolean;
  baselineScore: number;
  finalScore: number;
  verifiedScoreDelta: number;
  highestPriorityImproved: boolean;
  accessibilityRegression: boolean;
  brandIntegrityRegression: boolean;
  criticalDependencyFailed: boolean;
  notes: string[];
  /** Rich outcome assessment — drives selective rollback. */
  outcome?: import("@/lib/transformation/outcome").TransformationOutcomeAssessment;
};

export type TransformationExecutionResult = {
  planId: string;
  status: TransformationExecutionStatus;
  baselineScore: number;
  finalScore: number;
  verifiedScoreDelta: number;
  executedGoals: TransformationGoalResult[];
  blockedGoals: TransformationGoalResult[];
  failedGoals: TransformationGoalResult[];
  revisionsCreated: string[];
  refinementApplied: boolean;
  /** At most one Taste Engine polish pass after verified transformation. */
  tastePolishApplied: boolean;
  summary: string;
  project: BusinessProject;
  operations: EditOperation[];
  changes: EditChangeSummary[];
  baselineProject: BusinessProject;
  preflight: TransformationPreflightReport;
  wholePage: WholePageVerificationResult;
  batchResults: TransformationBatchResult[];
  rollbackPerformed: boolean;
  /** full | selective | none */
  rollbackScope?: "full" | "selective" | "none";
  capabilityGaps?: import("@/lib/transformation/capability-gaps").TransformationCapabilityGap[];
  qualityBand?: string;
  skippedAsRepeat?: boolean;
};

export type ClassifiedTransformationGoal = {
  goalId: TransformationGoalId;
  classification: TransformationGoalExecutionStatus;
  reason: string;
  operations: EditOperation[];
  affectedSections: WebsiteSectionId[];
};

export type GoalMappingResult =
  | {
      ok: true;
      status: "ready" | "already_satisfied";
      operations: EditOperation[];
      reason?: string;
    }
  | {
      ok: false;
      status: Exclude<
        TransformationGoalExecutionStatus,
        "ready" | "already_satisfied"
      >;
      operations: [];
      reason: string;
    };

export type TransformationExecutorInput = {
  project: BusinessProject;
  plan: TransformationPlan;
  /** When omitted, strategy signals are taken from the plan vision only. */
  requestId?: string | null;
  logDiagnostics?: boolean;
  /** Skip optional refinement (tests). */
  allowRefinement?: boolean;
  /** Skip optional Taste polish after verified transformation (tests). */
  allowTastePolish?: boolean;
};

export type TransformationExecutionDiagnostics = {
  planId: string;
  baselineScore: number;
  baselineOverall: number;
  preflightStatus: boolean;
  goalStatuses: Array<{
    goalId: TransformationGoalId;
    classification: TransformationGoalExecutionStatus;
    status: TransformationGoalApplyStatus;
  }>;
  dependencyOrder: TransformationGoalId[];
  batchOrder: TransformationBatchId[];
  batchScores: Array<{
    batchId: TransformationBatchId;
    overallDelta: number;
    verdict: string;
  }>;
  operationsByGoal: Record<string, string[]>;
  verificationByBatch: Record<string, boolean>;
  finalScore: number;
  finalOverall: number;
  overallDelta: number;
  scoreDelta: number;
  dimensionDeltas: Record<string, number>;
  sectionDeltas: Record<string, number>;
  goalExpectedDimensions: Record<string, string[]>;
  goalObservedDeltas: Record<string, Record<string, number>>;
  batchVerdicts: string[];
  criticalRegressions: string[];
  evaluatorConfidence: number;
  finalVerdict: string;
  refinementApplied: boolean;
  tastePolishApplied: boolean;
  blockedReasons: string[];
  rollbackPerformed: boolean;
  rollbackScope: "full" | "selective" | "none";
};
