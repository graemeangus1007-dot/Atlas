import { PROJECT_MEDIA_BUCKET } from "@/lib/supabase/storage";
import type {
  PublishArtifact,
  PublishAssetEntry,
  PublishFile,
} from "@/lib/publishing/types";

export const SITE_PREVIEWS_BUCKET = "site-previews";

/** One uploadable object for the preview host. */
export type PreviewUploadObject = {
  /** Path relative to the site root, e.g. `index.html`. */
  relativePath: string;
  body: Blob | string;
  contentType: string;
};

export type PreviewStorageGateway = {
  getUserId(): Promise<string | null>;
  uploadPreviewObject(
    objectPath: string,
    body: Blob | string,
    contentType: string,
  ): Promise<void>;
  downloadProjectMedia(storagePath: string): Promise<Blob>;
  fetchExternal(url: string): Promise<Blob>;
  getPublicUrl(objectPath: string): string;
  /** Return true when the public preview URL responds OK. */
  probePublicUrl(url: string): Promise<boolean>;
};

/** `{userId}/{slug}/{relativePath}` inside site-previews. */
export function buildPreviewObjectPath(
  userId: string,
  slug: string,
  relativePath: string,
): string {
  const cleanRelative = relativePath.replace(/^\/+/, "");
  return `${userId}/${slug}/${cleanRelative}`;
}

export function buildSupabasePreviewUrl(
  supabaseUrl: string,
  userId: string,
  slug: string,
): string {
  const base = supabaseUrl.replace(/\/+$/, "");
  const objectPath = buildPreviewObjectPath(userId, slug, "index.html");
  return `${base}/storage/v1/object/public/${SITE_PREVIEWS_BUCKET}/${objectPath}`;
}

function fileToUpload(file: PublishFile): PreviewUploadObject {
  return {
    relativePath: file.path,
    body: file.content,
    contentType: file.contentType.split(";")[0]?.trim() || "text/plain",
  };
}

async function assetToUpload(
  asset: PublishAssetEntry,
  gateway: PreviewStorageGateway,
): Promise<PreviewUploadObject | null> {
  const { source } = asset;

  if (source.type === "inline") {
    // Inline placeholders are already included in artifact.files as SVG.
    return null;
  }

  if (source.type === "storage") {
    const blob = await gateway.downloadProjectMedia(source.storagePath);
    return {
      relativePath: asset.path,
      body: blob,
      contentType: source.mimeType || asset.contentType || "application/octet-stream",
    };
  }

  if (source.type === "external" && source.url) {
    const blob = await gateway.fetchExternal(source.url);
    return {
      relativePath: asset.path,
      body: blob,
      contentType: source.mimeType || asset.contentType || "application/octet-stream",
    };
  }

  return null;
}

/**
 * Collect unique upload objects from artifact files + non-inline assets.
 * Files win over assets when paths collide (HTML/CSS/manifest already baked).
 */
export async function collectPreviewUploads(
  artifact: PublishArtifact,
  gateway: PreviewStorageGateway,
): Promise<PreviewUploadObject[]> {
  const byPath = new Map<string, PreviewUploadObject>();

  for (const file of artifact.files) {
    byPath.set(file.path, fileToUpload(file));
  }

  for (const asset of artifact.assets) {
    if (byPath.has(asset.path)) continue;
    const upload = await assetToUpload(asset, gateway);
    if (upload) byPath.set(upload.relativePath, upload);
  }

  return [...byPath.values()].sort((a, b) =>
    a.relativePath.localeCompare(b.relativePath),
  );
}

export { PROJECT_MEDIA_BUCKET };
