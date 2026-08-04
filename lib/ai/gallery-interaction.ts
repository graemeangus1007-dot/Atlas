/**
 * Gallery interaction — fullscreen lightbox (v1.3).
 */

import type { EditOperation } from "@/lib/ai/edit-operations";
import type { BusinessProject } from "@/types/business-project";

export type GalleryInteractionMode = "none" | "lightbox";

export type GalleryInteraction = {
  mode: GalleryInteractionMode;
  navigation: boolean;
  captions: boolean;
};

export const DEFAULT_GALLERY_INTERACTION: GalleryInteraction = {
  mode: "none",
  navigation: true,
  captions: true,
};

const LIGHTBOX_REQUEST =
  /\b((click|tap|open|view|see)\b[\s\S]{0,40}\b(full|entire|whole|larger|bigger|fullscreen|full[- ]?screen|lightbox)\b|\b(full|entire|whole)\s+(picture|photo|image)s?\b[\s\S]{0,40}\b(click|tap|open)\b|\b(lightbox|photo\s+viewer|image\s+viewer)\b|\b(gallery\s+images?\s+fullscreen|fullscreen\s+gallery|swipe\s+through\s+(the\s+)?photos?|open\s+gallery\s+photos?\s+larger|make\s+the\s+gallery\s+images?\s+fullscreen|let\s+(people|visitors)\s+(click|swipe))\b)/i;

export function isGalleryLightboxRequest(request: string): boolean {
  return LIGHTBOX_REQUEST.test(request.trim());
}

export function readGalleryInteraction(
  project: BusinessProject,
): GalleryInteraction {
  const raw = project.galleryInteraction;
  if (!raw) return { ...DEFAULT_GALLERY_INTERACTION };
  return {
    mode: raw.mode === "lightbox" ? "lightbox" : "none",
    navigation: raw.navigation !== false,
    captions: raw.captions !== false,
  };
}

export function planGalleryLightboxOperations(): {
  operations: EditOperation[];
  explanation: string;
  interaction: GalleryInteraction;
} {
  const interaction: GalleryInteraction = {
    mode: "lightbox",
    navigation: true,
    captions: true,
  };
  return {
    operations: [
      {
        operation: "setGalleryInteraction",
        mode: "lightbox",
        navigation: true,
        captions: true,
      },
    ],
    interaction,
    explanation:
      "I’ll make the gallery images open in a full-screen viewer so visitors can see each complete photo and move through the gallery.",
  };
}

export function verifyGalleryLightbox(input: {
  before: BusinessProject;
  after: BusinessProject;
  galleryAssetIds: Array<string | null | undefined>;
}): {
  verified: boolean;
  failures: string[];
} {
  const after = readGalleryInteraction(input.after);
  const failures: string[] = [];
  if (after.mode !== "lightbox") {
    failures.push("gallery_interaction_not_lightbox");
  }
  const library = input.after.mediaLibrary ?? [];
  for (const id of input.galleryAssetIds) {
    if (!id) continue;
    const asset = library.find((a) => a.id === id);
    if (!asset || asset.unavailable || !asset.url) {
      failures.push(`missing_full_size_asset:${id}`);
    }
  }
  return { verified: failures.length === 0, failures };
}
