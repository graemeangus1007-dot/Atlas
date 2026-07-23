import type { ButtonStyleId } from "@/data/design-options";

/** Identifiers for layout templates (not industry content packs). */
export const TEMPLATE_IDS = ["modern", "elegant", "minimal", "bold"] as const;
export type TemplateId = (typeof TEMPLATE_IDS)[number];

export type HeroLayout = "centered" | "split" | "minimal" | "bold-overlay";
export type NavStyle = "standard" | "minimal" | "underline" | "pill";
export type CardStyle = "elevated" | "flat" | "bordered" | "glass";
export type GalleryLayout = "grid-2" | "grid-3" | "masonry" | "wide";
export type FooterLayout = "centered" | "split" | "stacked" | "minimal";

/** Ordered content sections the WebsiteRenderer can assemble. */
export type TemplateSectionId =
  | "hero"
  | "about"
  | "services"
  | "features"
  | "gallery"
  | "contact";

export type TemplateColorDefaults = {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string;
};

/**
 * Declarative website layout template.
 * Section components are shared — only configuration differs per template.
 */
export type WebsiteTemplate = {
  id: TemplateId;
  label: string;
  description: string;
  /** Short label for thumbnail placeholder art. */
  thumbnailLabel: string;
  heroLayout: HeroLayout;
  navStyle: NavStyle;
  sectionOrder: TemplateSectionId[];
  cardStyle: CardStyle;
  buttonStyle: ButtonStyleId;
  galleryLayout: GalleryLayout;
  footerLayout: FooterLayout;
  colorDefaults: TemplateColorDefaults;
};
