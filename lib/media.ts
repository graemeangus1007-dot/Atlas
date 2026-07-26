import { ACCEPTED_IMAGE_TYPES } from "@/data/media";
import type { MediaAsset } from "@/types/media";
import { MAX_PROJECT_MEDIA_BYTES } from "@/types/media";

export function isBlobUrl(url: string | null | undefined): boolean {
  return typeof url === "string" && url.toLowerCase().startsWith("blob:");
}

/** Format byte length for the media grid. */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Human-readable title stem from a file name (used as default title/alt). */
export function fileStem(fileName: string): string {
  const stem = fileName
    .replace(/\.[^.]+$/, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return stem || fileName;
}

/** Inline SVG placeholder used when no custom image is assigned. */
export function placeholderImageUrl(
  label: string,
  width = 1200,
  height = 800,
): string {
  const safeLabel = label.replace(/[<>&"']/g, "");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#151b24"/>
      <stop offset="100%" stop-color="#0e1218"/>
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#g)"/>
  <circle cx="${width * 0.72}" cy="${height * 0.28}" r="${Math.min(width, height) * 0.18}" fill="#3db8a8" fill-opacity="0.12"/>
  <text x="50%" y="48%" fill="#9aa3b2" font-family="system-ui,sans-serif" font-size="${Math.round(width * 0.035)}" text-anchor="middle">${safeLabel}</text>
  <text x="50%" y="56%" fill="#667085" font-family="system-ui,sans-serif" font-size="${Math.round(width * 0.022)}" text-anchor="middle">Placeholder</text>
</svg>`;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function createId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `media-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function isAcceptedImageFile(file: File): boolean {
  return ACCEPTED_IMAGE_TYPES.includes(
    file.type as (typeof ACCEPTED_IMAGE_TYPES)[number],
  );
}

export function isFileWithinMediaLimit(file: File): boolean {
  return file.size <= MAX_PROJECT_MEDIA_BYTES;
}

/**
 * Legacy / temporary local preview asset (blob URL).
 * Do not persist blob-only assets as permanent library items.
 */
export function createTemporaryPreviewAsset(file: File): MediaAsset {
  if (!isAcceptedImageFile(file)) {
    throw new Error("Please upload a JPEG, PNG, WebP, or GIF image.");
  }

  const title = fileStem(file.name);

  return {
    id: createId(),
    name: file.name,
    filename: file.name,
    url: URL.createObjectURL(file),
    storagePath: null,
    mimeType: file.type,
    size: file.size,
    sizeLabel: formatFileSize(file.size),
    createdAt: Date.now(),
    title,
    description: "",
    alt: title,
    unavailable: false,
  };
}

/** @deprecated Use createTemporaryPreviewAsset — blob URLs are not durable. */
export function createMediaAssetFromFile(file: File): MediaAsset {
  return createTemporaryPreviewAsset(file);
}

/** Normalize persisted media (marks legacy blob-only records unavailable). */
export function normalizeMediaAsset(raw: unknown): MediaAsset | null {
  if (typeof raw !== "object" || raw === null) return null;
  const item = raw as Partial<MediaAsset> & { url?: string; id?: string };
  if (typeof item.id !== "string") return null;

  const storagePath =
    typeof item.storagePath === "string" && item.storagePath.trim()
      ? item.storagePath.trim()
      : null;
  const url = typeof item.url === "string" ? item.url : "";
  // Durable identity is storagePath; url may be empty until signed on load.
  if (!url && !storagePath) return null;

  const blobOnly = isBlobUrl(url) && !storagePath;
  const name =
    typeof item.name === "string" && item.name.trim()
      ? item.name
      : "image";
  const filename =
    typeof item.filename === "string" && item.filename.trim()
      ? item.filename
      : name;
  const size = typeof item.size === "number" ? item.size : 0;

  return {
    id: item.id,
    name,
    filename,
    url,
    storagePath,
    mimeType: typeof item.mimeType === "string" ? item.mimeType : "image/*",
    size,
    sizeLabel:
      typeof item.sizeLabel === "string" && item.sizeLabel
        ? item.sizeLabel
        : formatFileSize(size),
    createdAt: typeof item.createdAt === "number" ? item.createdAt : Date.now(),
    title: typeof item.title === "string" ? item.title : fileStem(name),
    description: typeof item.description === "string" ? item.description : "",
    alt: typeof item.alt === "string" ? item.alt : fileStem(name),
    urlExpiresAt:
      typeof item.urlExpiresAt === "number" && Number.isFinite(item.urlExpiresAt)
        ? item.urlExpiresAt
        : undefined,
    unavailable: Boolean(item.unavailable || blobOnly),
  };
}

export function normalizeMediaLibrary(raw: unknown): MediaAsset[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => normalizeMediaAsset(item))
    .filter((item): item is MediaAsset => item !== null);
}

/** Patch metadata on one library asset; returns a new array. */
export function updateMediaAssetMeta(
  library: MediaAsset[],
  id: string,
  meta: Partial<Pick<MediaAsset, "title" | "description" | "alt">>,
): MediaAsset[] {
  return library.map((asset) => {
    if (asset.id !== id) return asset;

    return {
      ...asset,
      ...(meta.title !== undefined ? { title: meta.title } : {}),
      ...(meta.description !== undefined
        ? { description: meta.description }
        : {}),
      ...(meta.alt !== undefined ? { alt: meta.alt } : {}),
    };
  });
}

/** Revoke an object URL when an asset is removed or replaced. */
export function revokeMediaUrl(url: string): void {
  if (url.startsWith("blob:")) {
    URL.revokeObjectURL(url);
  }
}

/** Resolve a media asset id to a displayable (preferably durable) URL. */
export function resolveMediaUrl(
  library: MediaAsset[],
  id: string | null | undefined,
): string | null {
  if (!id) return null;
  const asset = library.find((item) => item.id === id);
  if (!asset || asset.unavailable) return null;
  if (isBlobUrl(asset.url) && !asset.storagePath) return null;
  return asset.url;
}
