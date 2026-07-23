/** Editable display metadata for a media asset (gallery / accessibility). */
export type MediaAssetMeta = {
  title: string;
  description: string;
  alt: string;
};

/** A single uploaded asset in the project media library. */
export type MediaAsset = MediaAssetMeta & {
  id: string;
  name: string;
  /** Browser object URL (`blob:…`) used for previews — no cloud storage yet. */
  url: string;
  /** Human-readable size, e.g. "240 KB". */
  sizeLabel: string;
  createdAt: number;
};

/** Fixed gallery slots on the generated homepage. */
export const GALLERY_SLOT_COUNT = 4;

/** Ordered media asset ids assigned to gallery slots (max `GALLERY_SLOT_COUNT`). */
export type GalleryImageIds = string[];
