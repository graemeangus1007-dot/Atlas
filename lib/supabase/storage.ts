import { ACCEPTED_IMAGE_TYPES } from "@/data/media";
import { createClient } from "@/lib/supabase/client";
import { getAuthErrorMessage } from "@/lib/supabase/errors";
import { fileStem, formatFileSize, isAcceptedImageFile } from "@/lib/media";
import type { MediaAsset } from "@/types/media";
import { MAX_PROJECT_MEDIA_BYTES } from "@/types/media";

export const PROJECT_MEDIA_BUCKET = "project-media";

/** Signed URL lifetime (1 hour). UI refreshes before expiry. */
export const PROJECT_MEDIA_SIGNED_URL_TTL_SECONDS = 60 * 60;

/** Refresh signed URLs this many seconds before expiry. */
export const PROJECT_MEDIA_SIGNED_URL_REFRESH_BUFFER_SECONDS = 5 * 60;

export type StorageResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

function fail<T>(error: unknown): StorageResult<T> {
  return { ok: false, error: getStorageErrorMessage(error) };
}

function ok<T>(data: T): StorageResult<T> {
  return { ok: true, data };
}

export function getStorageErrorMessage(error: unknown): string {
  const message = getAuthErrorMessage(error);
  const lower = message.toLowerCase();

  if (lower.includes("payload too large") || lower.includes("maximum allowed size")) {
    return "That image is too large. Please use a file under 5 MB.";
  }
  if (
    lower.includes("not allowed") ||
    lower.includes("mime") ||
    lower.includes("invalid")
  ) {
    return "Please upload a JPEG, PNG, WebP, or GIF image.";
  }
  if (
    lower.includes("row-level security") ||
    lower.includes("unauthorized") ||
    lower.includes("permission") ||
    lower.includes("not found")
  ) {
    return "You don't have permission to manage this media. Try signing in again.";
  }
  if (
    lower.includes("failed to fetch") ||
    lower.includes("network") ||
    lower.includes("fetch failed")
  ) {
    return "Could not reach storage. Check your connection and try again.";
  }
  if (lower.includes("bucket") && lower.includes("not found")) {
    return "Media storage is not set up yet. Run the project-media Storage migration.";
  }

  return message || "Could not upload your image. Please try again.";
}

function createId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `media-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function extensionForFile(file: File): string {
  const fromName = file.name.split(".").pop()?.toLowerCase();
  if (fromName && /^[a-z0-9]+$/.test(fromName)) return fromName;

  switch (file.type) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/gif":
      return "gif";
    default:
      return "img";
  }
}

function sanitizeFilename(name: string): string {
  const stem = fileStem(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return stem || "image";
}

function signedUrlExpiresAtMs(
  ttlSeconds = PROJECT_MEDIA_SIGNED_URL_TTL_SECONDS,
): number {
  return (
    Date.now() +
    (ttlSeconds - PROJECT_MEDIA_SIGNED_URL_REFRESH_BUFFER_SECONDS) * 1000
  );
}

/** Validate image type + size before upload. */
export function validateProjectMediaFile(file: File): StorageResult<File> {
  if (!isAcceptedImageFile(file)) {
    return {
      ok: false,
      error: "Please upload a JPEG, PNG, WebP, or GIF image.",
    };
  }
  if (file.size > MAX_PROJECT_MEDIA_BYTES) {
    return {
      ok: false,
      error: "That image is too large. Please use a file under 5 MB.",
    };
  }
  if (
    !ACCEPTED_IMAGE_TYPES.includes(
      file.type as (typeof ACCEPTED_IMAGE_TYPES)[number],
    )
  ) {
    return {
      ok: false,
      error: "Please upload a JPEG, PNG, WebP, or GIF image.",
    };
  }
  return ok(file);
}

export function buildProjectMediaPath(
  userId: string,
  projectId: string,
  file: File,
): { storagePath: string; filename: string } {
  const filename = `${createId()}-${sanitizeFilename(file.name)}.${extensionForFile(file)}`;
  return {
    filename,
    storagePath: `${userId}/${projectId}/${filename}`,
  };
}

/**
 * Create a time-limited signed URL for a private project-media object.
 * Prefer this over getPublicUrl (which does not work on private buckets).
 */
export async function getProjectMediaUrl(
  storagePath: string,
  expiresIn = PROJECT_MEDIA_SIGNED_URL_TTL_SECONDS,
): Promise<StorageResult<string>> {
  try {
    const path = storagePath.trim();
    if (!path) {
      return { ok: false, error: "Missing storage path." };
    }

    const supabase = createClient();
    const { data, error } = await supabase.storage
      .from(PROJECT_MEDIA_BUCKET)
      .createSignedUrl(path, expiresIn);

    if (error) return fail(error);
    if (!data?.signedUrl) {
      return { ok: false, error: "Could not create a signed media URL." };
    }

    return ok(data.signedUrl);
  } catch (error) {
    return fail(error);
  }
}

/** Batch-sign many storage paths → path → signedUrl map. */
export async function getProjectMediaUrls(
  storagePaths: string[],
  expiresIn = PROJECT_MEDIA_SIGNED_URL_TTL_SECONDS,
): Promise<StorageResult<Record<string, string>>> {
  try {
    const unique = [
      ...new Set(
        storagePaths
          .map((path) => path.trim())
          .filter((path) => path.length > 0),
      ),
    ];

    if (unique.length === 0) return ok({});

    const supabase = createClient();
    const { data, error } = await supabase.storage
      .from(PROJECT_MEDIA_BUCKET)
      .createSignedUrls(unique, expiresIn);

    if (error) return fail(error);

    const map: Record<string, string> = {};
    for (const item of data ?? []) {
      if (item.path && item.signedUrl && !item.error) {
        map[item.path] = item.signedUrl;
      }
    }

    return ok(map);
  } catch (error) {
    return fail(error);
  }
}

/** Whether a media asset's signed display URL should be refreshed. */
export function mediaAssetNeedsSignedUrlRefresh(asset: MediaAsset): boolean {
  if (!asset.storagePath || asset.unavailable) return false;
  if (!asset.urlExpiresAt) return true;
  return Date.now() >= asset.urlExpiresAt;
}

/**
 * Refresh signed display URLs for assets that have a storagePath.
 * storagePath remains the durable identity; url is ephemeral for <img>.
 */
export async function hydrateMediaLibrary(
  assets: MediaAsset[],
): Promise<MediaAsset[]> {
  const allStoragePaths = assets
    .map((asset) => asset.storagePath)
    .filter((path): path is string => Boolean(path));

  if (allStoragePaths.length === 0) return assets;

  const signed = await getProjectMediaUrls(allStoragePaths);
  if (!signed.ok) {
    return assets.map((asset) =>
      asset.storagePath ? { ...asset, unavailable: true } : asset,
    );
  }

  const expiresAt = signedUrlExpiresAtMs();
  return assets.map((asset) => {
    if (!asset.storagePath) return asset;
    const url = signed.data[asset.storagePath];
    if (!url) {
      return { ...asset, unavailable: true };
    }
    return {
      ...asset,
      url,
      urlExpiresAt: expiresAt,
      unavailable: false,
    };
  });
}

/**
 * Upload a file to Supabase Storage under {userId}/{projectId}/{filename}.
 * Returns a MediaAsset with storagePath + a fresh signed display URL.
 */
export async function uploadProjectMedia(
  projectId: string,
  file: File,
): Promise<StorageResult<MediaAsset>> {
  try {
    const validated = validateProjectMediaFile(file);
    if (!validated.ok) return validated;

    const trimmedProjectId = projectId.trim();
    if (!trimmedProjectId) {
      return {
        ok: false,
        error: "Open or create a project before uploading media.",
      };
    }

    const supabase = createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) return fail(userError);
    if (!user) {
      return {
        ok: false,
        error: "Please sign in to upload media, then try again.",
      };
    }

    const { storagePath, filename } = buildProjectMediaPath(
      user.id,
      trimmedProjectId,
      file,
    );

    const { error: uploadError } = await supabase.storage
      .from(PROJECT_MEDIA_BUCKET)
      .upload(storagePath, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type,
      });

    if (uploadError) return fail(uploadError);

    const signed = await getProjectMediaUrl(storagePath);
    if (!signed.ok) return signed;

    const title = fileStem(file.name);

    return ok({
      id: createId(),
      name: file.name,
      filename,
      url: signed.data,
      storagePath,
      mimeType: file.type,
      size: file.size,
      sizeLabel: formatFileSize(file.size),
      createdAt: Date.now(),
      urlExpiresAt: signedUrlExpiresAtMs(),
      title,
      description: "",
      alt: title,
      unavailable: false,
    });
  } catch (error) {
    return fail(error);
  }
}

/** Upload multiple files sequentially with overall progress 0–100. */
export async function uploadProjectMediaFiles(
  projectId: string,
  files: File[],
  onProgress?: (percent: number) => void,
): Promise<StorageResult<MediaAsset[]>> {
  const accepted = files.filter((file) => isAcceptedImageFile(file));
  if (accepted.length === 0) {
    return {
      ok: false,
      error: "Please upload JPEG, PNG, WebP, or GIF images.",
    };
  }

  const assets: MediaAsset[] = [];
  for (let index = 0; index < accepted.length; index += 1) {
    const file = accepted[index];
    const base = (index / accepted.length) * 100;
    const span = 100 / accepted.length;
    onProgress?.(Math.round(base + span * 0.15));

    const result = await uploadProjectMedia(projectId, file);
    if (!result.ok) {
      return { ok: false, error: result.error };
    }

    assets.push(result.data);
    onProgress?.(Math.round(base + span));
  }

  onProgress?.(100);
  return ok(assets);
}

/** Soft-fail delete of a storage object (missing objects are treated as success). */
export async function deleteProjectMedia(
  storagePath: string,
): Promise<StorageResult<{ path: string }>> {
  try {
    const path = storagePath.trim();
    if (!path) {
      return { ok: false, error: "Missing storage path." };
    }

    const supabase = createClient();
    const { error } = await supabase.storage
      .from(PROJECT_MEDIA_BUCKET)
      .remove([path]);

    if (error) return fail(error);
    return ok({ path });
  } catch (error) {
    return fail(error);
  }
}
