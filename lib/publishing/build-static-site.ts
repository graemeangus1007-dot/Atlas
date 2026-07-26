import { planStaticSiteAssets } from "@/lib/publishing/assets";
import { createPublishSnapshot } from "@/lib/publishing/create-publish-snapshot";
import { fingerprintFiles } from "@/lib/publishing/fingerprint";
import {
  renderStaticSiteBody,
  renderStaticSiteDocument,
} from "@/lib/publishing/render/html";
import { slugifyBusinessName } from "@/lib/publishing/slugify";
import {
  buildGoogleFontsUrl,
  buildStaticSiteCss,
} from "@/lib/publishing/styles/site-css";
import type {
  BuildStaticSiteOptions,
  PublishArtifact,
  PublishFile,
} from "@/lib/publishing/types";
import { logAnalytics } from "@/lib/analytics/log";
import { renderAnalyticsScript } from "@/lib/analytics/script";
import { getPublishableAtlasOrigin } from "@/lib/app-url";
import { resolveProjectSeo } from "@/lib/seo/defaults";
import {
  renderLocalBusinessJsonLdScript,
} from "@/lib/seo/json-ld";
import { renderSeoHeadTags, resolveSeoMetadata } from "@/lib/seo/meta";
import { buildRobotsTxt } from "@/lib/seo/robots";
import { resolveSeoSiteUrl } from "@/lib/seo/site-url";
import { buildSitemapXml } from "@/lib/seo/sitemap";
import "@/lib/templates";
import { getTemplate } from "@/lib/templates";
import type { BusinessProject } from "@/types/business-project";
import { generateWebsiteContent } from "@/lib/website-generator";

function sortFiles(files: PublishFile[]): PublishFile[] {
  return [...files].sort((a, b) => a.path.localeCompare(b.path));
}

/**
 * Convert a BusinessProject into a deterministic static website artifact.
 *
 * Output always includes:
 * - `index.html` — homepage with SEO head tags + LocalBusiness JSON-LD
 * - `styles.css` — Atlas design-system tokens + responsive layout
 * - `robots.txt`, `sitemap.xml`
 * - `assets/*` — placeholders / uploaded media (incl. favicon / OG when set)
 * - `atlas-manifest.json` — machine-readable asset + template metadata
 *
 * Does not deploy. Same project inputs → same fingerprint and file contents.
 */
export function buildStaticSite(
  project: BusinessProject,
  options: BuildStaticSiteOptions = {},
): PublishArtifact {
  const snapshot = createPublishSnapshot(project);
  const template = getTemplate(snapshot.templateId || "modern");
  const slug =
    options.slug?.trim() || slugifyBusinessName(snapshot.businessName);

  const generated = generateWebsiteContent(snapshot, {
    atlasOrigin: options.atlasOrigin,
  });
  const planned = planStaticSiteAssets(snapshot, generated);
  const bodyHtml = renderStaticSiteBody(planned.content, template);
  const fontsHref = buildGoogleFontsUrl(snapshot);

  const seo = resolveProjectSeo(snapshot);
  const siteUrl =
    options.siteUrl?.trim() ||
    resolveSeoSiteUrl({
      canonicalOverride: seo.canonicalUrl,
      activeCustomHostname: options.activeCustomHostname,
      deploymentPreviewUrl:
        options.deploymentPreviewUrl || snapshot.publish?.deployment?.previewUrl,
    });

  const meta = resolveSeoMetadata(snapshot, {
    activeCustomHostname: options.activeCustomHostname,
    deploymentPreviewUrl:
      options.deploymentPreviewUrl ||
      snapshot.publish?.deployment?.previewUrl ||
      siteUrl,
    faviconHref: planned.faviconHref,
    socialImageUrl: planned.socialImageHref
      ? siteUrl
        ? `${siteUrl.replace(/\/+$/, "")}/${planned.socialImageHref.replace(/^\/+/, "")}`
        : planned.socialImageHref
      : null,
  });

  // Prefer resolved siteUrl for canonical when override empty.
  const metaWithSite = {
    ...meta,
    siteUrl: siteUrl ?? meta.siteUrl,
    canonicalUrl: meta.canonicalUrl ?? (siteUrl ? `${siteUrl.replace(/\/+$/, "")}/` : null),
    ogUrl: meta.ogUrl ?? (siteUrl ? `${siteUrl.replace(/\/+$/, "")}/` : null),
  };

  const seoHeadHtml = renderSeoHeadTags(metaWithSite);
  const jsonLdHtml = renderLocalBusinessJsonLdScript(snapshot, {
    siteUrl: metaWithSite.siteUrl,
    logoUrl: planned.logoHref
      ? siteUrl
        ? `${siteUrl.replace(/\/+$/, "")}/${planned.logoHref.replace(/^\/+/, "")}`
        : planned.logoHref
      : null,
  });

  const atlasOrigin =
    options.atlasOrigin?.trim() || getPublishableAtlasOrigin();
  const analyticsProjectId = options.projectId?.trim() || "";
  const analyticsScriptHtml =
    atlasOrigin && analyticsProjectId
      ? renderAnalyticsScript({
          apiBaseUrl: atlasOrigin,
          projectId: analyticsProjectId,
        })
      : "";

  if (!analyticsScriptHtml) {
    logAnalytics("script_skipped", {
      hasOrigin: Boolean(atlasOrigin),
      hasProjectId: Boolean(analyticsProjectId),
      reason: !atlasOrigin
        ? "missing_APP_URL"
        : !analyticsProjectId
          ? "missing_project_id"
          : "unknown",
    });
  } else {
    logAnalytics("script_injected", {
      projectId: analyticsProjectId,
      originHost: (() => {
        try {
          return new URL(atlasOrigin).host;
        } catch {
          return "invalid";
        }
      })(),
    });
  }

  const indexHtml = renderStaticSiteDocument({
    title: metaWithSite.title,
    description: metaWithSite.description,
    bodyHtml,
    fontsHref,
    seoHeadHtml,
    jsonLdHtml,
    analyticsScriptHtml,
  });
  const stylesCss = buildStaticSiteCss(snapshot);
  const robotsTxt = buildRobotsTxt({
    siteUrl: metaWithSite.siteUrl,
    allowIndexing: seo.robotsIndex,
  });
  // Omit lastmod so fingerprints stay deterministic across publishes.
  const sitemapXml = buildSitemapXml({
    siteUrl: metaWithSite.siteUrl,
  });

  const manifest = {
    version: 1 as const,
    slug,
    templateId: template.id,
    pages: [{ path: "index.html", title: metaWithSite.title }],
    siteUrl: metaWithSite.siteUrl,
    assets: planned.assets.map((asset) => {
      const { source } = asset;
      const durableSource =
        source.type === "external"
          ? {
              type: "external" as const,
              assetId: source.assetId,
              mimeType: source.mimeType,
            }
          : source.type === "storage"
            ? {
                type: "storage" as const,
                storagePath: source.storagePath,
                mimeType: source.mimeType,
              }
            : {
                type: "inline" as const,
                encoding: "utf-8" as const,
              };

      return {
        path: asset.path,
        role: asset.role,
        slot: asset.slot ?? null,
        contentType: asset.contentType,
        source: durableSource,
        alt: asset.alt,
      };
    }),
  };

  const files = sortFiles([
    {
      path: "index.html",
      content: indexHtml,
      contentType: "text/html; charset=utf-8",
    },
    {
      path: "styles.css",
      content: stylesCss,
      contentType: "text/css; charset=utf-8",
    },
    {
      path: "robots.txt",
      content: robotsTxt,
      contentType: "text/plain; charset=utf-8",
    },
    {
      path: "sitemap.xml",
      content: sitemapXml,
      contentType: "application/xml; charset=utf-8",
    },
    {
      path: "atlas-manifest.json",
      content: `${JSON.stringify(manifest, null, 2)}\n`,
      contentType: "application/json; charset=utf-8",
    },
    ...planned.inlineFiles,
  ]);

  return {
    version: 1,
    slug,
    templateId: template.id,
    fingerprint: fingerprintFiles(files),
    files,
    assets: planned.assets,
  };
}
