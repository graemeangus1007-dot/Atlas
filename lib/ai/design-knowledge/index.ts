/** Atlas Design Knowledge Base (v1.2) — public surface. */

export type {
  DesignKnowledgeAppliesTo,
  DesignKnowledgeCategory,
  DesignKnowledgeEvidence,
  DesignKnowledgeImpact,
  DesignKnowledgeSelectionContext,
  DesignPrinciple,
  RankedDesignPrinciple,
} from "@/lib/ai/design-knowledge/types";
export {
  DESIGN_KNOWLEDGE_APPLIES_TO,
  DESIGN_KNOWLEDGE_CATEGORIES,
  DESIGN_KNOWLEDGE_IMPACT,
} from "@/lib/ai/design-knowledge/types";

export {
  DESIGN_KNOWLEDGE_REGISTRY,
  countDesignPrinciplesByCategory,
  getDesignPrincipleById,
  getDesignPrinciplesByCategory,
  listAllDesignPrinciples,
  validateDesignPrincipleRegistry,
} from "@/lib/ai/design-knowledge/registry";

export {
  MAX_PROMPT_DESIGN_PRINCIPLES,
  MAX_STRATEGY_DESIGN_PRINCIPLES,
  buildDesignKnowledgeEvidence,
  designKnowledgeContextFromParts,
  formatDesignPrinciplesForPrompt,
  matchPrinciplesToText,
  rankDesignPrinciples,
  scoreActionAgainstPrinciples,
  selectRelevantDesignPrinciples,
  textExposesDesignPrincipleIds,
} from "@/lib/ai/design-knowledge/selectors";

export {
  explainFromDesignKnowledge,
  explainFromEvidence,
  sanitizeDesignKnowledgeUserText,
} from "@/lib/ai/design-knowledge/explain";
