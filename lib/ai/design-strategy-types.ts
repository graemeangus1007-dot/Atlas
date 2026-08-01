/**
 * Atlas Design Intelligence — Design Strategy contracts (v1.1+).
 * Strategy is decided before edit planning; ops reuse existing capabilities.
 * v1.2 — optional principle IDs + internal knowledge evidence.
 */

import type { DesignKnowledgeEvidence } from "@/lib/ai/design-knowledge/types";

export const DESIGN_AGENCIES_TONES = [
  "luxury",
  "playful",
  "timeless",
  "editorial",
  "minimalist",
  "premium",
  "trustworthy",
  "approachable",
  "modern",
  "handcrafted",
] as const;

export type DesignAgencyTone = (typeof DESIGN_AGENCIES_TONES)[number];

export const DESIGN_FOCUS_AREAS = [
  "hero",
  "trust",
  "proof",
  "hierarchy",
  "whitespace",
  "conversion",
  "imagery",
  "messaging",
  "navigation",
  "mobile",
] as const;

export type DesignFocusArea = (typeof DESIGN_FOCUS_AREAS)[number];

/**
 * Holistic design strategy — answered before recommendations are ordered.
 */
export type DesignStrategy = {
  /** Short direction label, e.g. “Premium coastal craftsmanship”. */
  overallDirection: string;
  /** Single biggest homepage weakness in visitor language. */
  biggestProblem: string;
  /** First impression the page currently creates. */
  currentImpression: string;
  /** Emotion visitors should feel. */
  desiredEmotion: string;
  /** Who the customer is (plain language). */
  customer: string;
  /** What is blocking conversions. */
  conversionBlocker: string;
  /** Section that deserves the most attention first. */
  primaryFocusSection: string;
  /** Intended visual hierarchy in one sentence. */
  visualHierarchy: string;
  /** Missing trust signals, if any. */
  missingTrustSignals: string[];
  /** Whether the page is trying to say too many things. */
  messageOverload: boolean;
  /** Agency tones that should shape composition (not only colors). */
  agencyTones: DesignAgencyTone[];
  /** Coordinated design goals (3–5). */
  designGoals: string[];
  /** Human execution plan before ops (ordered). */
  executionPlan: string[];
  /** Focus areas used to prioritize improvements. */
  priorityFocus: DesignFocusArea[];
  /** 0–1 confidence in this strategy. */
  confidence: number;
  /** v1.2 — selected Design Knowledge principle IDs (internal). */
  principleIds: string[];
  /** v1.2 — internal evidence linking findings to principles (not user-facing). */
  evidence: DesignKnowledgeEvidence[];
};

export type DesignStrategyInput = {
  businessName: string;
  industry: string;
  businessDescription: string;
  targetAudience: string;
  primaryGoal: string;
  heroTitle: string;
  heroDescription: string;
  primaryCta: string;
  sectionOrder: string[];
  enabledSections: string[];
  hasHeroImage: boolean;
  hasTestimonials: boolean;
  hasFaq: boolean;
  galleryFilledSlots: number;
  libraryCount: number;
  spacing: string;
  visualHierarchy: boolean;
  maturityLevel: string;
  overallCompleteness: number;
  designLanguage: string;
  businessTone: string;
  request?: string;
};
