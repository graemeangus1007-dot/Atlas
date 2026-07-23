/** Shared business catalogs used across onboarding, preview, and the project engine. */

export const BUSINESS_TYPES = [
  "Coffee Shop",
  "Restaurant",
  "Retail Store",
  "Salon",
  "Gym",
  "Contractor",
  "Real Estate",
  "Other",
] as const;

export type BusinessType = (typeof BUSINESS_TYPES)[number];

export const WEBSITE_GOALS = [
  "Get more customers",
  "Accept online orders",
  "Book appointments",
  "Display portfolio",
  "Share information",
  "Collect leads",
] as const;

export type WebsiteGoal = (typeof WEBSITE_GOALS)[number];
