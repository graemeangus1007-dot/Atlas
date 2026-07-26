import type {
  ProjectListItem,
  ProjectRow,
} from "@/lib/supabase/types";
import { isBlobUrl, normalizeMediaLibrary } from "@/lib/media";
import type { MediaAsset } from "@/types/media";

/** Re-export for thumbnail consumers. */
export { isBlobUrl } from "@/lib/media";

/**
 * Visual sources for a project card thumbnail.
 * Ordered for future expansion (screenshots, covers, AI, templates).
 */
export type ProjectThumbnailSource = {
  /** Generated / captured website screenshot. */
  screenshotUrl: string | null;
  /** Uploaded cover image (future). */
  coverImageUrl: string | null;
  /**
   * Best available hero image URL.
   * May be a signed http(s) URL (ephemeral) or a session-only blob: URL.
   */
  heroImageUrl: string | null;
  /** Durable private-bucket path for re-signing heroImageUrl. */
  heroStoragePath: string | null;
  /** When heroImageUrl should be refreshed (epoch ms). */
  heroUrlExpiresAt: number | null;
  /** AI-generated or template preview (future). */
  previewUrl: string | null;
  /** Brand accent for placeholder gradients. */
  accentColor: string | null;
  /** True when heroImageUrl is a non-persistent blob: object URL. */
  heroIsBlobUrl: boolean;
};

export const EMPTY_THUMBNAIL_SOURCE: ProjectThumbnailSource = {
  screenshotUrl: null,
  coverImageUrl: null,
  heroImageUrl: null,
  heroStoragePath: null,
  heroUrlExpiresAt: null,
  previewUrl: null,
  accentColor: null,
  heroIsBlobUrl: false,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Parse jsonb that may arrive already parsed or as a JSON string. */
function parseJsonField(value: unknown): unknown {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function asOptionalUrl(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

export function isDurableUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  const lower = url.toLowerCase();
  return (
    lower.startsWith("https://") ||
    lower.startsWith("http://") ||
    lower.startsWith("data:image/")
  );
}

/** Prefer durable http(s)/data URLs over ephemeral blob: URLs. */
function preferUrl(
  ...candidates: Array<string | null | undefined>
): string | null {
  const urls = candidates.filter(
    (value): value is string => typeof value === "string" && value.length > 0,
  );
  return urls.find((url) => isDurableUrl(url)) ?? urls[0] ?? null;
}

function asMediaAssets(value: unknown): MediaAsset[] {
  return normalizeMediaLibrary(parseJsonField(value));
}

function readHeroImageId(content: Record<string, unknown>): string | null {
  if (typeof content.heroImageId === "string" && content.heroImageId) {
    return content.heroImageId;
  }
  if (typeof content.hero_image_id === "string" && content.hero_image_id) {
    return content.hero_image_id;
  }
  return null;
}

/**
 * Resolve hero image URL from Atlas's persisted shape:
 * - content.heroImageUrl (direct / denormalized)
 * - content.heroImageId + media[] asset url
 * - nested content.hero.url (defensive)
 */
function resolveHeroImageUrl(
  content: Record<string, unknown>,
  media: MediaAsset[],
): string | null {
  const direct = preferUrl(
    asOptionalUrl(content.heroImageUrl),
    asOptionalUrl(content.hero_image_url),
    asOptionalUrl(content.heroUrl),
    isRecord(content.hero) ? asOptionalUrl(content.hero.url) : null,
    isRecord(content.generatedWebsite)
      ? asOptionalUrl(content.generatedWebsite.heroImageUrl)
      : null,
  );

  const heroImageId = readHeroImageId(content);
  const heroAsset = heroImageId
    ? media.find((item) => item.id === heroImageId)
    : undefined;
  const fromMedia =
    heroAsset && !heroAsset.unavailable && !isBlobUrl(heroAsset.url)
      ? asOptionalUrl(heroAsset.url)
      : heroAsset && !heroAsset.unavailable
        ? asOptionalUrl(heroAsset.url)
        : null;

  // Prefer durable direct URL, then media asset URL (blob only if still session-valid).
  return preferUrl(direct, fromMedia);
}

function debugThumbnailsEnabled(): boolean {
  return (
    process.env.NODE_ENV === "development" &&
    process.env.NEXT_PUBLIC_DEBUG_THUMBNAILS === "1"
  );
}

/** Extract thumbnail sources from a projects table row (no extra network). */
export function resolveThumbnailSource(row: ProjectRow): ProjectThumbnailSource {
  const contentRaw = parseJsonField(row.content);
  const brandingRaw = parseJsonField(row.branding);
  const content = isRecord(contentRaw) ? contentRaw : {};
  const branding = isRecord(brandingRaw) ? brandingRaw : {};
  const media = asMediaAssets(row.media);

  const heroImageUrl = resolveHeroImageUrl(content, media);
  const heroImageId = readHeroImageId(content);
  const heroAsset = heroImageId
    ? media.find((item) => item.id === heroImageId)
    : undefined;

  const source: ProjectThumbnailSource = {
    screenshotUrl: preferUrl(
      asOptionalUrl(content.screenshotUrl),
      asOptionalUrl(content.previewScreenshotUrl),
    ),
    coverImageUrl: asOptionalUrl(content.coverImageUrl),
    heroImageUrl,
    heroStoragePath: heroAsset?.storagePath ?? null,
    heroUrlExpiresAt: heroAsset?.urlExpiresAt ?? null,
    previewUrl: preferUrl(
      asOptionalUrl(content.aiPreviewUrl),
      asOptionalUrl(content.templatePreviewUrl),
    ),
    accentColor:
      asOptionalUrl(branding.accentColor) ??
      asOptionalUrl(branding.primaryColor),
    heroIsBlobUrl: isBlobUrl(heroImageUrl),
  };

  if (debugThumbnailsEnabled()) {
    console.info("[atlas:thumbnail]", {
      projectId: row.id,
      heroImageId: readHeroImageId(content),
      mediaCount: media.length,
      mediaUrls: media.map((item) => ({
        id: item.id,
        urlKind: isBlobUrl(item.url)
          ? "blob"
          : isDurableUrl(item.url)
            ? "durable"
            : "other",
      })),
      source,
      picked: pickThumbnailImageUrl(source),
    });
  }

  return source;
}

/**
 * Pick the best display URL using product priority:
 * screenshot → cover → hero → AI/template preview → null (use placeholder).
 * Prefers durable URLs when a source somehow has both.
 */
export function pickThumbnailImageUrl(
  source: ProjectThumbnailSource,
): string | null {
  return preferUrl(
    source.screenshotUrl,
    source.coverImageUrl,
    source.heroImageUrl,
    source.previewUrl,
  );
}

export function thumbnailAltText(
  project: Pick<ProjectListItem, "businessName" | "name">,
): string {
  const label = project.businessName.trim() || project.name.trim() || "Project";
  return `Preview of ${label}`;
}

/** @deprecated Use resolveThumbnailSource — kept for sprint naming compatibility. */
export const resolveProjectThumbnail = resolveThumbnailSource;
