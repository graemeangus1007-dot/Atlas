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
import type { ProjectSeo } from "@/lib/seo/types";
import type { PublishRecord } from "@/types/publishing";
import type { DesignAssistantPersistedMeta } from "@/lib/ai/editor-assistant-types";
import type {
  ProjectDesignSections,
} from "@/lib/ai/edit-operations";
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
  /** Atlas lead_forms.id — wired automatically; not edited by hand. */
  formId?: string | null;
  /** Submit button label on the public contact form. */
  buttonText?: string;
  /** Shown after a successful submission. */
  successMessage?: string;
  /** @deprecated Use buttonText — kept for reading older saved projects. */
  formButtonText?: string;
  /** @deprecated Use successMessage — kept for reading older saved projects. */
  formSuccessMessage?: string;
  /** Include phone field on the public form. */
  showPhoneField?: boolean;
  /** Include company field on the public form. */
  showCompanyField?: boolean;
  /** When false, published site shows details only (no form). Default true. */
  formEnabled?: boolean;
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
  /** Optional hero eyebrow (AI drafts / older projects may omit). */
  heroEyebrow?: string;
  /** Editable generated homepage headline (source of truth for preview + editor). */
  heroHeadline: string;
  /** Editable generated homepage subheadline. */
  heroSubheadline: string;
  /** Editable primary call-to-action label on the hero. */
  primaryCta: string;
  /** Optional secondary hero CTA (AI drafts / older projects may omit). */
  secondaryCta?: string;
  /** Optional about section heading override. */
  aboutTitle?: string;
  /** Editable service cards (seeded from the business-type template). */
  services: WebsiteService[];
  /** Editable contact section (title, blurb, phone, email, location). */
  contact: ProjectContact;
  /**
   * Technical SEO + Local Business schema settings (content.seo).
   * Optional for older projects — resolved via defaults at publish time.
   */
  seo?: ProjectSeo;
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
  /**
   * Optional section image assignments (asset ids) for About / Services / etc.
   * Sprint 24.0A Visual Designer.
   */
  sectionImages?: Partial<Record<string, string | null>>;
  /**
   * Optional homepage section order override (template + design sections).
   * When omitted, the active template order is used.
   */
  sectionOrder?: string[];
  /** Durable logo media asset id (null → text brand / no logo image). */
  logoAssetId?: string | null;
  status: ProjectStatus;
  /**
   * Last successful publish (preview URL + frozen snapshot + slim deployment).
   * Null until the user publishes at least once.
   * Never stores generated HTML/CSS file bodies.
   */
  publish: PublishRecord | null;
  /**
   * Optional AI design sections (testimonials, FAQ, …) managed by the Design Assistant.
   * Persisted in content JSON; omitted on older projects.
   */
  designSections?: ProjectDesignSections;
  /**
   * Creative Director polish flags (icons, motion, hierarchy, spacing).
   * Sprint 25.0A — applied via setCreativePolish operations.
   */
  creativePolish?: {
    serviceIcons?: boolean;
    motion?: boolean;
    visualHierarchy?: boolean;
    spacing?: "default" | "comfortable" | "airy";
  };
  /**
   * Atlas Brain durable preferences (layout, tone, goals, imagery).
   * Sprint 26.0A — updated every conversation turn.
   */
  atlasMemory?: {
    preferredLayouts?: string[];
    preferredThemes?: string[];
    primaryGoal?: string;
    businessTone?: string;
    imageStyle?: string;
    notes?: string[];
    updatedAt?: string;
  };
  /**
   * Active Design System language (Sprint 27.0A).
   * Source of truth for typography, color, imagery, motion, hierarchy.
   */
  designSystem?: {
    language: string;
    label: string;
    imageryStyle: string;
    motionStyle: string;
    explanation: string;
    confidence: number;
    selectedAt: string;
  };
  /**
   * Design Assistant conversation + slim revision metadata (Sprint 22.0A).
   * Restored on refresh via autosave; full undo snapshots live in localStorage.
   */
  designAssistant?: DesignAssistantPersistedMeta;
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
