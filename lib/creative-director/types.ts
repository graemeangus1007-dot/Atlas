/**
 * Whole-Page Composition Intelligence — Creative Director (analysis only).
 * No execution, routing, or editor changes.
 */

export const CREATIVE_DIRECTOR_EVAL_VERSION = "1.0.0";

export type WebsiteSectionId =
  | "hero"
  | "about"
  | "services"
  | "gallery"
  | "testimonials"
  | "faq"
  | "pricing"
  | "cta"
  | "contact"
  | "footer"
  | "team"
  | "newsletter";

export type SectionRecommendation = {
  title: string;
  explanation: string;
  priority: "high" | "medium" | "low";
  /** Internal theme for planner boost — never shown as an ID. */
  theme:
    | "trust"
    | "proof"
    | "conversion"
    | "flow"
    | "rhythm"
    | "narrative"
    | "hierarchy"
    | "imagery"
    | "messaging";
};

export type SectionEvaluation = {
  sectionId: WebsiteSectionId;
  present: boolean;
  score: number;
  strengths: string[];
  weaknesses: string[];
  trustContribution: number;
  conversionContribution: number;
  visualWeight: "heavy" | "medium" | "light";
  readingDifficulty: "easy" | "moderate" | "dense";
  attentionScore: number;
  recommendations: SectionRecommendation[];
  explanation: string;
};

export type WebsiteDimensionScores = {
  overallDesignScore: number;
  firstImpression: number;
  visualHierarchy: number;
  trust: number;
  narrativeFlow: number;
  conversion: number;
  brandConsistency: number;
  accessibility: number;
  mobileExperience: number;
  professionalism: number;
  informationArchitecture: number;
  sectionBalance: number;
  whitespace: number;
  scanability: number;
  visualRhythm: number;
  emotionalTone: number;
};

export type DimensionExplanation = {
  dimension: keyof WebsiteDimensionScores;
  score: number;
  explanation: string;
};

export type FlowIssueKind =
  | "ask_before_trust"
  | "testimonials_too_late"
  | "gallery_too_early"
  | "contact_before_proof"
  | "pricing_before_value"
  | "weak_cta_progression"
  | "repeated_messaging"
  | "missing_transition"
  | "information_overload"
  | "weak_narrative";

export type FlowIssue = {
  kind: FlowIssueKind;
  severity: "high" | "medium" | "low";
  explanation: string;
};

export type FlowEvaluation = {
  score: number;
  idealPath: string[];
  actualPath: string[];
  issues: FlowIssue[];
  explanation: string;
};

export type RhythmEvaluation = {
  score: number;
  cadence: Array<"heavy" | "medium" | "light">;
  densityNotes: string[];
  explanation: string;
};

export type TrustEvaluation = {
  score: number;
  signals: string[];
  missing: string[];
  explanation: string;
};

export type ConversionEvaluation = {
  score: number;
  ctaClarity: number;
  offerClarity: number;
  friction: number;
  decisionConfidence: number;
  explanation: string;
};

export type NarrativeEvaluation = {
  score: number;
  beginning: string;
  middle: string;
  end: string;
  momentum: number;
  questionsAnswered: string[];
  questionsOpen: string[];
  explanation: string;
};

export type WebsitePersonalityTrait =
  | "luxury"
  | "modern"
  | "friendly"
  | "premium"
  | "industrial"
  | "professional"
  | "minimal"
  | "bold"
  | "warm"
  | "approachable"
  | "trustworthy"
  | "confident";

export type PersonalityEvaluation = {
  primary: WebsitePersonalityTrait[];
  explanation: string;
};

export type ConsistencyIssue = {
  kind: string;
  explanation: string;
};

export type DesignConsistencyEvaluation = {
  score: number;
  issues: ConsistencyIssue[];
  explanation: string;
};

export type CrossSectionInsight = {
  explanation: string;
  severity: "high" | "medium" | "low";
  relatedSections: WebsiteSectionId[];
};

export type ExecutiveSummary = {
  overallScore: number;
  biggestStrength: string;
  biggestWeakness: string;
  fastestImprovement: string;
  professionalAssessment: string;
};

export type WebsiteHealthV2 = {
  overall: number;
  design: number;
  trust: number;
  conversion: number;
  narrative: number;
  visualHierarchy: number;
  readability: number;
  brand: number;
  mobile: number;
  accessibility: number;
  professionalism: number;
  /** Poor | Developing | Solid | Strong | Exceptional */
  qualityBand: string;
};

export type CreativeDirectorRecommendation = {
  title: string;
  creativeDirectorExplanation: string;
  priority: "high" | "medium" | "low";
  theme: SectionRecommendation["theme"];
  relatedSections: WebsiteSectionId[];
  estimatedImpact: number;
};

export type CreativeDirectorDiagnostics = {
  overallScore: number;
  flowScore: number;
  rhythmScore: number;
  trustScore: number;
  conversionScore: number;
  narrativeScore: number;
  sectionScores: Record<string, number>;
  strongestSection: WebsiteSectionId | null;
  weakestSection: WebsiteSectionId | null;
  highestROIRecommendation: string | null;
  creativeDirectorSummary: string;
};

export type CreativeDirectorEvaluation = {
  version: string;
  reviewedAt: string;
  dimensions: WebsiteDimensionScores;
  dimensionExplanations: DimensionExplanation[];
  sections: SectionEvaluation[];
  flow: FlowEvaluation;
  rhythm: RhythmEvaluation;
  trust: TrustEvaluation;
  conversion: ConversionEvaluation;
  narrative: NarrativeEvaluation;
  personality: PersonalityEvaluation;
  consistency: DesignConsistencyEvaluation;
  crossSectionInsights: CrossSectionInsight[];
  recommendations: CreativeDirectorRecommendation[];
  executiveSummary: ExecutiveSummary;
  health: WebsiteHealthV2;
  diagnostics: CreativeDirectorDiagnostics;
  /**
   * Advisory quality comparison against a Benchmark Library profile.
   * Quality reference only — never a layout/brand template.
   */
  benchmarkComparison?: import("@/lib/benchmarks/types").BenchmarkComparison | null;
  /**
   * Taste Engine evaluation — final polish judge after functional design.
   * Principles only; never copies benchmark layouts.
   */
  tasteEvaluation?: import("@/lib/taste/types").TasteEvaluation | null;
  /**
   * Conversion Director evaluation — advisory lead-generation analysis.
   * Referenced by Creative Director; never executes edits in Phase 1.
   */
  conversionDirectorEvaluation?: import("@/lib/conversion/types").ConversionEvaluation | null;
};

/** Deterministic inventory of what the homepage currently contains. */
export type PageSectionInventory = {
  order: WebsiteSectionId[];
  present: Set<WebsiteSectionId>;
  industry: string;
  businessName: string;
  description: string;
  heroHeadline: string;
  heroSubheadline: string;
  primaryCta: string;
  servicesCount: number;
  gallerySlots: number;
  testimonialCount: number;
  faqCount: number;
  hasPricing: boolean;
  hasTeam: boolean;
  hasBookingCta: boolean;
  hasNewsletter: boolean;
  hasHeroImage: boolean;
  /** True when an executable hero composition pattern is active. */
  hasHeroPattern: boolean;
  /** Resolved HeroComposition evaluation (null when no project to resolve). */
  heroCompositionScore: number | null;
  heroImageImpact: number | null;
  heroContentCluster: number | null;
  heroMajorDefect: boolean;
  heroMobileWeak: boolean;
  heroProblems: string[];
  /** Visual Composition Engine — photography preservation 0–100. */
  photographyPreservation: number | null;
  /** Visual Composition Engine — overall composition quality 0–100. */
  visualCompositionScore: number | null;
  /** Recommended content zone id from VisualComposition (advisory). */
  recommendedContentZone: string | null;
  /** Adaptive brand presentation readability score (null when unavailable). */
  brandPresentationScore: number | null;
  brandContrastWeak: boolean;
  /** True when proof (testimonials/gallery) appears before contact in order. */
  proofBeforeAsk: boolean;
  hasAboutCopy: boolean;
  /** Gallery lightbox interaction enabled. */
  galleryLightbox: boolean;
  contactPhone: string;
  contactEmail: string;
  contactLocation: string;
  spacing: string;
  visualHierarchy: boolean;
  buttonStyle: string;
  headingFont: string;
  bodyFont: string;
  designLanguage: string;
  businessTone: string;
  completeness: number;
};
