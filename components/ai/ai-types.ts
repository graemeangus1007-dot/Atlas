/** Client-safe AI questionnaire types (Sprint 20.0B / 20.1). */

import {
  DEFAULT_OPTIONAL_SECTIONS,
  type AiOptionalSectionsState,
} from "@/lib/ai/optional-sections";

export const AI_BRAND_TONES = [
  "professional",
  "friendly",
  "luxury",
  "modern",
  "bold",
] as const;

export type AiBrandTone = (typeof AI_BRAND_TONES)[number];

export const AI_TONE_LABELS: Record<AiBrandTone, string> = {
  professional: "Professional",
  friendly: "Friendly",
  luxury: "Luxury",
  modern: "Modern",
  bold: "Bold",
};

export const AI_QUESTIONNAIRE_STEPS = [
  "business",
  "services",
  "branding",
  "sections",
  "contact",
  "review",
] as const;

export type AiQuestionnaireStepId = (typeof AI_QUESTIONNAIRE_STEPS)[number];

export const AI_STEP_LABELS: Record<AiQuestionnaireStepId, string> = {
  business: "Business",
  services: "Services",
  branding: "Branding",
  sections: "Sections",
  contact: "Contact",
  review: "Review",
};

export type AiQuestionnaireAnswers = {
  businessName: string;
  industry: string;
  oneSentenceDescription: string;
  yearsInBusiness: string;
  primaryServices: string;
  secondaryServices: string;
  targetCustomer: string;
  serviceArea: string;
  tone: AiBrandTone | "";
  primaryColor: string;
  accentColor: string;
  /** Placeholder only — upload lands in a later sprint. */
  logoPlaceholderNote: string;
  phone: string;
  email: string;
  address: string;
  website: string;
  facebook: string;
  instagram: string;
  /** Optional page sections to include in the generated draft. */
  optionalSections: AiOptionalSectionsState;
};

export type AiQuestionnaireProgress = {
  version: 1;
  projectId: string;
  stepIndex: number;
  answers: AiQuestionnaireAnswers;
  updatedAt: string;
  /** Monotonic revision for last-write-wins across tabs. */
  revision: number;
};

export const EMPTY_AI_QUESTIONNAIRE: AiQuestionnaireAnswers = {
  businessName: "",
  industry: "",
  oneSentenceDescription: "",
  yearsInBusiness: "",
  primaryServices: "",
  secondaryServices: "",
  targetCustomer: "",
  serviceArea: "",
  tone: "",
  primaryColor: "#3db8a8",
  accentColor: "#0e1218",
  logoPlaceholderNote: "",
  phone: "",
  email: "",
  address: "",
  website: "",
  facebook: "",
  instagram: "",
  optionalSections: { ...DEFAULT_OPTIONAL_SECTIONS },
};

export type AiQuestionnaireFieldErrors = Partial<
  Record<keyof AiQuestionnaireAnswers, string>
>;

export { DEFAULT_OPTIONAL_SECTIONS };
export type { AiOptionalSectionsState };
