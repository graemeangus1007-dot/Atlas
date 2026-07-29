/**
 * Atlas Visual Designer — image operation language (Sprint 24.0A).
 * Image Agent emits these ops; Atlas validates + applies. Never raw JSON merges.
 */

import type { TemplateSectionId } from "@/lib/templates/types";

/** Homepage / design slots that can hold a section image. */
export const SECTION_IMAGE_SLOTS = [
  "about",
  "services",
  "contact",
  "team",
  "testimonials",
  "hero",
  "gallery",
  "features",
] as const;

export type SectionImageSlot = (typeof SECTION_IMAGE_SLOTS)[number];

/** Named placeholder kinds users can refer to without IDs. */
export const IMAGE_PLACEHOLDER_KINDS = [
  "hero",
  "gallery",
  "gallery-0",
  "gallery-1",
  "gallery-2",
  "gallery-3",
  "team",
  "testimonial",
  "logo",
] as const;

export type ImagePlaceholderKind = (typeof IMAGE_PLACEHOLDER_KINDS)[number];

/** Relative placement for moveGallery / insertImage. */
export const IMAGE_RELATIVE_POSITIONS = [
  "above",
  "below",
  "before",
  "after",
  "next_to",
  "between",
  "top",
  "bottom",
] as const;

export type ImageRelativePosition = (typeof IMAGE_RELATIVE_POSITIONS)[number];

export const IMAGE_OPERATION_KINDS = [
  "replaceHeroImage",
  "replaceSectionImage",
  "replaceGalleryImage",
  "insertImage",
  "deleteImage",
  "moveImage",
  "moveGallery",
  "replacePlaceholder",
  "setLogo",
  "setSectionImage",
  "removeSectionImage",
] as const;

export type ImageOperationKind = (typeof IMAGE_OPERATION_KINDS)[number];

/** Conversational / structured reference to an image on the site. */
export type ImageTargetRef =
  | { kind: "hero" }
  | { kind: "logo" }
  | { kind: "gallery"; index: number }
  | { kind: "section"; section: SectionImageSlot }
  | { kind: "placeholder"; placeholder: ImagePlaceholderKind }
  | { kind: "library"; assetId: string }
  | { kind: "ordinal"; ordinal: number }; // 1-based “first image”, etc.

export type ReplaceHeroImageOperation = {
  operation: "replaceHeroImage";
  assetId: string;
};

export type ReplaceSectionImageOperation = {
  operation: "replaceSectionImage";
  section: SectionImageSlot;
  assetId: string;
};

export type ReplaceGalleryImageOperation = {
  operation: "replaceGalleryImage";
  /** 0-based gallery slot. */
  index: number;
  assetId: string;
};

export type InsertImageOperation = {
  operation: "insertImage";
  assetId: string;
  /** Prefer gallery slot when inserting into the gallery. */
  galleryIndex?: number;
  section?: SectionImageSlot;
  position?: ImageRelativePosition;
  relativeTo?: SectionImageSlot | TemplateSectionId | "testimonials" | "faq";
};

export type DeleteImageOperation = {
  operation: "deleteImage";
  target: ImageTargetRef;
};

export type MoveImageOperation = {
  operation: "moveImage";
  from: ImageTargetRef;
  to: ImageTargetRef;
};

export type MoveGalleryOperation = {
  operation: "moveGallery";
  position: ImageRelativePosition;
  relativeTo?: SectionImageSlot | TemplateSectionId | "testimonials" | "faq";
};

export type ReplacePlaceholderOperation = {
  operation: "replacePlaceholder";
  placeholder: ImagePlaceholderKind | "all";
  assetId: string;
};

export type SetLogoOperation = {
  operation: "setLogo";
  /** Library asset id, or null to clear. */
  assetId: string | null;
};

export type SetSectionImageOperation = {
  operation: "setSectionImage";
  section: SectionImageSlot;
  assetId: string;
};

export type RemoveSectionImageOperation = {
  operation: "removeSectionImage";
  section: SectionImageSlot;
};

export type ImageOperation =
  | ReplaceHeroImageOperation
  | ReplaceSectionImageOperation
  | ReplaceGalleryImageOperation
  | InsertImageOperation
  | DeleteImageOperation
  | MoveImageOperation
  | MoveGalleryOperation
  | ReplacePlaceholderOperation
  | SetLogoOperation
  | SetSectionImageOperation
  | RemoveSectionImageOperation;

/** Human-readable bullet shared with text-edit change lists. */
export type ImageChangeSummary = {
  id: string;
  label: string;
  ok: true;
};

export function isImageOperationKind(
  value: unknown,
): value is ImageOperationKind {
  return (
    typeof value === "string" &&
    (IMAGE_OPERATION_KINDS as readonly string[]).includes(value)
  );
}

export function isSectionImageSlot(value: unknown): value is SectionImageSlot {
  return (
    typeof value === "string" &&
    (SECTION_IMAGE_SLOTS as readonly string[]).includes(value)
  );
}

export function isImagePlaceholderKind(
  value: unknown,
): value is ImagePlaceholderKind {
  return (
    typeof value === "string" &&
    (IMAGE_PLACEHOLDER_KINDS as readonly string[]).includes(value)
  );
}
