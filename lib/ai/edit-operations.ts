/**
 * Atlas AI Design Assistant edit language (Sprint 22.0A).
 * AI emits operations; Atlas applies them. Never arbitrary code or raw JSON merges.
 */

import type {
  BodyFontId,
  ButtonStyleId,
  HeadingFontId,
  HeroOverlayStep,
  SiteThemeId,
  SiteWidthId,
} from "@/data/design-options";
import type { AiOptionalSectionId } from "@/lib/ai/optional-sections";
import type { TemplateId } from "@/lib/templates/types";
import type {
  GeneratedFaqItem,
  GeneratedOptionalSections,
  GeneratedTestimonial,
} from "@/lib/ai/types";

/** Text targets the AI may rewrite via replaceText. */
export const EDIT_TEXT_TARGETS = [
  "hero.eyebrow",
  "hero.title",
  "hero.subheadline",
  "hero.primaryCta",
  "hero.secondaryCta",
  "about.title",
  "about.body",
  "contact.title",
  "contact.description",
  "contact.buttonText",
  "business.name",
  "business.type",
  "business.description",
] as const;

export type EditTextTarget = (typeof EDIT_TEXT_TARGETS)[number];

/** Core sections that cannot be removed. */
export const REQUIRED_SECTION_IDS = [
  "hero",
  "about",
  "services",
  "contact",
] as const;

export type RequiredSectionId = (typeof REQUIRED_SECTION_IDS)[number];

/** Sections insertSection / removeSection may target. */
export const INSERTABLE_SECTION_TYPES = [
  "testimonials",
  "faq",
  "team",
  "gallery",
  "pricing",
  "bookingCta",
  "newsletter",
] as const satisfies readonly AiOptionalSectionId[];

export type InsertableSectionType = (typeof INSERTABLE_SECTION_TYPES)[number];

export const EDIT_OPERATION_KINDS = [
  "replaceText",
  "changeTheme",
  "setButtonStyle",
  "setTypography",
  "setSiteWidth",
  "setTemplate",
  "insertSection",
  "removeSection",
  "updateSeo",
  "rewriteServices",
  "shortenNavigation",
  "replaceColors",
  "updateFaqAnswer",
  "updateFaqQuestion",
  "insertFaq",
  "deleteFaq",
  "setCreativePolish",
  "moveSection",
  "setHeroOverlay",
  "setHeroTreatment",
  "setHeroImagePresentation",
  "applyHeroPattern",
  "setGalleryInteraction",
  "updateGalleryItemMetadata",
  "setComponentSurface",
] as const;

export type EditOperationKind = (typeof EDIT_OPERATION_KINDS)[number];

export type ReplaceTextOperation = {
  operation: "replaceText";
  target: EditTextTarget;
  value: string;
};

export type ChangeThemeOperation = {
  operation: "changeTheme";
  primary?: string;
  secondary?: string;
  accent?: string;
  background?: string;
  theme?: SiteThemeId;
};

export type SetButtonStyleOperation = {
  operation: "setButtonStyle";
  value: ButtonStyleId;
};

export type SetTypographyOperation = {
  operation: "setTypography";
  headingFont?: HeadingFontId;
  bodyFont?: BodyFontId;
};

export type SetSiteWidthOperation = {
  operation: "setSiteWidth";
  value: SiteWidthId;
};

export type SetTemplateOperation = {
  operation: "setTemplate";
  value: TemplateId;
};

export type InsertSectionOperation = {
  operation: "insertSection";
  type: InsertableSectionType;
  /** Optional seed content; Atlas fills defaults when omitted. */
  content?: GeneratedOptionalSections[keyof GeneratedOptionalSections];
};

export type RemoveSectionOperation = {
  operation: "removeSection";
  type: InsertableSectionType;
};

export type UpdateSeoOperation = {
  operation: "updateSeo";
  siteTitle?: string;
  metaDescription?: string;
  socialTitle?: string;
  socialDescription?: string;
  robotsIndex?: boolean;
};

export type RewriteServicesOperation = {
  operation: "rewriteServices";
  services: Array<{ title: string; description: string }>;
};

export type ShortenNavigationOperation = {
  operation: "shortenNavigation";
  /** Max characters per page title (default 12). */
  maxLabelLength?: number;
};

export type ReplaceColorsOperation = {
  operation: "replaceColors";
  /** Color family or hex substring to replace (e.g. "blue", "#2563eb"). */
  from: string;
  /** Replacement hex color. */
  to: string;
};

export type UpdateFaqAnswerOperation = {
  operation: "updateFaqAnswer";
  /** Prefer matchQuestion when the index may shift. */
  index?: number;
  matchQuestion?: string;
  answer: string;
};

export type UpdateFaqQuestionOperation = {
  operation: "updateFaqQuestion";
  index?: number;
  matchQuestion?: string;
  question: string;
};

export type InsertFaqOperation = {
  operation: "insertFaq";
  /** Optional items; defaults are used when omitted. */
  items?: GeneratedFaqItem[];
};

export type DeleteFaqOperation = {
  operation: "deleteFaq";
  index?: number;
  matchQuestion?: string;
};

/** Creative Director polish — icons, motion, hierarchy, spacing, lead form. */
export type SetCreativePolishOperation = {
  operation: "setCreativePolish";
  serviceIcons?: boolean;
  motion?: boolean;
  motionPreset?: "none" | "subtle" | "polished";
  sectionReveal?: boolean;
  hoverEffects?: boolean;
  respectReducedMotion?: boolean;
  visualHierarchy?: boolean;
  spacing?: "default" | "comfortable" | "airy";
  /** When true, ensures the contact lead form is enabled. */
  contactFormEnabled?: boolean;
};

/** Reorder a homepage section (Sprint 28.3). */
export type MoveSectionOperation = {
  operation: "moveSection";
  section: string;
  position: "first" | "last" | "before" | "after";
  relativeTo?: string;
};

/** Hero image overlay darkness 0–100 (Brand Studio steps). */
export type SetHeroOverlayOperation = {
  operation: "setHeroOverlay";
  value: HeroOverlayStep;
};

/** Localized hero contrast treatment (gradient / scrim / text position). */
export type SetHeroTreatmentOperation = {
  operation: "setHeroTreatment";
  gradient?: {
    direction: "left" | "right" | "top" | "bottom";
    strength: number;
    coverage: number;
  } | null;
  textScrim?: {
    enabled: boolean;
    opacity: number;
    blur?: number;
  } | null;
  textPosition?: "left" | "center" | "right";
};

/** Hero image fit / crop / focal presentation. */
export type SetHeroImagePresentationOperation = {
  operation: "setHeroImagePresentation";
  fit?: "cover" | "contain" | "full";
  focalPoint?: { x: number; y: number };
  zoom?: number;
  position?: "center" | "top" | "bottom" | "left" | "right";
};

/**
 * Atomic hero pattern composition (P1).
 * Applies one coordinated HeroComposition + mirrors legacy hero fields.
 */
export type ApplyHeroPatternOperation = {
  operation: "applyHeroPattern";
  patternId:
    | "hero.cinematic_full_width"
    | "hero.coastal_service"
    | "hero.contractor_left"
    | "hero.premium_minimal";
  /** Full planned composition from the planner (preferred). */
  composition?: {
    patternId: string | null;
    version: 1;
    layout: "full_width" | "split" | "contained" | "floating_card";
    legacyLayoutKey?: "centered" | "split" | "minimal" | "bold-overlay";
    minHeight: "short" | "medium" | "tall" | "viewport";
    contentAlignment: "left" | "center" | "right";
    verticalAlignment: "top" | "center" | "bottom";
    contentWidth: "narrow" | "medium" | "wide";
    image: {
      fit: "cover" | "contain";
      position: "center" | "top" | "bottom" | "left" | "right";
      zoom: number;
      focalPoint: { x: number; y: number };
    };
    treatment: {
      overlay: number;
      gradient?: {
        direction: "left" | "right" | "top" | "bottom";
        strength: number;
        coverage: number;
      } | null;
      textScrim?: {
        enabled: boolean;
        opacity: number;
        blur?: number;
      } | null;
    };
    typography: {
      headingScale: "sm" | "md" | "lg" | "xl";
      headingWeight: 400 | 500 | 600 | 700;
      bodyScale: "sm" | "md" | "lg";
      showSecondaryCta: boolean;
    };
    cta: {
      arrangement: "row" | "stack";
      alignment: "left" | "center" | "right";
      primaryEmphasis: "default" | "strong" | "quiet";
    };
    mobile: {
      layout: "stack_copy_first" | "stack_image_first" | "keep_overlay";
      minHeight: "short" | "medium" | "tall" | "viewport";
    };
    accents: {
      showAccentWash: boolean;
      showGrid: boolean;
    };
  };
};

/** Gallery visitor interaction (lightbox). */
export type SetGalleryInteractionOperation = {
  operation: "setGalleryInteraction";
  mode: "none" | "lightbox";
  navigation?: boolean;
  captions?: boolean;
};

/** Update title / caption / alt for a gallery slot asset. */
export type UpdateGalleryItemMetadataOperation = {
  operation: "updateGalleryItemMetadata";
  galleryIndex?: number;
  assetId?: string;
  title?: string;
  caption?: string;
  altText?: string;
  /** When true, clear the visible title (image-only tile). */
  hideTitle?: boolean;
};

/** Scoped surface styling — form fields / panels / cards (not global theme). */
export type SetComponentSurfaceOperation = {
  operation: "setComponentSurface";
  target: "form_fields" | "text_panels" | "cards";
  backgroundColor: string;
  textColor?: string;
  borderColor?: string;
  focusColor?: string;
};

export type EditOperation =
  | ReplaceTextOperation
  | ChangeThemeOperation
  | SetButtonStyleOperation
  | SetTypographyOperation
  | SetSiteWidthOperation
  | SetTemplateOperation
  | InsertSectionOperation
  | RemoveSectionOperation
  | UpdateSeoOperation
  | RewriteServicesOperation
  | ShortenNavigationOperation
  | ReplaceColorsOperation
  | UpdateFaqAnswerOperation
  | UpdateFaqQuestionOperation
  | InsertFaqOperation
  | DeleteFaqOperation
  | SetCreativePolishOperation
  | MoveSectionOperation
  | SetHeroOverlayOperation
  | SetHeroTreatmentOperation
  | SetHeroImagePresentationOperation
  | ApplyHeroPatternOperation
  | SetGalleryInteractionOperation
  | UpdateGalleryItemMetadataOperation
  | SetComponentSurfaceOperation;

/** Human-readable bullet for the post-edit preview list. */
export type EditChangeSummary = {
  id: string;
  label: string;
  ok: true;
};

/** Design sections stored on BusinessProject (persisted in content JSON). */
export type ProjectDesignSections = {
  enabled: InsertableSectionType[];
  testimonials?: GeneratedTestimonial[];
  faq?: GeneratedFaqItem[];
  team?: GeneratedOptionalSections["team"];
  pricing?: GeneratedOptionalSections["pricing"];
  bookingCta?: GeneratedOptionalSections["bookingCta"];
  newsletter?: GeneratedOptionalSections["newsletter"];
};

export function isEditOperationKind(value: unknown): value is EditOperationKind {
  return (
    typeof value === "string" &&
    (EDIT_OPERATION_KINDS as readonly string[]).includes(value)
  );
}

export function isEditTextTarget(value: unknown): value is EditTextTarget {
  return (
    typeof value === "string" &&
    (EDIT_TEXT_TARGETS as readonly string[]).includes(value)
  );
}

export function isInsertableSectionType(
  value: unknown,
): value is InsertableSectionType {
  return (
    typeof value === "string" &&
    (INSERTABLE_SECTION_TYPES as readonly string[]).includes(value)
  );
}

export function isRequiredSectionId(value: unknown): value is RequiredSectionId {
  return (
    typeof value === "string" &&
    (REQUIRED_SECTION_IDS as readonly string[]).includes(value)
  );
}
