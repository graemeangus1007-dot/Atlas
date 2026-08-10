/**
 * Strategic Director (Phase 1) — orchestrates specialist systems.
 * Coordinates priorities; does not re-score or replace directors.
 */

import type { IntelligenceOwner } from "@/lib/scope/types";

export const STRATEGIC_DIRECTOR_VERSION = "1.0.0";

/** Specialist that should lead the next improvement. */
export type StrategicLeader =
  | "visual_composition"
  | "conversion_director"
  | "taste"
  | "creative_director"
  | "transformation"
  | "capability_gap"
  | "none";

export type WebsiteStateBand =
  | "excellent"
  | "developing"
  | "weak"
  | "blocked";

export type StrategicOpportunityId =
  | "hero_composition"
  | "hero_readability"
  | "narrative"
  | "layout_structure"
  | "trust"
  | "proof"
  | "cta"
  | "contact_flow"
  | "spacing_polish"
  | "visual_polish"
  | "benchmark_gap"
  | "capability_gap";

export type StrategicOpportunity = {
  id: StrategicOpportunityId;
  title: string;
  /** Specialist that owns this opportunity. */
  leader: StrategicLeader;
  owner: IntelligenceOwner | "capability_gap";
  domain: string;
  /** Specialist-sourced score (0–100); Strategic Director does not re-score. */
  sourceScore: number;
  businessImpact: number;
  expectedImprovement: number;
  implementationConfidence: number;
  verificationConfidence: number;
  blocked: boolean;
  blockedReason?: string;
  /** Opportunities that should complete before this one. */
  dependsOn: StrategicOpportunityId[];
  explanation: string;
};

export type StrategicConflict = {
  ownerA: string;
  ownerB: string;
  reason: string;
  recommendedResolution: string;
};

export type StrategicRoadmapStep = {
  order: number;
  opportunityId: StrategicOpportunityId;
  title: string;
  leader: StrategicLeader;
  blocked: boolean;
};

export type StrategicAssessment = {
  version: string;
  assessedAt: string;
  websiteState: WebsiteStateBand;
  highestPriorityOpportunity: StrategicOpportunity | null;
  recommendedLeader: StrategicLeader;
  executionSequence: StrategicRoadmapStep[];
  blockedWork: StrategicOpportunity[];
  conflictingRecommendations: StrategicConflict[];
  estimatedBusinessImpact: number;
  confidence: number;
  summary: string;
  /** Full ranked list (deterministic). */
  opportunities: StrategicOpportunity[];
  /** Priority scores used for ranking (diagnostics). */
  priorityRanking: Array<{
    id: StrategicOpportunityId;
    priorityScore: number;
    leader: StrategicLeader;
  }>;
};

export type StrategicGatheredInputs = {
  creativeDirector: import("@/lib/creative-director/types").CreativeDirectorEvaluation;
  conversionDirector: import("@/lib/conversion/types").ConversionEvaluation | null;
  taste: import("@/lib/taste/types").TasteEvaluation | null;
  visualComposition: import("@/lib/composition/types").CompositionEvaluation | null;
  benchmark:
    | import("@/lib/benchmarks/types").BenchmarkComparison
    | null;
  transformationPlan: import("@/lib/transformation/types").TransformationPlan | null;
  capabilityGaps: import("@/lib/transformation/capability-gaps").TransformationCapabilityGap[];
};
