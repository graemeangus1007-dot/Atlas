/** Default media fields for new / mock projects. */
export const DEFAULT_MEDIA = {
  mediaLibrary: [] as const,
  heroImageId: null as string | null,
  galleryImageIds: [] as string[],
};

/** Accepted image MIME types for the Media Library uploader. */
export const ACCEPTED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;

export const ACCEPTED_IMAGE_ACCEPT = ACCEPTED_IMAGE_TYPES.join(",");
