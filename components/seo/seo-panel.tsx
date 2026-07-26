"use client";

import { useMemo } from "react";
import {
  defaultProjectSeo,
  patchSeo,
  resolveProjectSeo,
  sanitizeProjectSeo,
  validateProjectSeo,
  SEO_DESCRIPTION_MAX,
  SEO_TITLE_MAX,
} from "@/lib/seo";
import type { LocalBusinessInfo, ProjectSeo } from "@/lib/seo/types";
import type { BusinessProject } from "@/types/business-project";

type SeoPanelProps = {
  project: BusinessProject;
  onChange: (partial: Partial<BusinessProject>) => void;
};

function GooglePreview({
  title,
  description,
  url,
}: {
  title: string;
  description: string;
  url: string;
}) {
  const displayUrl = url || "https://your-site.example";
  return (
    <div className="rounded-xl border border-border bg-white p-3 text-left shadow-sm">
      <p className="truncate text-xs text-[#202124]">{displayUrl}</p>
      <p className="mt-1 line-clamp-1 text-lg text-[#1a0dab]">{title || "Site title"}</p>
      <p className="mt-1 line-clamp-2 text-sm text-[#4d5156]">
        {description || "Meta description preview"}
      </p>
    </div>
  );
}

function SocialPreview({
  platform,
  title,
  description,
  imageUrl,
  url,
}: {
  platform: "facebook" | "x";
  title: string;
  description: string;
  imageUrl: string | null;
  url: string;
}) {
  const isX = platform === "x";
  return (
    <div
      className={`overflow-hidden rounded-xl border text-left ${
        isX
          ? "border-[#2f3336] bg-black text-white"
          : "border-border bg-[#f0f2f5] text-[#050505]"
      }`}
    >
      <div
        className={`flex h-28 items-center justify-center bg-cover bg-center text-xs ${
          isX ? "bg-[#16181c] text-[#71767b]" : "bg-[#ccd0d5] text-[#65676b]"
        }`}
        style={
          imageUrl
            ? { backgroundImage: `url(${imageUrl})` }
            : undefined
        }
      >
        {imageUrl ? null : "No social image"}
      </div>
      <div className="space-y-1 p-3">
        <p className={`truncate text-[11px] uppercase ${isX ? "text-[#71767b]" : "text-[#65676b]"}`}>
          {(url || "your-site.example").replace(/^https?:\/\//, "")}
        </p>
        <p className="line-clamp-2 text-sm font-semibold">
          {title || "Social share title"}
        </p>
        <p
          className={`line-clamp-2 text-xs ${isX ? "text-[#71767b]" : "text-[#65676b]"}`}
        >
          {description || "Social share description"}
        </p>
      </div>
    </div>
  );
}

/**
 * SEO panel — technical SEO fields, Local Business, and live SERP/social previews.
 */
export default function SeoPanel({ project, onChange }: SeoPanelProps) {
  const seo = useMemo(() => resolveProjectSeo(project), [project]);
  const warnings = useMemo(() => validateProjectSeo(seo), [seo]);

  const socialImageUrl = useMemo(() => {
    if (!seo.socialImageAssetId) return null;
    return (
      project.mediaLibrary.find((a) => a.id === seo.socialImageAssetId)?.url ||
      null
    );
  }, [project.mediaLibrary, seo.socialImageAssetId]);

  const mediaOptions = project.mediaLibrary.filter((a) => !a.unavailable);

  function update(patch: Partial<ProjectSeo>) {
    // Live edits: do not trimEnds (preserves spaces while typing).
    onChange({ seo: patchSeo(project, patch, { trimEnds: false }) });
  }

  function finalizeSeo() {
    onChange({
      seo: sanitizeProjectSeo(resolveProjectSeo(project), { trimEnds: true }),
    });
  }

  function updateLocal(patch: Partial<LocalBusinessInfo>) {
    update({ localBusiness: { ...seo.localBusiness, ...patch } });
  }

  function updateHours(
    index: number,
    patch: Partial<LocalBusinessInfo["openingHours"][number]>,
  ) {
    const openingHours = seo.localBusiness.openingHours.map((row, i) =>
      i === index ? { ...row, ...patch } : row,
    );
    updateLocal({ openingHours });
  }

  const previewUrl =
    seo.canonicalUrl.trim() ||
    project.publish?.url ||
    "https://your-site.example";

  return (
    <aside
      className="flex h-full max-h-[calc(100vh-8rem)] w-full flex-col overflow-hidden rounded-2xl border border-border bg-surface/80 backdrop-blur-xl lg:sticky lg:top-4 lg:rounded-2xl lg:rounded-r-none lg:border-r-0"
      aria-label="SEO"
    >
      <div className="border-b border-border px-4 py-4">
        <h2 className="font-[family-name:var(--font-atlas-display)] text-sm font-semibold text-foreground">
          SEO
        </h2>
        <p className="mt-1 text-xs text-muted">
          Search metadata, social previews, robots, favicon, and Local Business
          schema. Applied on publish.
        </p>
      </div>

      <div className="flex-1 space-y-6 overflow-y-auto p-4">
        {warnings.length > 0 ? (
          <ul className="space-y-1 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
            {warnings.map((w) => (
              <li key={`${w.code}-${w.field}`}>{w.message}</li>
            ))}
          </ul>
        ) : null}

        <section className="space-y-3" aria-labelledby="seo-meta-heading">
          <h3
            id="seo-meta-heading"
            className="text-xs font-medium uppercase tracking-wide text-muted"
          >
            Search metadata
          </h3>
          <label className="block text-xs text-muted">
            Site title
            <input
              type="text"
              value={seo.siteTitle}
              maxLength={120}
              onChange={(e) => update({ siteTitle: e.target.value })}
              onBlur={finalizeSeo}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
            />
            <span className="mt-1 block text-[11px]">
              {seo.siteTitle.length}/{SEO_TITLE_MAX} recommended
            </span>
          </label>
          <label className="block text-xs text-muted">
            Meta description
            <textarea
              value={seo.metaDescription}
              maxLength={320}
              rows={3}
              onChange={(e) => update({ metaDescription: e.target.value })}
              onBlur={finalizeSeo}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
            />
            <span className="mt-1 block text-[11px]">
              {seo.metaDescription.length}/{SEO_DESCRIPTION_MAX} recommended
            </span>
          </label>
          <label className="block text-xs text-muted">
            Canonical URL
            <input
              type="url"
              value={seo.canonicalUrl}
              placeholder="Auto: custom domain or preview URL"
              onChange={(e) => update({ canonicalUrl: e.target.value })}
              onBlur={finalizeSeo}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={seo.robotsIndex}
              onChange={(e) => update({ robotsIndex: e.target.checked })}
            />
            Allow search engines to index this site
          </label>
        </section>

        <section className="space-y-3" aria-labelledby="seo-social-heading">
          <h3
            id="seo-social-heading"
            className="text-xs font-medium uppercase tracking-wide text-muted"
          >
            Social share
          </h3>
          <label className="block text-xs text-muted">
            Social share title
            <input
              type="text"
              value={seo.socialTitle}
              onChange={(e) => update({ socialTitle: e.target.value })}
              onBlur={finalizeSeo}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
            />
          </label>
          <label className="block text-xs text-muted">
            Social share description
            <textarea
              value={seo.socialDescription}
              rows={2}
              onChange={(e) => update({ socialDescription: e.target.value })}
              onBlur={finalizeSeo}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
            />
          </label>
          <label className="block text-xs text-muted">
            Social share image
            <select
              value={seo.socialImageAssetId || ""}
              onChange={(e) =>
                update({ socialImageAssetId: e.target.value || null })
              }
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
            >
              <option value="">None — upload in Media first</option>
              {mediaOptions.map((asset) => (
                <option key={asset.id} value={asset.id}>
                  {asset.title || asset.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs text-muted">
            Favicon
            <select
              value={seo.faviconAssetId || ""}
              onChange={(e) =>
                update({ faviconAssetId: e.target.value || null })
              }
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
            >
              <option value="">None — upload in Media first</option>
              {mediaOptions.map((asset) => (
                <option key={asset.id} value={asset.id}>
                  {asset.title || asset.name}
                </option>
              ))}
            </select>
          </label>
        </section>

        <section className="space-y-3" aria-labelledby="seo-preview-heading">
          <h3
            id="seo-preview-heading"
            className="text-xs font-medium uppercase tracking-wide text-muted"
          >
            Live previews
          </h3>
          <div>
            <p className="mb-2 text-[11px] text-muted">Google search result</p>
            <GooglePreview
              title={seo.siteTitle}
              description={seo.metaDescription}
              url={previewUrl}
            />
          </div>
          <div>
            <p className="mb-2 text-[11px] text-muted">Facebook / LinkedIn</p>
            <SocialPreview
              platform="facebook"
              title={seo.socialTitle}
              description={seo.socialDescription}
              imageUrl={socialImageUrl}
              url={previewUrl}
            />
          </div>
          <div>
            <p className="mb-2 text-[11px] text-muted">X (Twitter)</p>
            <SocialPreview
              platform="x"
              title={seo.socialTitle}
              description={seo.socialDescription}
              imageUrl={socialImageUrl}
              url={previewUrl}
            />
          </div>
        </section>

        <section className="space-y-3" aria-labelledby="seo-local-heading">
          <h3
            id="seo-local-heading"
            className="text-xs font-medium uppercase tracking-wide text-muted"
          >
            Local Business
          </h3>
          <p className="text-[11px] text-muted">
            Used for LocalBusiness JSON-LD on the published site.
          </p>
          {(
            [
              ["name", "Business name"],
              ["phone", "Phone"],
              ["email", "Email"],
              ["streetAddress", "Street address"],
              ["addressLocality", "City"],
              ["addressRegion", "Region / state"],
              ["postalCode", "Postal code"],
              ["addressCountry", "Country"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="block text-xs text-muted">
              {label}
              <input
                type="text"
                value={seo.localBusiness[key]}
                onChange={(e) => updateLocal({ [key]: e.target.value })}
                onBlur={finalizeSeo}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
              />
            </label>
          ))}
          <label className="block text-xs text-muted">
            Logo (for schema)
            <select
              value={seo.localBusiness.logoAssetId || ""}
              onChange={(e) =>
                updateLocal({ logoAssetId: e.target.value || null })
              }
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
            >
              <option value="">None</option>
              {mediaOptions.map((asset) => (
                <option key={asset.id} value={asset.id}>
                  {asset.title || asset.name}
                </option>
              ))}
            </select>
          </label>
          <div className="space-y-2">
            <p className="text-xs text-muted">Opening hours</p>
            {seo.localBusiness.openingHours.map((row, index) => (
              <div
                key={row.day}
                className="grid grid-cols-[5.5rem_1fr_1fr_auto] items-center gap-2 text-xs"
              >
                <span className="text-muted">{row.day.slice(0, 3)}</span>
                <input
                  type="time"
                  value={row.opens}
                  disabled={row.closed}
                  onChange={(e) => updateHours(index, { opens: e.target.value })}
                  className="rounded border border-border bg-background px-1 py-1 text-foreground"
                />
                <input
                  type="time"
                  value={row.closes}
                  disabled={row.closed}
                  onChange={(e) =>
                    updateHours(index, { closes: e.target.value })
                  }
                  className="rounded border border-border bg-background px-1 py-1 text-foreground"
                />
                <label className="flex items-center gap-1 text-muted">
                  <input
                    type="checkbox"
                    checked={Boolean(row.closed)}
                    onChange={(e) =>
                      updateHours(index, { closed: e.target.checked })
                    }
                  />
                  Off
                </label>
              </div>
            ))}
          </div>
        </section>

        <button
          type="button"
          className="text-xs text-accent underline-offset-2 hover:underline"
          onClick={() =>
            onChange({
              seo: sanitizeProjectSeo(defaultProjectSeo(project), {
                trimEnds: true,
              }),
            })
          }
        >
          Reset SEO to defaults from business info
        </button>
      </div>
    </aside>
  );
}
