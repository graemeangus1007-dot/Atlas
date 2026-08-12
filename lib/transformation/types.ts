/**
 * Transformation Engine Phase 1 — planning only (no execution).
 */

import type { DesignAgencyTone } from "@/lib/ai/design-strategy-types";
import type { WebsiteSectionId } from "@/lib/creative-director";

export const TRANSFORMATION_PLAN_VERSION = "1.0.0";

export type TransformationPhaseId =
  | "direction"
  | "first_impression"
  | "trust"
  | "offer"
  | "proof"
  | "conversion"
  | "polish";

export type TransformationGoalId =
  | "set_page_direction"
  | "strengthen_hero"
  | "establish_trust"
  | "clarify_services"
  | "strengthen_proof"
  | "sequence_proof_before_ask"
  | "clarify_primary_cta"
  | "simplify_conversion"
  | "clarify_visual_restraint"
  | "improve_rhythm"
  | "tighten_messaging";

export type WebsiteVision = {
  overallDirection: string;
  personality: string[];
  businessPositioning: string;
  visitorJourney: string[];
  trustStrategy: string;
  conversionStrategy: string;
  designGoals: string[];
  highestPriorityProblem: string;
  successDefinition: string;
  constraints: string[];
  agencyTones: DesignAgencyTone[];
};

export type TransformationGoal = {
  id: TransformationGoalId;
  objective: string;
  reason: string;
  priority: "critical" | "high" | "medium" | "low";
  phase: TransformationPhaseId;
  dependencies: TransformationGoalId[];
  affectedSections: WebsiteSectionId[];
  expectedImprovement: number;
  verificationCriteria: string[];
  visitorImpact: number;
  visualImpact: number;
  risk: "low" | "medium" | "high";
  effort: "low" | "medium" | "high";
  requiredAssets: string[];
  theme:
    | "direction"
    | "hero"
    | "trust"
    | "proof"
    | "conversion"
    | "flow"
    | "rhythm"
    | "messaging"
    | "restraint";
};

export type TransformationPhase = {
  id: TransformationPhaseId;
  title: string;
  intent: string;
  goalIds: TransformationGoalId[];
};

export type TransformationDependency = {
  from: TransformationGoalId;
  to: TransformationGoalId;
  reason: string;
};

export type TransformationGraphNode = {
  goalId: TransformationGoalId;
  phase: TransformationPhaseId;
  dependsOn: TransformationGoalId[];
  unlocks: TransformationGoalId[];
};

export type TransformationGraph = {
  nodes: TransformationGraphNode[];
  edges: TransformationDependency[];
  dependencyOrder: TransformationGoalId[];
};

export type TransformationConflictKind =
  | "opposing_section_intent"
  | "tone_clash"
  | "dependency_cycle"
  | "premature_conversion"
  | "proof_removal_vs_proof_add"
  | "direction_mismatch";

export type TransformationConflict = {
  kind: TransformationConflictKind;
  severity: "high" | "medium" | "low";
  goalIds: TransformationGoalId[];
  explanation: string;
  resolution: string;
};

export type TransformationValidation = {
  complete: boolean;
  dependencySafe: boolean;
  consistent: boolean;
  achievable: boolean;
  patternCompatible: boolean;
  brandCompatible: boolean;
  issues: string[];
  passed: boolean;
};

export type TransformationPlan = {
  version: string;
  createdAt: string;
  vision: WebsiteVision;
  phases: TransformationPhase[];
  goals: TransformationGoal[];
  dependencies: TransformationDependency[];
  graph: TransformationGraph;
  conflicts: TransformationConflict[];
  validation: TransformationValidation;
  expectedScoreDelta: number;
  risk: "low" | "medium" | "high";
  confidence: number;
  explanation: string;
};

export type TransformationDiagnostics = {
  vision: string;
  transformationPlan: string;
  graph: string[];
  dependencyOrder: TransformationGoalId[];
  conflicts: string[];
  expectedScoreDelta: number;
  confidence: number;
};
