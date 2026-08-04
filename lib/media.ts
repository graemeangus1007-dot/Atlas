import { ACCEPTED_IMAGE_TYPES } from "@/data/media";
import {
  deriveAltText,
  deriveDisplayTitle,
  normalizeOpaqueMediaMetadata,
} from "@/lib/media-titles";
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

/**
 * Human-readable title stem from a file name.
 * Prefer `deriveDisplayTitle` for gallery-visible labels.
 */
export function fileStem(fileName: string): string {
  const stem = fileName
    .replace(/\.[^.]+$/, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return stem || fileName;
}

export {
  deriveAltText,
  deriveDisplayTitle,
  isOpaqueMediaLabel,
  normalizeOpaqueMediaMetadata,
  publicGalleryTitle,
  photoIndexTitle,
} from "@/lib/media-titles";

/**
 * Decorative SVG placeholder when no custom image is assigned.
 * Intentionally text-free so labels never collide with real hero/gallery copy.
 */
export function placeholderImageUrl(
  _label: string,
  width = 1200,
  height = 800,
): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-hidden="true">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#151b24"/>
      <stop offset="100%" stop-color="#0e1218"/>
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#g)"/>
  <circle cx="${width * 0.72}" cy="${height * 0.28}" r="${Math.min(width, height) * 0.18}" fill="#3db8a8" fill-opacity="0.12"/>
  <circle cx="${width * 0.22}" cy="${height * 0.78}" r="${Math.min(width, height) * 0.12}" fill="#3db8a8" fill-opacity="0.06"/>
</svg>`;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/** True when a URL is our generated empty-slot placeholder (not uploaded media). */
export function isPlaceholderImageUrl(url: string | null | undefined): boolean {
  if (!url) return true;
  return url.startsWith("data:image/svg+xml");
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
export function createTemporaryPreviewAsset(
  file: File,
  index = 0,
): MediaAsset {
  if (!isAcceptedImageFile(file)) {
    throw new Error("Please upload a JPEG, PNG, WebP, or GIF image.");
  }

  const title = deriveDisplayTitle(file.name, index);
  const alt = deriveAltText(title, file.name, index);

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
    alt,
    unavailable: false,
  };
}

/** @deprecated Use createTemporaryPreviewAsset — blob URLs are not durable. */
export function createMediaAssetFromFile(file: File): MediaAsset {
  return createTemporaryPreviewAsset(file);
}

/**
 * Local preview upload with progress ticks (legacy media panel / demos).
 * Prefer `uploadProjectMedia` for durable storage.
 */
export async function mockUploadImage(
  file: File,
  onProgress?: (progress: number) => void,
): Promise<MediaAsset> {
  if (!isFileWithinMediaLimit(file)) {
    throw new Error("Image must be 5 MB or smaller.");
  }

  for (const step of [15, 40, 70, 100]) {
    onProgress?.(step);
    await new Promise((resolve) => {
      window.setTimeout(resolve, 40);
    });
  }

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
    title:
      typeof item.title === "string"
        ? item.title
        : deriveDisplayTitle(name, 0),
    description: typeof item.description === "string" ? item.description : "",
    alt:
      typeof item.alt === "string"
        ? item.alt
        : deriveAltText(
            typeof item.title === "string" ? item.title : null,
            name,
            0,
          ),
    urlExpiresAt:
      typeof item.urlExpiresAt === "number" && Number.isFinite(item.urlExpiresAt)
        ? item.urlExpiresAt
        : undefined,
    unavailable: Boolean(item.unavailable || blobOnly),
  };
}

export function normalizeMediaLibrary(
  raw: unknown,
  galleryImageIds: Array<string | null | undefined> = [],
): MediaAsset[] {
  if (!Array.isArray(raw)) return [];
  const library = raw
    .map((item) => normalizeMediaAsset(item))
    .filter((item): item is MediaAsset => item !== null);
  return normalizeOpaqueMediaMetadata(library, galleryImageIds);
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
