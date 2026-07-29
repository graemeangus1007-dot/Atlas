/**
 * Atlas Business Advisor / Critique Engine contracts (Sprint 23.0A / 23.1).
 * Future advisor modules (SEO, Accessibility, Performance, …) plug into this shape.
 */

import type {
  CritiqueCategoryScores,
  CritiqueScoreCategory,
} from "@/lib/ai/critique-scoring";
import type { EditOperation } from "@/lib/ai/edit-operations";
import type { EditorConversationMessage } from "@/lib/ai/editor-conversation";
import type { BusinessProject } from "@/types/business-project";

export const ADVISOR_CATEGORIES = [
  "conversion",
  "trust",
  "readability",
  "mobile_usability",
  "accessibility",
  "seo",
  "visual_hierarchy",
  "cta_effectiveness",
  "branding_consistency",
  "missing_sections",
] as const;

export type AdvisorCategory = (typeof ADVISOR_CATEGORIES)[number];

export type AdvisorImpact = "high" | "medium" | "low";

/** Stable finding emitted by a single advisor module before ranking. */
export type AdvisorFinding = {
  /** Stable id used for duplicate suppression across modules/refreshes. */
  id: string;
  category: AdvisorCategory;
  title: string;
  why: string;
  impact: AdvisorImpact;
  /** Numeric ranking weight (higher = more urgent). */
  impactScore: number;
  /** 0–1 confidence in the finding. */
  confidence: number;
  operations: EditOperation[];
  /** Destructive findings require explicit confirmation (future). */
  destructive?: boolean;
};

export type AdvisorModuleId =
  | "conversion"
  | "trust"
  | "readability"
  | "mobile"
  | "accessibility"
  | "seo"
  | "hierarchy"
  | "cta"
  | "branding"
  | "sections"
  /** Reserved for future plug-ins. */
  | "performance"
  | "analytics";

export type AdvisorContext = {
  project: BusinessProject;
  history?: Array<Pick<EditorConversationMessage, "role" | "content">>;
};

/**
 * Pluggable advisor module — future SEO / A11y / Performance modules implement this.
 */
export type AdvisorModule = {
  id: AdvisorModuleId;
  label: string;
  review: (ctx: AdvisorContext) => AdvisorFinding[];
};

export type BusinessRecommendation = {
  id: string;
  category: AdvisorCategory;
  /** Short label (legacy / conversation). */
  title: string;
  /** @deprecated Prefer whyItMatters — kept for Sprint 23.0A callers. */
  why: string;
  /** “What I noticed” */
  noticed: string;
  /** “Why it matters” */
  whyItMatters: string;
  /** “Expected business outcome” */
  expectedOutcome: string;
  /** Estimated time to apply, e.g. “<10 seconds”. */
  estimatedTime: string;
  impact: AdvisorImpact;
  impactScore: number;
  confidence: number;
  operations: EditOperation[];
  destructive: boolean;
  /** Natural, non-robotic lead-in for conversation tone. */
  narrative: string;
  /** Scored critique bucket this opportunity affects. */
  scoreCategory: CritiqueScoreCategory;
};

export type BusinessAdvisorReport = {
  /** Overall website score 0–100 (deterministic). */
  overallScore: number;
  /** Category scores for the Atlas Review. */
  categoryScores: CritiqueCategoryScores;
  recommendations: BusinessRecommendation[];
  /** Conversational summary (“I noticed…”). */
  summary: string;
  reviewedAt: string;
  /** Fingerprint of the project slice used for this review. */
  fingerprint: string;
};
