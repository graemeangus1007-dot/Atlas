/** SEO + Local Business settings (Sprint 18.0A) — stored in projects.content.seo */

export type OpeningHoursEntry = {
  /** Schema.org day name, e.g. Monday */
  day: string;
  /** HH:mm 24h */
  opens: string;
  /** HH:mm 24h */
  closes: string;
  closed?: boolean;
};

export type LocalBusinessInfo = {
  name: string;
  phone: string;
  email: string;
  streetAddress: string;
  addressLocality: string;
  addressRegion: string;
  postalCode: string;
  addressCountry: string;
  openingHours: OpeningHoursEntry[];
  /** Media library asset id for logo in JSON-LD */
  logoAssetId?: string | null;
};

export type ProjectSeo = {
  siteTitle: string;
  metaDescription: string;
  /** Absolute URL override; empty → auto from custom domain / preview */
  canonicalUrl: string;
  socialTitle: string;
  socialDescription: string;
  /** Media library asset id for og:image / twitter:image */
  socialImageAssetId?: string | null;
  /** When false, emit noindex,nofollow */
  robotsIndex: boolean;
  /** Media library asset id for favicon */
  faviconAssetId?: string | null;
  localBusiness: LocalBusinessInfo;
};

export type SeoWarningCode =
  | "title_too_long"
  | "title_empty"
  | "description_too_short"
  | "description_too_long"
  | "description_empty"
  | "missing_social_image"
  | "invalid_canonical"
  | "duplicate_canonical"
  | "invalid_url";

export type SeoWarning = {
  code: SeoWarningCode;
  field: string;
  message: string;
};

export type ResolvedSeoMetadata = {
  title: string;
  description: string;
  canonicalUrl: string | null;
  robots: string;
  ogTitle: string;
  ogDescription: string;
  ogImageUrl: string | null;
  ogUrl: string | null;
  twitterCard: "summary_large_image" | "summary";
  twitterTitle: string;
  twitterDescription: string;
  twitterImageUrl: string | null;
  faviconHref: string | null;
  siteUrl: string | null;
};

export const SEO_TITLE_MAX = 60;
export const SEO_DESCRIPTION_MIN = 70;
export const SEO_DESCRIPTION_MAX = 160;
