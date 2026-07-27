/**
 * Deterministic AI layout presets from branding tone (Sprint 20.1).
 * Single source for hero/spacing/CTA/typography/button/card/color usage.
 */

import type { AiBrandTone } from "@/components/ai/ai-types";
import { AI_BRAND_TONES } from "@/components/ai/ai-types";
import type {
  BodyFontId,
  ButtonStyleId,
  HeadingFontId,
  SiteThemeId,
  SiteWidthId,
} from "@/data/design-options";
import type {
  CardStyle,
  HeroLayout,
  TemplateId,
} from "@/lib/templates/types";
import { designFromTone } from "@/lib/ai/tone-design";

export type LayoutPresetId = AiBrandTone;

export type SectionSpacing = "compact" | "comfortable" | "spacious";
export type CtaStyle = "subtle" | "balanced" | "prominent";
export type ColorUsage = "restrained" | "warm" | "elegant" | "contemporary" | "high-contrast";

export type AiLayoutPreset = {
  id: LayoutPresetId;
  label: string;
  templateId: TemplateId;
  heroLayout: HeroLayout;
  sectionSpacing: SectionSpacing;
  ctaStyle: CtaStyle;
  headingFont: HeadingFontId;
  bodyFont: BodyFontId;
  buttonStyle: ButtonStyleId;
  cardStyle: CardStyle;
  colorUsage: ColorUsage;
  siteWidth: SiteWidthId;
  theme: SiteThemeId;
  heroOverlay: number;
  secondaryColor: string;
  backgroundColor: string;
};

const LAYOUT_PRESETS: Record<LayoutPresetId, Omit<AiLayoutPreset, "id" | "label">> = {
  professional: {
    templateId: "minimal",
    heroLayout: "minimal",
    sectionSpacing: "comfortable",
    ctaStyle: "subtle",
    headingFont: "inter",
    bodyFont: "inter",
    buttonStyle: "rounded",
    cardStyle: "bordered",
    colorUsage: "restrained",
    siteWidth: "wide",
    theme: "light",
    heroOverlay: 35,
    secondaryColor: "#1a1f26",
    backgroundColor: "#f7f8fa",
  },
  friendly: {
    templateId: "modern",
    heroLayout: "centered",
    sectionSpacing: "comfortable",
    ctaStyle: "balanced",
    headingFont: "manrope",
    bodyFont: "inter",
    buttonStyle: "soft-rounded",
    cardStyle: "elevated",
    colorUsage: "warm",
    siteWidth: "wide",
    theme: "light",
    heroOverlay: 40,
    secondaryColor: "#1e2a24",
    backgroundColor: "#f5f7f4",
  },
  luxury: {
    templateId: "elegant",
    heroLayout: "split",
    sectionSpacing: "spacious",
    ctaStyle: "subtle",
    headingFont: "playfair",
    bodyFont: "lora",
    buttonStyle: "square",
    cardStyle: "flat",
    colorUsage: "elegant",
    siteWidth: "boxed",
    theme: "light",
    heroOverlay: 45,
    secondaryColor: "#161412",
    backgroundColor: "#faf8f5",
  },
  modern: {
    templateId: "modern",
    heroLayout: "split",
    sectionSpacing: "comfortable",
    ctaStyle: "balanced",
    headingFont: "manrope",
    bodyFont: "manrope",
    buttonStyle: "rounded",
    cardStyle: "glass",
    colorUsage: "contemporary",
    siteWidth: "full",
    theme: "dark",
    heroOverlay: 50,
    secondaryColor: "#0e1218",
    backgroundColor: "#07090d",
  },
  bold: {
    templateId: "bold",
    heroLayout: "bold-overlay",
    sectionSpacing: "compact",
    ctaStyle: "prominent",
    headingFont: "poppins",
    bodyFont: "inter",
    buttonStyle: "pill",
    cardStyle: "elevated",
    colorUsage: "high-contrast",
    siteWidth: "wide",
    theme: "dark",
    heroOverlay: 65,
    secondaryColor: "#0a0a0a",
    backgroundColor: "#050505",
  },
};

const PRESET_LABELS: Record<LayoutPresetId, string> = {
  professional: "Professional",
  friendly: "Friendly",
  luxury: "Luxury",
  modern: "Modern",
  bold: "Bold",
};

export function normalizeLayoutPresetId(value: unknown): LayoutPresetId {
  if (typeof value !== "string") return "professional";
  const lowered = value.trim().toLowerCase();
  if ((AI_BRAND_TONES as readonly string[]).includes(lowered)) {
    return lowered as LayoutPresetId;
  }
  return "professional";
}

/** Resolve the full layout preset for a branding tone. */
export function layoutPresetFromTone(tone: unknown): AiLayoutPreset {
  const id = normalizeLayoutPresetId(tone);
  const base = LAYOUT_PRESETS[id];
  // Keep tone-design in sync for legacy callers (template/fonts).
  const legacy = designFromTone(id);
  return {
    id,
    label: PRESET_LABELS[id],
    ...base,
    // Prefer layout-presets as source of truth; legacy used only as safety net.
    templateId: base.templateId || legacy.templateId,
    headingFont: base.headingFont || legacy.headingFont,
    bodyFont: base.bodyFont || legacy.bodyFont,
  };
}

export function allLayoutPresets(): AiLayoutPreset[] {
  return AI_BRAND_TONES.map((tone) => layoutPresetFromTone(tone));
}
