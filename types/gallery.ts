/**
 * Gallery visitor interaction + presentation types (canonical).
 * Used by BusinessProject, GeneratedWebsiteContent, and AI ops.
 */

export type GalleryInteractionMode = "none" | "lightbox";

export type GalleryInteraction = {
  mode: GalleryInteractionMode;
  navigation: boolean;
  captions: boolean;
};

/**
 * Safe default for older projects that lack galleryInteraction.
 * Captions off by default so image-only galleries stay clean.
 */
export const DEFAULT_GALLERY_INTERACTION: GalleryInteraction = {
  mode: "none",
  navigation: true,
  captions: false,
};

/** Normalize partial / legacy payloads into a full GalleryInteraction. */
export function normalizeGalleryInteraction(
  raw: Partial<GalleryInteraction> | null | undefined,
): GalleryInteraction {
  if (!raw) return { ...DEFAULT_GALLERY_INTERACTION };
  return {
    mode: raw.mode === "lightbox" ? "lightbox" : "none",
    navigation: raw.navigation !== false,
    // Default false when omitted (matches DEFAULT_GALLERY_INTERACTION).
    captions: raw.captions === true,
  };
}
