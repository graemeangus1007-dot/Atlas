/** Brand Studio options stored on BusinessProject. */

export const HEADING_FONTS = [
  { id: "inter", label: "Inter", cssVar: "var(--font-inter)" },
  { id: "poppins", label: "Poppins", cssVar: "var(--font-poppins)" },
  { id: "manrope", label: "Manrope", cssVar: "var(--font-manrope)" },
  {
    id: "playfair",
    label: "Playfair Display",
    cssVar: "var(--font-playfair)",
  },
  { id: "lora", label: "Lora", cssVar: "var(--font-lora)" },
] as const;

export const BODY_FONTS = [
  { id: "inter", label: "Inter", cssVar: "var(--font-inter)" },
  { id: "poppins", label: "Poppins", cssVar: "var(--font-poppins)" },
  { id: "manrope", label: "Manrope", cssVar: "var(--font-manrope)" },
  {
    id: "playfair",
    label: "Playfair Display",
    cssVar: "var(--font-playfair)",
  },
  { id: "lora", label: "Lora", cssVar: "var(--font-lora)" },
] as const;

export type HeadingFontId = (typeof HEADING_FONTS)[number]["id"];
export type BodyFontId = (typeof BODY_FONTS)[number]["id"];

export const BUTTON_STYLES = [
  { id: "rounded", label: "Rounded", radius: "0.75rem" },
  { id: "soft-rounded", label: "Soft Rounded", radius: "1rem" },
  { id: "square", label: "Square", radius: "0" },
  { id: "pill", label: "Pill", radius: "9999px" },
] as const;

export type ButtonStyleId = (typeof BUTTON_STYLES)[number]["id"];

export const HERO_OVERLAY_STEPS = [0, 25, 50, 75, 100] as const;
export type HeroOverlayStep = (typeof HERO_OVERLAY_STEPS)[number];

export const SITE_WIDTHS = [
  { id: "boxed", label: "Boxed", maxWidth: "48rem" },
  { id: "wide", label: "Wide", maxWidth: "72rem" },
  { id: "full", label: "Full Width", maxWidth: "100%" },
] as const;

export type SiteWidthId = (typeof SITE_WIDTHS)[number]["id"];

export const SITE_THEMES = [
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" },
  { id: "auto", label: "Auto" },
] as const;

export type SiteThemeId = (typeof SITE_THEMES)[number]["id"];

export const DEFAULT_BRANDING = {
  primaryColor: "#3db8a8",
  secondaryColor: "#0e1218",
  accentColor: "#3db8a8",
  backgroundColor: "#07090d",
  headingFont: "inter" as HeadingFontId,
  bodyFont: "inter" as BodyFontId,
  buttonStyle: "rounded" as ButtonStyleId,
  heroOverlay: 50 as HeroOverlayStep,
  siteWidth: "wide" as SiteWidthId,
  theme: "dark" as SiteThemeId,
};
