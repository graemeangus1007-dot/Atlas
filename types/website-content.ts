import type { BusinessType } from "@/types/business";
import type { GalleryInteraction } from "@/types/gallery";

/** A service card shown on the generated site. */
export type WebsiteService = {
  title: string;
  description: string;
};

/** A feature highlight card shown on the generated site. */
export type WebsiteFeature = {
  title: string;
  description: string;
};

/** A gallery tile — image URL may be a upload or a generated placeholder. */
export type WebsiteGalleryItem = {
  id: string;
  /** Media library asset id when this slot uses an upload; null for placeholders. */
  assetId: string | null;
  /** Display title shown beneath the image (empty = image-only tile). */
  title: string;
  description: string;
  alt: string;
  /** Legacy/template label fallback (same as title for uploads). */
  label: string;
  tone: string;
  imageUrl: string;
  /** True when using the generated placeholder instead of a library upload. */
  isPlaceholder: boolean;
  /** When false, public surfaces hide the title row. */
  showTitle?: boolean;
};

/** Contact row on the generated site. */
export type WebsiteContactDetail = {
  label: string;
  value: string;
};

/**
 * Fully resolved website copy + visuals for the preview experience.
 * Produced by `generateWebsiteContent` — never hardcoded in React components.
 */
export type GeneratedWebsiteContent = {
  businessName: string;
  businessType: BusinessType;
  accentColor: string;
  hero: {
    eyebrow: string;
    headline: string;
    subheadline: string;
    primaryCta: string;
    secondaryCta: string;
    imageUrl: string;
    isPlaceholder: boolean;
  };
  about: {
    title: string;
    description: string;
    /** Optional section image (Visual Designer). */
    imageUrl?: string | null;
    isPlaceholder?: boolean;
  };
  services: WebsiteService[];
  features: WebsiteFeature[];
  gallery: WebsiteGalleryItem[];
  contact: {
    title: string;
    description: string;
    details: WebsiteContactDetail[];
    /** Public form configuration for published sites. */
    form: {
      enabled: boolean;
      formId: string | null;
      buttonText: string;
      successMessage: string;
      showPhoneField: boolean;
      showCompanyField: boolean;
      /** Absolute Atlas origin for POST /api/forms/:id/submit */
      apiBaseUrl: string;
    };
  };
  /** Optional Design Assistant sections (testimonials, FAQ, …). */
  designSections?: {
    enabled: string[];
    testimonials?: Array<{ quote: string; author: string; role: string }>;
    faq?: Array<{ question: string; answer: string }>;
    team?: Array<{ name: string; role: string; bio: string }>;
    pricing?: Array<{
      name: string;
      price: string;
      description: string;
      features: string[];
    }>;
    bookingCta?: { title: string; body: string; buttonText: string };
    newsletter?: { title: string; body: string; buttonText: string };
  };
  /** Optional homepage section order override (Visual Designer). */
  sectionOrder?: string[];
  /** Resolved logo URL for navigation. */
  logoUrl?: string | null;
  /** Creative Director polish flags for preview/publish rendering. */
  creativePolish?: {
    serviceIcons?: boolean;
    motion?: boolean;
    motionPreset?: "none" | "subtle" | "polished";
    sectionReveal?: boolean;
    hoverEffects?: boolean;
    respectReducedMotion?: boolean;
    visualHierarchy?: boolean;
    spacing?: "default" | "comfortable" | "airy";
  };
  /** Gallery visitor interaction (fullscreen lightbox). */
  galleryInteraction?: GalleryInteraction;
};

/** Type-specific template pieces before business name / description are applied. */
export type BusinessTypeTemplate = {
  accentColor: string;
  headline: string;
  subheadline: string;
  primaryCta: string;
  secondaryCta: string;
  aboutTitle: string;
  services: WebsiteService[];
  features: WebsiteFeature[];
  galleryLabels: [string, string, string, string];
  contactDescription: string;
};
