/**
 * Atlas Design System Intelligence contracts (Sprint 27.0A).
 * Translates abstract design intent into concrete website decisions.
 */

import type {
  BodyFontId,
  ButtonStyleId,
  HeadingFontId,
  SiteThemeId,
  SiteWidthId,
} from "@/data/design-options";
import type { EditOperation } from "@/lib/ai/edit-operations";
import type { TemplateId } from "@/lib/templates/types";
import type { BusinessProject } from "@/types/business-project";
import type { BusinessType, WebsiteGoal } from "@/types/business";

/** Built-in design languages Atlas can speak. */
export const DESIGN_LANGUAGE_IDS = [
  "luxury",
  "minimal",
  "modern",
  "corporate",
  "friendly",
  "playful",
  "editorial",
  "industrial",
  "medical",
  "restaurant",
  "trades",
  "creative",
  "premium_saas",
  "photography",
  "scandinavian",
  "boutique",
] as const;

export type DesignLanguageId = (typeof DESIGN_LANGUAGE_IDS)[number];

export type TypographyStrategy = {
  headingFont: HeadingFontId;
  bodyFont: BodyFontId;
  /** Human-readable principle (e.g. “serif headings”). */
  principle: string;
};

export type SpacingStrategy = "compact" | "comfortable" | "generous";
export type BorderRadiusStrategy = "sharp" | "soft" | "rounded" | "pill";
export type ElevationStrategy = "flat" | "subtle" | "lifted" | "dramatic";
export type ColorStrategy = {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  theme: SiteThemeId;
  /** e.g. “muted palette”, “warm colors”, “soft blues”. */
  principle: string;
};

export type ImageryStyle =
  | "large_hero"
  | "food_first"
  | "before_after"
  | "portfolio"
  | "warm_lifestyle"
  | "clinical_clean"
  | "product_focus"
  | "editorial_story"
  | "industrial_texture"
  | "minimal_negative_space";

export type IconStyle = "line" | "filled" | "duotone" | "none";
export type MotionStyle = "none" | "restrained" | "subtle" | "playful" | "cinematic";
export type LayoutDensity = "airy" | "balanced" | "dense";
export type ButtonLanguage =
  | "quiet"
  | "refined"
  | "confident"
  | "bold"
  | "friendly"
  | "urgent";

export type SectionHierarchyItem = {
  id: string;
  emphasis: "primary" | "secondary" | "tertiary";
  reason: string;
};

/**
 * Concrete design decisions for a website.
 * Source of truth for future image gen, motion, icons, layouts, templates.
 */
export type DesignSystem = {
  language: DesignLanguageId;
  label: string;
  typography: TypographyStrategy;
  spacing: SpacingStrategy;
  borderRadius: BorderRadiusStrategy;
  elevation: ElevationStrategy;
  colorStrategy: ColorStrategy;
  imageryStyle: ImageryStyle;
  iconStyle: IconStyle;
  motionStyle: MotionStyle;
  layoutDensity: LayoutDensity;
  buttonLanguage: ButtonLanguage;
  sectionHierarchy: SectionHierarchyItem[];
  /** Template / chrome that realize the language. */
  templateId: TemplateId;
  buttonStyle: ButtonStyleId;
  siteWidth: SiteWidthId;
  heroOverlay: number;
  /** Atlas-facing explanation of why this language was chosen. */
  explanation: string;
  confidence: number;
  selectedAt: string;
};

export type DesignSystemInput = {
  businessType?: BusinessType | "" | string;
  /** Free-text industry / niche (e.g. “dental clinic”). */
  industry?: string;
  goals?: WebsiteGoal[] | string[];
  brandPersonality?: string;
  userGoal?: string;
  memory?: BusinessProject["atlasMemory"];
  /** Optional Creative Director completeness for confidence nudges. */
  creativeCompleteness?: number;
  /** Explicit language override (e.g. user said “make it Scandinavian”). */
  preferredLanguage?: DesignLanguageId | null;
  /** Existing system — prefer sticking unless confidence / override wins. */
  current?: DesignSystem | null;
};

export type DesignSystemResolution = {
  designSystem: DesignSystem;
  /** True when Atlas should apply without asking. */
  autoApply: boolean;
  /** Edit ops that realize the system on the project. */
  operations: EditOperation[];
  /** Keywords that bias Visual Designer asset selection. */
  imageryKeywords: string[];
};

/** Persisted snapshot on BusinessProject (slim + durable). */
export type PersistedDesignSystem = {
  language: DesignLanguageId;
  label: string;
  imageryStyle: ImageryStyle;
  motionStyle: MotionStyle;
  explanation: string;
  confidence: number;
  selectedAt: string;
};
