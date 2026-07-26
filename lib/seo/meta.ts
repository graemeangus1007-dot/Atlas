import { escapeAttr, escapeHtml } from "@/lib/publishing/escape";
import { resolveProjectSeo } from "@/lib/seo/defaults";
import { joinSiteUrl, resolveSeoSiteUrl } from "@/lib/seo/site-url";
import type { ResolvedSeoMetadata } from "@/lib/seo/types";
import type { BusinessProject } from "@/types/business-project";

export function resolveSeoMetadata(
  project: BusinessProject,
  options: {
    activeCustomHostname?: string | null;
    deploymentPreviewUrl?: string | null;
    /** Relative or absolute favicon href for the published site */
    faviconHref?: string | null;
    /** Absolute or site-relative social image URL */
    socialImageUrl?: string | null;
  } = {},
): ResolvedSeoMetadata {
  const seo = resolveProjectSeo(project);
  const siteUrl = resolveSeoSiteUrl({
    canonicalOverride: seo.canonicalUrl,
    activeCustomHostname: options.activeCustomHostname,
    deploymentPreviewUrl: options.deploymentPreviewUrl,
  });
  const canonicalUrl = siteUrl ? joinSiteUrl(siteUrl, "/") : null;

  let ogImage = options.socialImageUrl?.trim() || null;
  if (ogImage && siteUrl && ogImage.startsWith("/")) {
    ogImage = `${siteUrl.replace(/\/+$/, "")}${ogImage}`;
  } else if (ogImage && siteUrl && !ogImage.startsWith("http")) {
    ogImage = `${siteUrl.replace(/\/+$/, "")}/${ogImage.replace(/^\/+/, "")}`;
  }

  const title = seo.siteTitle.trim() || project.businessName || "Website";
  const description =
    seo.metaDescription.trim() || project.description.trim() || title;
  const socialTitle = seo.socialTitle.trim() || title;
  const socialDescription = seo.socialDescription.trim() || description;

  return {
    title,
    description,
    canonicalUrl,
    robots: seo.robotsIndex ? "index, follow" : "noindex, nofollow",
    ogTitle: socialTitle,
    ogDescription: socialDescription,
    ogImageUrl: ogImage,
    ogUrl: canonicalUrl,
    twitterCard: ogImage ? "summary_large_image" : "summary",
    twitterTitle: socialTitle,
    twitterDescription: socialDescription,
    twitterImageUrl: ogImage,
    faviconHref: options.faviconHref ?? null,
    siteUrl,
  };
}

/** Render <head> SEO tags (escaped). Does not include charset/viewport/fonts. */
export function renderSeoHeadTags(meta: ResolvedSeoMetadata): string {
  const lines: string[] = [
    `<title>${escapeHtml(meta.title)}</title>`,
    `<meta name="description" content="${escapeAttr(meta.description)}" />`,
    `<meta name="robots" content="${escapeAttr(meta.robots)}" />`,
  ];

  if (meta.canonicalUrl) {
    lines.push(
      `<link rel="canonical" href="${escapeAttr(meta.canonicalUrl)}" />`,
    );
  }

  lines.push(
    `<meta property="og:type" content="website" />`,
    `<meta property="og:title" content="${escapeAttr(meta.ogTitle)}" />`,
    `<meta property="og:description" content="${escapeAttr(meta.ogDescription)}" />`,
  );
  if (meta.ogUrl) {
    lines.push(`<meta property="og:url" content="${escapeAttr(meta.ogUrl)}" />`);
  }
  if (meta.ogImageUrl) {
    lines.push(
      `<meta property="og:image" content="${escapeAttr(meta.ogImageUrl)}" />`,
    );
  }

  lines.push(
    `<meta name="twitter:card" content="${escapeAttr(meta.twitterCard)}" />`,
    `<meta name="twitter:title" content="${escapeAttr(meta.twitterTitle)}" />`,
    `<meta name="twitter:description" content="${escapeAttr(meta.twitterDescription)}" />`,
  );
  if (meta.twitterImageUrl) {
    lines.push(
      `<meta name="twitter:image" content="${escapeAttr(meta.twitterImageUrl)}" />`,
    );
  }

  if (meta.faviconHref) {
    lines.push(
      `<link rel="icon" href="${escapeAttr(meta.faviconHref)}" />`,
    );
  }

  return lines.map((line) => `  ${line}`).join("\n");
}
