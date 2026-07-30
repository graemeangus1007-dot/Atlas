/**
 * LLM Design Critique contracts (Sprint 28.0A).
 * Critique + plan only — never mutates BusinessProject directly.
 */

import type { CreativeDirectorRecommendation } from "@/lib/ai/creative-director-types";
import type { EditOperation } from "@/lib/ai/edit-operations";
import type { ImageOperation } from "@/lib/ai/image-operations";
import type { BusinessProject } from "@/types/business-project";
import type { EditorConversationMessage } from "@/lib/ai/editor-conversation";

export const CRITIQUE_IMPACT_LEVELS = ["high", "medium", "low"] as const;
export type CritiqueImpact = (typeof CRITIQUE_IMPACT_LEVELS)[number];

export const DESIGN_CRITIQUE_MODES = ["critique", "execute"] as const;
export type DesignCritiqueMode = (typeof DESIGN_CRITIQUE_MODES)[number];

/** Constrained change kinds the LLM may propose (maps to existing ops). */
export const PROPOSED_CHANGE_KINDS = [
  "replaceText",
  "changeTheme",
  "setTypography",
  "setButtonStyle",
  "setSiteWidth",
  "setTemplate",
  "insertSection",
  "removeSection",
  "updateSeo",
  "rewriteServices",
  "setCreativePolish",
  "replaceColors",
  "shortenNavigation",
  "replaceHeroImage",
  "setSectionImage",
  "replacePlaceholder",
] as const;

export type ProposedChangeKind = (typeof PROPOSED_CHANGE_KINDS)[number];

export type CritiqueStrength = {
  id: string;
  title: string;
  evidence: string;
};

export type CritiqueFinding = {
  id: string;
  title: string;
  observation: string;
  /** missing = capability gap; weak = present but underperforming */
  severity: "missing" | "weak";
  affectedAreas: string[];
};

/**
 * LLM-facing proposed change — validated then converted to EditOperation/ImageOperation.
 * Unused string fields are empty; unused booleans are false.
 */
export type ProposedChange = {
  kind: ProposedChangeKind;
  target: string;
  value: string;
  sectionType: string;
  headingFont: string;
  bodyFont: string;
  buttonStyle: string;
  siteWidth: string;
  templateId: string;
  theme: string;
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  fromColor: string;
  toColor: string;
  siteTitle: string;
  metaDescription: string;
  spacing: string;
  serviceIcons: boolean;
  motion: boolean;
  visualHierarchy: boolean;
  contactFormEnabled: boolean;
  assetHint: string;
  sectionSlot: string;
  servicesJson: string;
};

export type CritiqueImprovement = {
  id: string;
  title: string;
  observation: string;
  rationale: string;
  expectedBusinessOutcome: string;
  impact: CritiqueImpact;
  affectedAreas: string[];
  proposedChanges: ProposedChange[];
};

export type DesignCritique = {
  summary: string;
  currentStrengths: CritiqueStrength[];
  coreProblems: CritiqueFinding[];
  designDirection: {
    name: string;
    rationale: string;
    emotionalGoal: string;
    visualPrinciples: string[];
  };
  prioritizedImprovements: CritiqueImprovement[];
  expectedOutcome: string;
  confidence: number;
};

/** Safe, minimized context for the model — no owner IDs, billing, leads, or secrets. */
export type DesignCritiqueContext = {
  businessName: string;
  industry: string;
  businessDescription: string;
  targetAudience: string;
  primaryGoal: string;
  services: Array<{ title: string; description: string }>;
  homepageCopy: {
    heroEyebrow: string;
    heroTitle: string;
    heroDescription: string;
    primaryCta: string;
    secondaryCta: string;
    aboutTitle: string;
    aboutBody: string;
    contactTitle: string;
    contactDescription: string;
    contactButtonText: string;
  };
  sectionOrder: string[];
  enabledSections: string[];
  designSystem: {
    language: string;
    label: string;
    imageryStyle: string;
    motionStyle: string;
    explanation: string;
  };
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    theme: string;
  };
  typography: {
    headingFont: string;
    bodyFont: string;
  };
  spacing: string;
  buttons: string;
  siteWidth: string;
  templateId: string;
  creativePolish: {
    serviceIcons: boolean;
    motion: boolean;
    visualHierarchy: boolean;
    spacing: string;
  };
  imagery: {
    hasHeroImage: boolean;
    galleryFilledSlots: number;
    galleryTotalSlots: number;
    hasLogo: boolean;
    libraryCount: number;
    placeholderSummary: string[];
  };
  seo: {
    siteTitle: string;
    metaDescription: string;
    socialTitle: string;
    socialDescription: string;
    robotsIndex: boolean;
  };
  maturity: {
    overallCompleteness: number;
    maturityLevel: string;
    categoryScores: Record<string, number>;
  };
  atlasMemory: {
    preferredLayouts: string[];
    preferredThemes: string[];
    primaryGoal: string;
    businessTone: string;
    imageStyle: string;
    notes: string[];
  };
  recentConversation: Array<{ role: "user" | "assistant"; content: string }>;
  viewportHint: string;
};

export type CritiqueFallbackReason =
  | "provider_unavailable"
  | "authentication"
  | "quota"
  | "rate_limit"
  | "timeout"
  | "model"
  | "schema"
  | "refusal"
  | "incomplete"
  | "validation"
  | "unknown";

export type DesignCritiqueDiagnostics = {
  provider: "openai" | "mock";
  model: string;
  requestId: string;
  openaiRequestId?: string | null;
  latencyMs: number;
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  critiqueMode: DesignCritiqueMode;
  findingCount: number;
  operationCount: number;
  usedFallback: boolean;
  fallbackLabeled: boolean;
  fallbackReason?: CritiqueFallbackReason | null;
  /** Pipeline stage that failed (when usedFallback or hard failure). */
  failingStage?: string | null;
  failingFunction?: string | null;
  httpStatus?: number | null;
  responseStatus?: string | null;
  structuredParseOk?: boolean | null;
  schemaValidationOk?: boolean | null;
  secondaryValidationOk?: boolean | null;
  critiqueToOperationsOk?: boolean | null;
};

export type DesignCritiqueInput = {
  project: BusinessProject;
  request: string;
  mode: DesignCritiqueMode;
  history?: Array<Pick<EditorConversationMessage, "role" | "content">>;
  viewportHint?: string | null;
  /** Injected for tests — bypasses provider factory (treated as success). */
  critiqueFn?: (input: {
    context: DesignCritiqueContext;
    request: string;
    mode: DesignCritiqueMode;
  }) => Promise<DesignCritique> | DesignCritique;
  /**
   * Test-only OpenAI call replacement. When provided with AI_PROVIDER=openai,
   * failures here trigger the labeled fallback path.
   */
  openAiCall?: (input: {
    context: DesignCritiqueContext;
    request: string;
    mode: DesignCritiqueMode;
    atlasRequestId?: string | null;
  }) => Promise<{
    critique: DesignCritique;
    requestId: string;
    openaiRequestId?: string | null;
    model: string;
    latencyMs: number;
    promptTokens: number | null;
    completionTokens: number | null;
    totalTokens: number | null;
  }>;
};

export type DesignCritiqueResult = {
  ok: true;
  critique: DesignCritique;
  recommendations: CreativeDirectorRecommendation[];
  operations: Array<EditOperation | ImageOperation>;
  explanation: string;
  diagnostics: DesignCritiqueDiagnostics;
  /** True when configured openai failed and labeled mock fallback was used. */
  usedFallback: boolean;
  fallbackReason?: CritiqueFallbackReason | null;
};

export type DesignCritiqueFailure = {
  ok: false;
  code: string;
  message: string;
  diagnostics?: Partial<DesignCritiqueDiagnostics>;
};
