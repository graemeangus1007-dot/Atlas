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
  summary: string;
  project: BusinessProject;
  operations: EditOperation[];
  changes: EditChangeSummary[];
  baselineProject: BusinessProject;
  preflight: TransformationPreflightReport;
  wholePage: WholePageVerificationResult;
  batchResults: TransformationBatchResult[];
  rollbackPerformed: boolean;
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
};

export type TransformationExecutionDiagnostics = {
  planId: string;
  baselineScore: number;
  preflightStatus: boolean;
  goalStatuses: Array<{
    goalId: TransformationGoalId;
    classification: TransformationGoalExecutionStatus;
    status: TransformationGoalApplyStatus;
  }>;
  dependencyOrder: TransformationGoalId[];
  batchOrder: TransformationBatchId[];
  operationsByGoal: Record<string, string[]>;
  verificationByBatch: Record<string, boolean>;
  finalScore: number;
  scoreDelta: number;
  refinementApplied: boolean;
  blockedReasons: string[];
  rollbackPerformed: boolean;
};
