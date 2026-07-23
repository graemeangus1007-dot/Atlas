/** Onboarding wizard step metadata (UI-only, not part of BusinessProject). */

export const TOTAL_ONBOARDING_STEPS = 6;

export const STEP_LABELS = [
  "Business Name",
  "Business Type",
  "Description",
  "Website Goals",
  "Choose Your Style",
  "Review",
] as const;

export {
  BUSINESS_TYPES,
  WEBSITE_GOALS,
  type BusinessType,
  type WebsiteGoal,
} from "@/types/business";

export {
  EMPTY_ONBOARDING_FIELDS as INITIAL_ONBOARDING_DATA,
  type OnboardingFields as OnboardingData,
} from "@/types/business-project";
