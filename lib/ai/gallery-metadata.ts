/**
 * Natural-language gallery metadata edits (v1.3).
 */

import type { EditOperation } from "@/lib/ai/edit-operations";
import {
  deriveAltText,
  isOpaqueMediaLabel,
  publicGalleryTitle,
} from "@/lib/media-titles";
import type { BusinessProject } from "@/types/business-project";
import { GALLERY_SLOT_COUNT } from "@/types/media";

const RENAME_TO =
  /\b(?:rename|title)\s+(?:the\s+)?(first|1st|second|2nd|third|3rd|fourth|4th)\s+(?:gallery\s+)?(?:image|photo|picture)\s+to\s+[“"'‘]?(.+?)[”"'’]?[.!]?\s*$/i;

const CALL_AS =
  /\b(?:call|name)\s+(?:the\s+)?(first|1st|second|2nd|third|3rd|fourth|4th)\s+(?:gallery\s+)?(?:image|photo|picture)\s+[“"'‘]?(.+?)[”"'’]?[.!]?\s*$/i;

const REMOVE_TITLES =
  /\b(remove|hide|clear)\b[\s\S]{0,24}\b(titles?|labels?)\b[\s\S]{0,24}\b(gallery|photos?|images?)?\b|\b(gallery\s+)?(without|no)\s+titles?\b/i;

const ADD_CAPTIONS =
  /\b(add|write)\b[\s\S]{0,20}\bcaptions?\b[\s\S]{0,30}\b(photos?|images?|gallery)\b|\bcaptions?\s+to\s+(these\s+)?(photos?|images?)\b/i;

const DESCRIPTIVE_ALT =
  /\b(descriptive\s+)?alt\s+text\b|\balt\s+text\s+for\s+all\b/i;

function ordinalToIndex(token: string): number | null {
  const t = token.toLowerCase();
  if (t === "first" || t === "1st" || t === "1") return 0;
  if (t === "second" || t === "2nd" || t === "2") return 1;
  if (t === "third" || t === "3rd" || t === "3") return 2;
  if (t === "fourth" || t === "4th" || t === "4") return 3;
  return null;
}

export function isGalleryMetadataRequest(request: string): boolean {
  const text = request.trim();
  if (!text) return false;
  return (
    RENAME_TO.test(text) ||
    CALL_AS.test(text) ||
    REMOVE_TITLES.test(text) ||
    ADD_CAPTIONS.test(text) ||
    DESCRIPTIVE_ALT.test(text)
  );
}

function filledGalleryIndexes(project: BusinessProject): number[] {
  const ids = project.galleryImageIds ?? [];
  const out: number[] = [];
  for (let i = 0; i < GALLERY_SLOT_COUNT; i++) {
    if (ids[i]) out.push(i);
  }
  return out;
}

export function planGalleryMetadataOperations(input: {
  project: BusinessProject;
  request: string;
}): {
  operations: EditOperation[];
  explanation: string;
  needsClarification: boolean;
} {
  const text = input.request.trim();
  const indexes = filledGalleryIndexes(input.project);

  const rename = text.match(RENAME_TO) || text.match(CALL_AS);
  if (rename) {
    const ord = rename[1]!;
    const nameRaw = (rename[2] || "").trim().replace(/[.!]+$/, "");
    const index = ordinalToIndex(ord);
    if (index == null || !nameRaw) {
      return {
        operations: [],
        explanation: "Which gallery photo should I rename, and what should it be called?",
        needsClarification: true,
      };
    }
    const assetId = input.project.galleryImageIds[index];
    if (!assetId) {
      return {
        operations: [],
        explanation: `Gallery slot ${index + 1} doesn’t have a photo yet.`,
        needsClarification: true,
      };
    }
    return {
      operations: [
        {
          operation: "updateGalleryItemMetadata",
          galleryIndex: index,
          assetId,
          title: nameRaw,
          altText: nameRaw,
        },
      ],
      explanation: `Done. I renamed gallery photo ${index + 1} to “${nameRaw}”.`,
      needsClarification: false,
    };
  }

  if (REMOVE_TITLES.test(text)) {
    const operations: EditOperation[] = indexes.map((galleryIndex) => ({
      operation: "updateGalleryItemMetadata" as const,
      galleryIndex,
      assetId: input.project.galleryImageIds[galleryIndex]!,
      title: "",
      hideTitle: true,
    }));
    return {
      operations,
      explanation:
        operations.length > 0
          ? "Done. I removed the gallery titles so the photos can speak for themselves."
          : "There aren’t any gallery photos to update yet.",
      needsClarification: false,
    };
  }

  if (DESCRIPTIVE_ALT.test(text)) {
    const operations: EditOperation[] = indexes.map((galleryIndex) => {
      const assetId = input.project.galleryImageIds[galleryIndex]!;
      const asset = input.project.mediaLibrary.find((a) => a.id === assetId);
      const title = publicGalleryTitle(asset?.title) || asset?.title || "";
      const alt = deriveAltText(
        title,
        asset?.name || "photo",
        galleryIndex,
      );
      // Prefer a descriptive phrase when we only have Photo N
      const descriptive = isOpaqueMediaLabel(title) || /^photo\s+\d+$/i.test(title)
        ? `Gallery photo ${galleryIndex + 1} for ${input.project.businessName || "this business"}`
        : alt;
      return {
        operation: "updateGalleryItemMetadata" as const,
        galleryIndex,
        assetId,
        altText: descriptive,
      };
    });
    return {
      operations,
      explanation:
        "Done. I added descriptive alt text for each gallery photo.",
      needsClarification: false,
    };
  }

  if (ADD_CAPTIONS.test(text)) {
    return {
      operations: [],
      explanation:
        "Tell me the caption for each photo (for example: “Caption the first photo ‘Before the renovation’”), and I’ll add them.",
      needsClarification: true,
    };
  }

  return {
    operations: [],
    explanation: "I couldn’t tell which gallery metadata to change.",
    needsClarification: true,
  };
}
