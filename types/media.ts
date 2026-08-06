/**
 * Editable display metadata for a media asset (gallery / accessibility).
 * Never use storage filenames or asset IDs as visible titles.
 */
export type MediaAssetMeta = {
  /** Human-readable label (may be empty for image-only gallery). */
  title: string;
  /** Optional visible caption (description). */
  description: string;
  /** Accessibility text — never opaque IDs. */
  alt: string;
};

/** A single uploaded asset in the project media library. */
export type MediaAsset = MediaAssetMeta & {
  id: string;
  /** Original upload file name (user-facing identity for title derivation). */
  name: string;
  /** Stored object file name (unique, machine-safe — never show publicly). */
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
  /** Optional pixel width when known (upload / analysis). */
  width?: number;
  /** Optional pixel height when known (upload / analysis). */
  height?: number;
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
