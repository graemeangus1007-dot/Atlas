/**
 * Atlas Brain contracts (Sprint 26.0A).
 * Orchestration layer — one designer face, many specialists behind the scenes.
 */

import type { EditOperation } from "@/lib/ai/edit-operations";
import type { ImageOperation } from "@/lib/ai/image-operations";
import type { IntentCategory } from "@/lib/ai/intent-router";

/** Specialists Brain may invoke (never shown to the user by name). */
export const ATLAS_AGENT_IDS = [
  "intent_router",
  "editor_agent",
  "image_agent",
  "creative_director",
  "business_advisor",
  /** Reserved for future plug-ins */
  "motion_designer",
  "seo_advisor",
  "accessibility_advisor",
  "performance_advisor",
  "analytics_advisor",
  "publisher",
] as const;

export type AtlasAgentId = (typeof ATLAS_AGENT_IDS)[number];

export type AtlasBrainIntent =
  | IntentCategory
  | "image_edit"
  | "feel_direction"
  | "publish"
  | "recommend"
  | "multi_goal"
  /** Sprint 26.2 — continue Action Memory plan */
  | "continue_plan"
  /** Sprint 26.2 — explicit command categories */
  | "command_seo"
  | "command_animations"
  | "command_icons"
  | "command_readability"
  | "command_spacing"
  | "command_typography"
  | "command_accessibility"
  | "command_performance"
  | "command_navigation"
  | "command_branding"
  | "command_buttons";

export type AtlasExecutionStep = {
  id: string;
  /** Internal only — never surface agent ids in user copy. */
  agent: AtlasAgentId;
  label: string;
  /** Optional structured ops for this step (filled at plan or execute time). */
  operations?: Array<EditOperation | ImageOperation>;
};

export type AtlasExecutionPlan = {
  goal: string;
  steps: AtlasExecutionStep[];
  estimatedImpact: "high" | "medium" | "low";
};

/** Durable preferences learned across turns (persisted on BusinessProject). */
export type AtlasProjectMemory = {
  preferredLayouts?: string[];
  preferredThemes?: string[];
  primaryGoal?: string;
  businessTone?: string;
  imageStyle?: string;
  notes?: string[];
  updatedAt?: string;
};

export type AtlasBrainDecision = {
  intent: AtlasBrainIntent;
  confidence: number;
  selectedAgents: AtlasAgentId[];
  needsClarification: boolean;
  clarificationQuestion?: string;
  executionPlan: AtlasExecutionPlan;
  explanation: string;
  followUpSuggestions: string[];
  /** Memory patch inferred from this turn (merged on execute). */
  memoryPatch?: Partial<AtlasProjectMemory>;
  /** Sprint 26.2 — which decision-engine stage produced this. */
  decisionStage?: string;
  /** Sprint 26.2 — explicit command kind when applicable. */
  commandKind?: string;
};

export const ATLAS_BRAIN_CLARIFICATION_OPTIONS = [
  "Better visuals",
  "Better copy",
  "Better conversions",
  "Something else",
] as const;
