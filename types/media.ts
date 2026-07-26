/** Editable display metadata for a media asset (gallery / accessibility). */
export type MediaAssetMeta = {
  title: string;
  description: string;
  alt: string;
};

/** A single uploaded asset in the project media library. */
export type MediaAsset = MediaAssetMeta & {
  id: string;
  /** Original upload file name (display). */
  name: string;
  /** Stored object file name (unique). */
  filename: string;
  /**
   * Display URL — ephemeral signed URL for private project-media (or brief blob: during upload).
   * Durable identity is `storagePath`; never rely on `url` across sessions without re-signing.
   */
  url: string;
  /** Path inside the project-media bucket, e.g. userId/projectId/file.webp */
  storagePath: string | null;
  mimeType: string;
  /** Byte length. */
  size: number;
  /** Human-readable size, e.g. "240 KB". */
  sizeLabel: string;
  createdAt: number;
  /**
   * When the current signed `url` should be refreshed (epoch ms).
   * Not authoritative — storagePath is the durable identity.
   */
  urlExpiresAt?: number;
  /**
   * Legacy blob:-only records (no storagePath) that cannot be re-fetched.
   * Shown as unavailable until the user re-uploads.
   */
  unavailable?: boolean;
};

/** Fixed gallery slots on the generated homepage. */
export const GALLERY_SLOT_COUNT = 4;

/** Ordered media asset ids assigned to gallery slots (max `GALLERY_SLOT_COUNT`). */
export type GalleryImageIds = string[];

/** Max upload size for project media (5 MB). */
export const MAX_PROJECT_MEDIA_BYTES = 5 * 1024 * 1024;
