import type { BusinessType, WebsiteGoal } from "@/types/business";
import type {
  BodyFontId,
  ButtonStyleId,
  HeadingFontId,
  SiteThemeId,
  SiteWidthId,
} from "@/data/design-options";
import type { TemplateId } from "@/lib/templates/types";
import type { GalleryImageIds, MediaAsset } from "@/types/media";
import type { PublishRecord } from "@/types/publishing";
import type { WebsiteService } from "@/types/website-content";

/** Lifecycle of a generated Atlas website project. */
export type ProjectStatus = "draft" | "generating" | "ready" | "published";

/** A single page inside the generated site. */
export type ProjectPage = {
  id: string;
  title: string;
  slug: string;
};

/** Editable contact section for the generated site. */
export type ProjectContact = {
  title: string;
  description: string;
  phone: string;
  email: string;
  location: string;
};

/**
 * Central project model for Atlas.
 * Onboarding, generation, preview, dashboard, and editors all read/write this.
 */
export type BusinessProject = {
  businessName: string;
  businessType: BusinessType | "";
  description: string;
  goals: WebsiteGoal[];
  /** Editable generated homepage headline (source of truth for preview + editor). */
  heroHeadline: string;
  /** Editable generated homepage subheadline. */
  heroSubheadline: string;
  /** Editable primary call-to-action label on the hero. */
  primaryCta: string;
  /** Editable service cards (seeded from the business-type template). */
  services: WebsiteService[];
  /** Editable contact section (title, blurb, phone, email, location). */
  contact: ProjectContact;
  /** Active layout template id (Modern / Elegant / Minimal / Bold). */
  templateId: TemplateId;
  pages: ProjectPage[];
  /** Brand primary color (nav / brand moments). */
  primaryColor: string;
  /** Brand secondary color (surfaces / supporting fills). */
  secondaryColor: string;
  /** Brand accent color (CTAs, links, highlights). */
  accentColor: string;
  /** Site background color (drives canvas / hero wash). */
  backgroundColor: string;
  headingFont: HeadingFontId;
  bodyFont: BodyFontId;
  buttonStyle: ButtonStyleId;
  /** Hero image overlay darkness: 0–100. */
  heroOverlay: number;
  /** Content shell width for the generated site. */
  siteWidth: SiteWidthId;
  /** Legacy contrast preference (Brand Studio derives text from background). */
  theme: SiteThemeId;
  logo: string | null;
  /** Uploaded images in the Media Library (object URLs for local previews). */
  mediaLibrary: MediaAsset[];
  /** Media asset id used as the hero image (null → placeholder). */
  heroImageId: string | null;
  /** Ordered media asset ids used in the gallery (max 4; missing → placeholders). */
  galleryImageIds: GalleryImageIds;
  status: ProjectStatus;
  /**
   * Last successful mock publish (URL + frozen snapshot for the read-only site).
   * Null until the user publishes at least once.
   */
  publish: PublishRecord | null;
};

/** Fields collected during the onboarding wizard. */
export type OnboardingFields = {
  businessName: string;
  businessType: BusinessType | "";
  description: string;
  goals: WebsiteGoal[];
  /** Empty until the user picks a layout style. */
  templateId: TemplateId | "";
};

export const EMPTY_ONBOARDING_FIELDS: OnboardingFields = {
  businessName: "",
  businessType: "",
  description: "",
  goals: [],
  templateId: "",
};

export const DEFAULT_PROJECT_PAGES: ProjectPage[] = [
  { id: "home", title: "Home", slug: "/" },
  { id: "about", title: "About", slug: "/about" },
  { id: "services", title: "Services", slug: "/services" },
  { id: "contact", title: "Contact", slug: "/contact" },
];
