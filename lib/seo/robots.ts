import { joinSiteUrl } from "@/lib/seo/site-url";

/**
 * Generate robots.txt. When indexing is disabled, disallow all crawlers.
 */
export function buildRobotsTxt(input: {
  siteUrl: string | null;
  allowIndexing: boolean;
}): string {
  if (!input.allowIndexing) {
    return ["User-agent: *", "Disallow: /", ""].join("\n");
  }

  // Relative sitemap path works on custom domain and preview hosts alike.
  // Absolute Sitemap is also included when a public origin is known.
  const lines = ["User-agent: *", "Allow: /", "Sitemap: /sitemap.xml"];
  const absoluteSitemap = joinSiteUrl(input.siteUrl, "/sitemap.xml");
  if (absoluteSitemap && absoluteSitemap !== "/sitemap.xml") {
    lines.push(`Sitemap: ${absoluteSitemap}`);
  }
  lines.push("");
  return lines.join("\n");
}
