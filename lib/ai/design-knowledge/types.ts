/**
 * Atlas Design Knowledge Base (v1.2) — structured design judgment.
 * Principles guide critique/strategy; they are not rigid rules or edit ops.
 */

export const DESIGN_KNOWLEDGE_CATEGORIES = [
  "homepage",
  "typography",
  "spacing",
  "layout",
  "hierarchy",
  "trust",
  "color",
  "imagery",
  "conversion",
  "accessibility",
  "branding",
] as const;

export type DesignKnowledgeCategory =
  (typeof DESIGN_KNOWLEDGE_CATEGORIES)[number];

export const DESIGN_KNOWLEDGE_APPLIES_TO = [
  "homepage",
  "landing-page",
  "service-business",
  "portfolio",
  "local-business",
  "mobile",
  "all",
] as const;

export type DesignKnowledgeAppliesTo =
  (typeof DESIGN_KNOWLEDGE_APPLIES_TO)[number];

export const DESIGN_KNOWLEDGE_IMPACT = ["high", "medium", "low"] as const;
export type DesignKnowledgeImpact = (typeof DESIGN_KNOWLEDGE_IMPACT)[number];

/**
 * Stable, reusable design principle — independent of any single prompt.
 */
export type DesignPrinciple = {
  id: string;
  category: DesignKnowledgeCategory;
  title: string;
  principle: string;
  reasoning: string;
  impact: DesignKnowledgeImpact;
  appliesTo: DesignKnowledgeAppliesTo[];
  /** Observable site signals used by selectors (lowercase keywords). */
  signals: string[];
  relatedPrincipleIds: string[];
  /** Machine-oriented action hints for ranking/ops matching — not user copy. */
  recommendedActions: string[];
  cautions?: string[];
};

/** Internal explainability — never shown raw to end users. */
export type DesignKnowledgeEvidence = {
  principleId: string;
  observedSignal: string;
  affectedArea: string;
  confidence: number;
};

/**
 * Deterministic selection input derived from website / request state.
 */
export type DesignKnowledgeSelectionContext = {
  industry?: string;
  businessType?: string;
  audience?: string;
  primaryGoal?: string;
  designLanguage?: string;
  businessTone?: string;
  enabledSections?: string[];
  sectionOrder?: string[];
  hasHeroImage?: boolean;
  hasTestimonials?: boolean;
  hasFaq?: boolean;
  galleryFilledSlots?: number;
  libraryCount?: number;
  spacing?: string;
  visualHierarchy?: boolean;
  maturityLevel?: string;
  overallCompleteness?: number;
  detectedWeaknesses?: string[];
  request?: string;
  /** Viewport / mobile hint. */
  mobile?: boolean;
  lowContrast?: boolean;
  longParagraphs?: boolean;
  weakHeadingScale?: boolean;
  weakCtaHierarchy?: boolean;
  secondaryCtaCompeting?: boolean;
  heroCopyLength?: number;
  pageType?: DesignKnowledgeAppliesTo;
};

export type RankedDesignPrinciple = {
  principle: DesignPrinciple;
  score: number;
  matchedSignals: string[];
};
