/**
 * Deterministic branding-tone → layout/design defaults (Sprint 20.0C).
 * Centralized for tests — do not scatter tone switches in UI.
 */

import type {
  BodyFontId,
  ButtonStyleId,
  HeadingFontId,
  SiteThemeId,
  SiteWidthId,
} from "@/data/design-options";
import type { TemplateId } from "@/lib/templates/types";
import type { AiBrandTone } from "@/components/ai/ai-types";
import { AI_BRAND_TONES } from "@/components/ai/ai-types";

export type ToneDesignDefaults = {
  tone: AiBrandTone;
  templateId: TemplateId;
  headingFont: HeadingFontId;
  bodyFont: BodyFontId;
  buttonStyle: ButtonStyleId;
  siteWidth: SiteWidthId;
  theme: SiteThemeId;
  heroOverlay: number;
  /** Atmosphere colors when questionnaire omits brand colors. */
  secondaryColor: string;
  backgroundColor: string;
};

const TONE_DESIGN: Record<AiBrandTone, Omit<ToneDesignDefaults, "tone">> = {
  /** Clean, restrained layout */
  professional: {
    templateId: "minimal",
    headingFont: "inter",
    bodyFont: "inter",
    buttonStyle: "rounded",
    siteWidth: "wide",
    theme: "light",
    heroOverlay: 35,
    secondaryColor: "#1a1f26",
    backgroundColor: "#f7f8fa",
  },
  /** Warmer, approachable layout */
  friendly: {
    templateId: "modern",
    headingFont: "manrope",
    bodyFont: "inter",
    buttonStyle: "soft-rounded",
    siteWidth: "wide",
    theme: "light",
    heroOverlay: 40,
    secondaryColor: "#1e2a24",
    backgroundColor: "#f5f7f4",
  },
  /** Elegant typography and spacious layout */
  luxury: {
    templateId: "elegant",
    headingFont: "playfair",
    bodyFont: "lora",
    buttonStyle: "square",
    siteWidth: "boxed",
    theme: "light",
    heroOverlay: 45,
    secondaryColor: "#161412",
    backgroundColor: "#faf8f5",
  },
  /** Contemporary layout */
  modern: {
    templateId: "modern",
    headingFont: "manrope",
    bodyFont: "manrope",
    buttonStyle: "rounded",
    siteWidth: "full",
    theme: "dark",
    heroOverlay: 50,
    secondaryColor: "#0e1218",
    backgroundColor: "#07090d",
  },
  /** Stronger contrast and prominent CTAs */
  bold: {
    templateId: "bold",
    headingFont: "poppins",
    bodyFont: "inter",
    buttonStyle: "pill",
    siteWidth: "wide",
    theme: "dark",
    heroOverlay: 65,
    secondaryColor: "#0a0a0a",
    backgroundColor: "#050505",
  },
};

export function normalizeBrandTone(value: unknown): AiBrandTone {
  if (typeof value !== "string") return "professional";
  const lowered = value.trim().toLowerCase();
  if ((AI_BRAND_TONES as readonly string[]).includes(lowered)) {
    return lowered as AiBrandTone;
  }
  return "professional";
}

/** Resolve layout + typography defaults from branding tone. */
export function designFromTone(tone: unknown): ToneDesignDefaults {
  const resolved = normalizeBrandTone(tone);
  return { tone: resolved, ...TONE_DESIGN[resolved] };
}

/** All tones → design map (stable order for exhaustive tests). */
export function allToneDesigns(): ToneDesignDefaults[] {
  return AI_BRAND_TONES.map((tone) => designFromTone(tone));
}
