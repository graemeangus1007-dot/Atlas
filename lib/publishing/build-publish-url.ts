import { slugifyBusinessName } from "@/lib/publishing/slugify";

const ATLAS_SITE_HOST = "atlas.site";

/**
 * Build the mock public URL for a published Atlas site.
 * Example: https://the-olive-branch.atlas.site
 */
export function buildPublishUrl(businessName: string): {
  slug: string;
  url: string;
} {
  const slug = slugifyBusinessName(businessName);
  return {
    slug,
    url: `https://${slug}.${ATLAS_SITE_HOST}`,
  };
}

/** In-app route that renders the read-only published preview. */
export function buildPublishedSitePath(slug: string): string {
  return `/site/${encodeURIComponent(slug)}`;
}
