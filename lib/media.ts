import { ACCEPTED_IMAGE_TYPES } from "@/data/media";
import type { MediaAsset } from "@/types/media";

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

/** Create a MediaAsset backed by a browser object URL. */
export function createMediaAssetFromFile(file: File): MediaAsset {
  if (!isAcceptedImageFile(file)) {
    throw new Error("Please upload a JPEG, PNG, WebP, or GIF image.");
  }

  const title = fileStem(file.name);

  return {
    id: createId(),
    name: file.name,
    url: URL.createObjectURL(file),
    sizeLabel: formatFileSize(file.size),
    createdAt: Date.now(),
    title,
    description: "",
    alt: title,
  };
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

/**
 * Mock upload progress from 0 → 100, then create an object-URL asset.
 */
export async function mockUploadImage(
  file: File,
  onProgress: (percent: number) => void,
): Promise<MediaAsset> {
  if (!isAcceptedImageFile(file)) {
    throw new Error("Please upload a JPEG, PNG, WebP, or GIF image.");
  }

  onProgress(6);

  await new Promise<void>((resolve) => {
    let progress = 6;
    const timer = window.setInterval(() => {
      progress = Math.min(progress + 10 + Math.random() * 16, 94);
      onProgress(Math.round(progress));
      if (progress >= 94) {
        window.clearInterval(timer);
        resolve();
      }
    }, 90);
  });

  const asset = createMediaAssetFromFile(file);
  onProgress(100);
  return asset;
}

/** Upload multiple files sequentially with overall progress. */
export async function mockUploadImages(
  files: File[],
  onProgress: (percent: number) => void,
): Promise<MediaAsset[]> {
  const accepted = files.filter(isAcceptedImageFile);
  if (accepted.length === 0) {
    throw new Error("Please upload JPEG, PNG, WebP, or GIF images.");
  }

  const assets: MediaAsset[] = [];
  for (let index = 0; index < accepted.length; index += 1) {
    const file = accepted[index];
    const base = (index / accepted.length) * 100;
    const span = 100 / accepted.length;

    const asset = await mockUploadImage(file, (filePercent) => {
      onProgress(Math.min(100, Math.round(base + (filePercent / 100) * span)));
    });
    assets.push(asset);
  }

  onProgress(100);
  return assets;
}

/** Resolve a media asset id to its object URL. */
export function resolveMediaUrl(
  library: MediaAsset[],
  id: string | null | undefined,
): string | null {
  if (!id) return null;
  return library.find((asset) => asset.id === id)?.url ?? null;
}
