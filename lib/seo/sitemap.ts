import { escapeHtml } from "@/lib/publishing/escape";
import { joinSiteUrl } from "@/lib/seo/site-url";

/**
 * Generate a minimal sitemap.xml for the published homepage.
 */
export function buildSitemapXml(input: {
  siteUrl: string | null;
  lastmod?: string | null;
}): string {
  const loc = joinSiteUrl(input.siteUrl, "/");
  if (!loc) {
    return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n</urlset>\n`;
  }

  const lastmod = input.lastmod?.trim()
    ? `\n    <lastmod>${escapeHtml(input.lastmod.trim())}</lastmod>`
    : "";

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${escapeHtml(loc)}</loc>${lastmod}
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>
`;
}
