"use client";

import { memo, useEffect, useMemo, useState } from "react";
import { useSignedMediaUrl } from "@/hooks/use-signed-media-url";
import { getBusinessInitials } from "@/lib/project";
import { isBlobUrl } from "@/lib/media";
import {
  pickThumbnailImageUrl,
  thumbnailAltText,
  type ProjectThumbnailSource,
} from "@/lib/project-thumbnail";

export type ProjectThumbnailProps = {
  businessName: string;
  businessType?: string;
  projectName?: string;
  /** Generated website screenshot (highest priority). */
  screenshotUrl?: string | null;
  /** Uploaded cover image (future). */
  coverImageUrl?: string | null;
  /** Hero media URL. */
  heroImageUrl?: string | null;
  /** Durable storage path for private hero media (re-signs as needed). */
  heroStoragePath?: string | null;
  /** When the current hero signed URL should refresh. */
  heroUrlExpiresAt?: number | null;
  /** AI-generated or template preview (future). */
  previewUrl?: string | null;
  /** Optional brand accent for the placeholder gradient. */
  accentColor?: string | null;
  /** Pass a pre-resolved source object instead of individual URLs. */
  source?: ProjectThumbnailSource;
  className?: string;
  /** sizes hint for responsive images (future CDN). */
  sizes?: string;
};

type DisplayMode = "image" | "placeholder";

/**
 * Reusable project visual preview.
 * Priority: screenshot → cover → hero → AI/template preview → branded placeholder.
 * Private hero media is kept fresh via signed URLs.
 */
function ProjectThumbnail({
  businessName,
  businessType = "",
  projectName = "",
  screenshotUrl = null,
  coverImageUrl = null,
  heroImageUrl = null,
  heroStoragePath = null,
  heroUrlExpiresAt = null,
  previewUrl = null,
  accentColor = null,
  source,
  className = "",
  sizes = "(max-width: 640px) 100vw, 180px",
}: ProjectThumbnailProps) {
  const resolvedSource = useMemo<ProjectThumbnailSource>(
    () =>
      source ?? {
        screenshotUrl,
        coverImageUrl,
        heroImageUrl,
        heroStoragePath,
        heroUrlExpiresAt,
        previewUrl,
        accentColor,
        heroIsBlobUrl: isBlobUrl(heroImageUrl),
      },
    [
      source,
      screenshotUrl,
      coverImageUrl,
      heroImageUrl,
      heroStoragePath,
      heroUrlExpiresAt,
      previewUrl,
      accentColor,
    ],
  );

  const signedHeroUrl = useSignedMediaUrl({
    storagePath: resolvedSource.heroStoragePath,
    url: resolvedSource.heroImageUrl,
    urlExpiresAt: resolvedSource.heroUrlExpiresAt,
  });

  const sourceWithFreshHero = useMemo<ProjectThumbnailSource>(
    () => ({
      ...resolvedSource,
      heroImageUrl: signedHeroUrl ?? resolvedSource.heroImageUrl,
      heroIsBlobUrl: isBlobUrl(signedHeroUrl ?? resolvedSource.heroImageUrl),
    }),
    [resolvedSource, signedHeroUrl],
  );

  const preferredUrl = pickThumbnailImageUrl(sourceWithFreshHero);
  const [mode, setMode] = useState<DisplayMode>(
    preferredUrl ? "image" : "placeholder",
  );
  const [imageUrl, setImageUrl] = useState<string | null>(preferredUrl);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    setImageUrl(preferredUrl);
    setMode(preferredUrl ? "image" : "placeholder");
    setIsLoaded(false);
  }, [preferredUrl]);

  const initials = getBusinessInitials(businessName || projectName || "Atlas");
  const typeLabel = businessType.trim() || "Website";
  const alt = thumbnailAltText({
    businessName: businessName || projectName,
    name: projectName || businessName,
  });
  const accent = sourceWithFreshHero.accentColor || "var(--accent)";

  return (
    <div
      className={`relative aspect-[16/10] w-full overflow-hidden rounded-xl border border-border/80 bg-surface ${className}`}
    >
      {/* Reserved aspect box prevents layout shift while images load. */}
      {mode === "image" && !isLoaded ? (
        <div
          className="absolute inset-0 animate-pulse bg-gradient-to-br from-white/[0.06] via-white/[0.02] to-transparent"
          aria-hidden="true"
        />
      ) : null}

      {mode === "image" && imageUrl ? (
        <img
          src={imageUrl}
          alt={alt}
          loading="lazy"
          decoding="async"
          sizes={sizes}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${
            isLoaded ? "opacity-100" : "opacity-0"
          }`}
          onLoad={() => setIsLoaded(true)}
          onError={() => {
            setMode("placeholder");
            setIsLoaded(false);
            setImageUrl(null);
          }}
        />
      ) : (
        <div
          className="absolute inset-0 flex flex-col justify-between p-3 sm:p-3.5"
          style={{
            background: `linear-gradient(145deg, color-mix(in srgb, ${accent} 28%, #0e1218) 0%, #0e1218 48%, color-mix(in srgb, ${accent} 16%, #07090d) 100%)`,
          }}
          role="img"
          aria-label={alt}
        >
          <div
            className="pointer-events-none absolute -right-6 -top-8 h-28 w-28 rounded-full opacity-40 blur-2xl"
            style={{ background: accent }}
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute -bottom-10 left-4 h-24 w-24 rounded-full opacity-25 blur-2xl"
            style={{ background: accent }}
            aria-hidden="true"
          />

          <div className="relative">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-black/20 text-xs font-semibold tracking-wide text-foreground backdrop-blur-sm">
              {initials}
            </span>
          </div>

          <div className="relative space-y-1">
            <p className="truncate text-sm font-medium text-foreground">
              {businessName.trim() || projectName.trim() || "Untitled"}
            </p>
            <p className="truncate text-[11px] uppercase tracking-[0.14em] text-muted">
              {typeLabel}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default memo(ProjectThumbnail);
