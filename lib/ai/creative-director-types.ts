/**
 * Atlas Creative Director contracts (Sprint 25.0A).
 * Orchestrates Visual / Motion / Content / Conversion / Brand recommendations.
 */

import type { DesignKnowledgeEvidence } from "@/lib/ai/design-knowledge/types";
import type { EditOperation } from "@/lib/ai/edit-operations";
import type { ImageOperation } from "@/lib/ai/image-operations";
import type { BusinessProject } from "@/types/business-project";
import type { EditorConversationMessage } from "@/lib/ai/editor-conversation";

export const CREATIVE_MATURITY_LEVELS = [
  "Draft",
  "Developing",
  "Professional",
  "Launch Ready",
] as const;

export type CreativeMaturityLevel = (typeof CREATIVE_MATURITY_LEVELS)[number];

export const CREATIVE_RECOMMENDATION_KINDS = [
  "visual",
  "content",
  "motion",
  "conversion",
  "brand",
] as const;

export type CreativeRecommendationKind =
  (typeof CREATIVE_RECOMMENDATION_KINDS)[number];

export const MISSING_CAPABILITY_IDS = [
  "hero_image",
  "service_images",
  "gallery",
  "team_photos",
  "icons",
  "logo",
  "color_consistency",
  "typography",
  "spacing",
  "visual_hierarchy",
  "motion",
  "testimonials",
  "faq",
  "team",
  "about",
  "contact",
  "cta_strength",
  "social_proof",
  "lead_capture",
  "weak_cta",
  "flat_spacing",
] as const;

export type MissingCapabilityId = (typeof MISSING_CAPABILITY_IDS)[number];

export type MissingCapability = {
  id: MissingCapabilityId;
  label: string;
  category: CreativeRecommendationKind | "trust";
};

/** Structured ops the Creative Director may apply (edit + image). */
export type CreativeDirectorOperation = EditOperation | ImageOperation;

/** Sprint 28.1 — whether Apply All can execute this recommendation. */
export type CritiqueSupportStatus =
  | "supported"
  | "needs_images"
  | "coming_soon";

export type CreativeDirectorRecommendation = {
  id: string;
  kind: CreativeRecommendationKind;
  title: string;
  /** Creative-director voice explanation. */
  explanation: string;
  impact: "high" | "medium" | "low";
  impactScore: number;
  confidence: number;
  operations: CreativeDirectorOperation[];
  /** Linked missing capability ids (for dedupe / scoring). */
  capabilityIds: MissingCapabilityId[];
  /** False when the user must upload media first, etc. */
  applyable: boolean;
  blockedReason?: string;
  /** Explicit support label for planning / Apply All reporting. */
  supportStatus?: CritiqueSupportStatus;
  estimatedTime: string;
  /** v1.2 — internal knowledge evidence (never shown raw in UI). */
  knowledgeEvidence?: DesignKnowledgeEvidence[];
};

export type CreativeDirectorReport = {
  overallCompleteness: number;
  maturityLevel: CreativeMaturityLevel;
  missingCapabilities: MissingCapability[];
  recommendedImprovements: CreativeDirectorRecommendation[];
  strengths: string[];
  /** Natural director-style summary for the conversation. */
  narrative: string;
  reviewedAt: string;
  fingerprint: string;
  /** True when Completeness < 80 — show “Complete My Website”. */
  offerCompleteWebsite: boolean;
};

export type CompleteWebsitePlan = {
  recommendations: CreativeDirectorRecommendation[];
  narrative: string;
  overallCompleteness: number;
  maturityLevel: CreativeMaturityLevel;
};

export type CreativeDirectorInput = {
  project: BusinessProject;
  history?: Array<Pick<EditorConversationMessage, "role" | "content">>;
  /** Cap listed recommendations (Complete My Website uses a higher limit). */
  limit?: number;
};

export const COMPLETE_WEBSITE_THRESHOLD = 80;
