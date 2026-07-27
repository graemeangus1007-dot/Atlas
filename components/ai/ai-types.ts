/** Client-safe AI questionnaire types (Sprint 20.0B). */

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
  "contact",
  "review",
] as const;

export type AiQuestionnaireStepId = (typeof AI_QUESTIONNAIRE_STEPS)[number];

export const AI_STEP_LABELS: Record<AiQuestionnaireStepId, string> = {
  business: "Business",
  services: "Services",
  branding: "Branding",
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
};

export type AiQuestionnaireProgress = {
  version: 1;
  projectId: string;
  stepIndex: number;
  answers: AiQuestionnaireAnswers;
  updatedAt: string;
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
};

export type AiQuestionnaireFieldErrors = Partial<
  Record<keyof AiQuestionnaireAnswers, string>
>;
