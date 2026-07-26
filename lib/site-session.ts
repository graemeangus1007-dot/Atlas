import {
  INITIAL_ONBOARDING_DATA,
  type BusinessType,
  type OnboardingData,
} from "@/components/onboarding/types";

export const SITE_SESSION_KEY = "atlas-site-draft";

/** Fallback when the user opens /preview without completing onboarding. */
export const DEFAULT_SITE_DATA: OnboardingData = {
  businessName: "Riverview Bakery",
  businessType: "Coffee Shop",
  description:
    "Riverview Bakery is a neighborhood coffee shop serving specialty drinks, fresh breakfast, and pastries baked every morning. We care about quality ingredients, friendly service, and a warm place to gather.",
  goals: ["Get more customers", "Accept online orders", "Share information"],
  templateId: "",
};

/**
 * Persist onboarding answers for the generation → preview flow (no backend).
 */
export function saveSiteDraft(data: OnboardingData): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(SITE_SESSION_KEY, JSON.stringify(data));
}

/**
 * Read the draft site collected during onboarding, with safe defaults.
 */
export function loadSiteDraft(): OnboardingData {
  if (typeof window === "undefined") return DEFAULT_SITE_DATA;

  try {
    const raw = window.sessionStorage.getItem(SITE_SESSION_KEY);
    if (!raw) return DEFAULT_SITE_DATA;

    const parsed = JSON.parse(raw) as Partial<OnboardingData>;
    return {
      businessName:
        parsed.businessName?.trim() || DEFAULT_SITE_DATA.businessName,
      businessType:
        (parsed.businessType as BusinessType | "") ||
        DEFAULT_SITE_DATA.businessType,
      description:
        parsed.description?.trim() || DEFAULT_SITE_DATA.description,
      goals: parsed.goals?.length ? parsed.goals : DEFAULT_SITE_DATA.goals,
      templateId: parsed.templateId || DEFAULT_SITE_DATA.templateId,
    };
  } catch {
    return DEFAULT_SITE_DATA;
  }
}
