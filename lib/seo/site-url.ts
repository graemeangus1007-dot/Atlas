import { isValidAbsoluteHttpUrl } from "@/lib/seo/validate";
import { resolvePublishSiteUrl } from "@/lib/domains/status";

/**
 * Resolve the public site origin used for canonical, sitemap, and OG url.
 * Prefer explicit SEO canonical override → verified custom domain → preview URL.
 */
export function resolveSeoSiteUrl(input: {
  canonicalOverride?: string | null;
  activeCustomHostname?: string | null;
  deploymentPreviewUrl?: string | null;
}): string | null {
  const override = input.canonicalOverride?.trim() || "";
  if (override && isValidAbsoluteHttpUrl(override)) {
    return override.replace(/\/+$/, "");
  }

  const fromDomain = resolvePublishSiteUrl({
    deploymentPreviewUrl: input.deploymentPreviewUrl || "",
    activeCustomHostname: input.activeCustomHostname,
  }).trim();

  if (fromDomain && isValidAbsoluteHttpUrl(fromDomain)) {
    return fromDomain.replace(/\/+$/, "");
  }

  const preview = input.deploymentPreviewUrl?.trim() || "";
  if (preview && isValidAbsoluteHttpUrl(preview)) {
    return preview.replace(/\/+$/, "");
  }

  return null;
}

export function joinSiteUrl(siteUrl: string | null, path = "/"): string | null {
  if (!siteUrl) return null;
  const base = siteUrl.replace(/\/+$/, "");
  if (path === "/" || path === "") return `${base}/`;
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalized}`;
}
