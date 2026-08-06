/**
 * Gallery interaction — fullscreen lightbox (v1.3).
 * P1.6 — lightbox ownership requires gallery-domain evidence.
 */

import type { EditOperation } from "@/lib/ai/edit-operations";
import type { BusinessProject } from "@/types/business-project";
import {
  DEFAULT_GALLERY_INTERACTION,
  normalizeGalleryInteraction,
  type GalleryInteraction,
  type GalleryInteractionMode,
} from "@/types/gallery";

export type { GalleryInteraction, GalleryInteractionMode };
export { DEFAULT_GALLERY_INTERACTION, normalizeGalleryInteraction };

/** Gallery-specific evidence — not bare “entire picture” / “full image”. */
const GALLERY_EVIDENCE =
  /\b(gallery|thumbnail|photo\s+grid|lightbox|visitors?|people\s+click|let\s+(people|visitors)|swipe\s+through|click\s+(a\s+|the\s+|one\s+of\s+the\s+)?(gallery\s+)?(photos?|images?)|open\s+gallery|full[- ]?screen\s+viewer|photo\s+viewer|image\s+viewer)\b/i;

const LIGHTBOX_ACTION =
  /\b((click|tap|open|view)\b[\s\S]{0,48}\b(full|entire|whole|larger|bigger|fullscreen|full[- ]?screen|lightbox)\b|\b(full|entire|whole)\s+(picture|photo|image)s?\b[\s\S]{0,40}\b(click|tap|open)\b|\b(lightbox|photo\s+viewer|image\s+viewer)\b|\b(gallery\s+images?\s+fullscreen|fullscreen\s+gallery|swipe\s+through\s+(the\s+)?photos?|open\s+gallery\s+photos?\s+larger|make\s+the\s+gallery\s+images?\s+fullscreen|let\s+(people|visitors)\s+(click|swipe)|show\s+the\s+full\s+gallery\s+(photo|image)|add\s+a\s+lightbox)\b)/i;

export function hasGalleryLightboxEvidence(request: string): boolean {
  return GALLERY_EVIDENCE.test(request.trim());
}

export function isGalleryLightboxRequest(request: string): boolean {
  const text = request.trim();
  if (!text) return false;
  // Bare “see the entire picture” / “full image” without gallery cues must never match.
  if (!hasGalleryLightboxEvidence(text)) return false;
  return LIGHTBOX_ACTION.test(text) || /\blightbox\b/i.test(text);
}

/** Soft follow-ups while a gallery_interaction active task is sticky. */
export function isGalleryLightboxSoftContinuation(request: string): boolean {
  const text = request.trim();
  if (!text) return false;
  if (isGalleryLightboxRequest(text)) return true;
  return /\b(hide|show)\b[\s\S]{0,20}\bcaptions?\b|\bturn\s+(that\s+|the\s+lightbox\s+|lightbox\s+)?off\b|\blightbox\s+off\b|\blet\s+them\s+swipe|\bswipe\s+too\b|\bnavigation\b/i.test(
    text,
  );
}

/**
 * Plan gallery interaction changes for soft continuations
 * (hide captions / turn off / swipe).
 */
export function planGalleryInteractionContinuation(request: string): {
  operations: EditOperation[];
  explanation: string;
  interaction: GalleryInteraction;
} | null {
  const text = request.trim();
  if (
    /\bturn\s+(that\s+|the\s+lightbox\s+|lightbox\s+)?off\b|\bdisable\s+(the\s+)?lightbox\b|\bno\s+lightbox\b|\blightbox\s+off\b/i.test(
      text,
    )
  ) {
    const interaction: GalleryInteraction = {
      mode: "none",
      navigation: false,
      captions: false,
    };
    return {
      operations: [
        {
          operation: "setGalleryInteraction",
          mode: "none",
          navigation: false,
          captions: false,
        },
      ],
      interaction,
      explanation:
        "Done. I turned off the full-screen gallery viewer so photos stay in the grid.",
    };
  }
  if (/\bhide\b[\s\S]{0,20}\bcaptions?\b/i.test(text)) {
    return {
      operations: [
        {
          operation: "setGalleryInteraction",
          mode: "lightbox",
          navigation: true,
          captions: false,
        },
      ],
      interaction: { mode: "lightbox", navigation: true, captions: false },
      explanation: "Done. I hid the gallery captions in the full-screen viewer.",
    };
  }
  if (/\bshow\b[\s\S]{0,20}\bcaptions?\b/i.test(text)) {
    return {
      operations: [
        {
          operation: "setGalleryInteraction",
          mode: "lightbox",
          navigation: true,
          captions: true,
        },
      ],
      interaction: { mode: "lightbox", navigation: true, captions: true },
      explanation: "Done. I turned gallery captions back on in the viewer.",
    };
  }
  if (/\bswipe\b|\bnavigation\b/i.test(text)) {
    return {
      operations: [
        {
          operation: "setGalleryInteraction",
          mode: "lightbox",
          navigation: true,
          captions: true,
        },
      ],
      interaction: { mode: "lightbox", navigation: true, captions: true },
      explanation:
        "Done. Visitors can swipe through gallery photos in the full-screen viewer.",
    };
  }
  if (isGalleryLightboxRequest(text)) {
    return planGalleryLightboxOperations();
  }
  return null;
}

export function readGalleryInteraction(
  project: BusinessProject,
): GalleryInteraction {
  return normalizeGalleryInteraction(project.galleryInteraction);
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
