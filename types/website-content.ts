import type { BusinessType } from "@/types/business";

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
  /** Display title shown beneath the image. */
  title: string;
  description: string;
  alt: string;
  /** Legacy/template label fallback (same as title for uploads). */
  label: string;
  tone: string;
  imageUrl: string;
  /** True when using the generated placeholder instead of a library upload. */
  isPlaceholder: boolean;
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
  };
  services: WebsiteService[];
  features: WebsiteFeature[];
  gallery: WebsiteGalleryItem[];
  contact: {
    title: string;
    description: string;
    details: WebsiteContactDetail[];
  };
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
