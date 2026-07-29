/**
 * Validate Atlas image operations before apply (Sprint 24.0A).
 */

import { AiError } from "@/lib/ai/errors";
import {
  IMAGE_OPERATION_KINDS,
  IMAGE_RELATIVE_POSITIONS,
  isImageOperationKind,
  isImagePlaceholderKind,
  isSectionImageSlot,
  type ImageOperation,
  type ImageRelativePosition,
  type ImageTargetRef,
} from "@/lib/ai/image-operations";
import type { BusinessProject } from "@/types/business-project";
import { GALLERY_SLOT_COUNT } from "@/types/media";

const MAX_OPS = 20;

function requireObject(raw: unknown, label: string): Record<string, unknown> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new AiError("bad_request", `${label} must be an object.`);
  }
  return raw as Record<string, unknown>;
}

function requireAssetId(
  value: unknown,
  field: string,
  project: BusinessProject,
): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new AiError("bad_request", `Image operation "${field}" is required.`);
  }
  const id = value.trim();
  const asset = project.mediaLibrary.find((item) => item.id === id);
  if (!asset) {
    throw new AiError(
      "bad_request",
      `Unknown image "${id}". Choose an image from your media library.`,
    );
  }
  if (asset.unavailable) {
    throw new AiError(
      "bad_request",
      `Image "${asset.title || id}" is unavailable. Please re-upload it.`,
    );
  }
  return id;
}

function optionalAssetId(
  value: unknown,
  field: string,
  project: BusinessProject,
): string | null {
  if (value === null) return null;
  return requireAssetId(value, field, project);
}

function requireGalleryIndex(value: unknown, indexLabel: number): number {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < 0 ||
    value >= GALLERY_SLOT_COUNT
  ) {
    throw new AiError(
      "bad_request",
      `Gallery index must be 0–${GALLERY_SLOT_COUNT - 1} at operation ${indexLabel}.`,
    );
  }
  return value;
}

function parseTargetRef(
  raw: unknown,
  label: string,
  project: BusinessProject,
): ImageTargetRef {
  const row = requireObject(raw, label);
  const kind = row.kind;
  if (kind === "hero") return { kind: "hero" };
  if (kind === "logo") return { kind: "logo" };
  if (kind === "gallery") {
    return {
      kind: "gallery",
      index: requireGalleryIndex(row.index, 0),
    };
  }
  if (kind === "section") {
    if (!isSectionImageSlot(row.section)) {
      throw new AiError(
        "bad_request",
        `Invalid section reference "${String(row.section)}".`,
      );
    }
    return { kind: "section", section: row.section };
  }
  if (kind === "placeholder") {
    if (!isImagePlaceholderKind(row.placeholder)) {
      throw new AiError(
        "bad_request",
        `Unknown placeholder "${String(row.placeholder)}".`,
      );
    }
    return { kind: "placeholder", placeholder: row.placeholder };
  }
  if (kind === "library") {
    return {
      kind: "library",
      assetId: requireAssetId(row.assetId, "assetId", project),
    };
  }
  if (kind === "ordinal") {
    if (
      typeof row.ordinal !== "number" ||
      !Number.isInteger(row.ordinal) ||
      row.ordinal < 1
    ) {
      throw new AiError("bad_request", `Ordinal must be a 1-based integer.`);
    }
    return { kind: "ordinal", ordinal: row.ordinal };
  }
  throw new AiError("bad_request", `Invalid image target in ${label}.`);
}

function parsePosition(value: unknown): ImageRelativePosition | undefined {
  if (value === undefined) return undefined;
  if (
    typeof value === "string" &&
    (IMAGE_RELATIVE_POSITIONS as readonly string[]).includes(value)
  ) {
    return value as ImageRelativePosition;
  }
  throw new AiError("bad_request", `Invalid image position "${String(value)}".`);
}

function validateOne(
  raw: unknown,
  index: number,
  project: BusinessProject,
): ImageOperation {
  const row = requireObject(raw, `imageOperations[${index}]`);
  const kind = row.operation;

  if (!isImageOperationKind(kind)) {
    throw new AiError(
      "bad_request",
      `Unknown image operation "${String(kind)}" at index ${index}. Allowed: ${IMAGE_OPERATION_KINDS.join(", ")}.`,
    );
  }

  switch (kind) {
    case "replaceHeroImage":
      return {
        operation: "replaceHeroImage",
        assetId: requireAssetId(row.assetId, "assetId", project),
      };
    case "replaceSectionImage":
    case "setSectionImage": {
      if (!isSectionImageSlot(row.section)) {
        throw new AiError(
          "bad_request",
          `Invalid section "${String(row.section)}" at index ${index}.`,
        );
      }
      return {
        operation: kind,
        section: row.section,
        assetId: requireAssetId(row.assetId, "assetId", project),
      };
    }
    case "replaceGalleryImage":
      return {
        operation: "replaceGalleryImage",
        index: requireGalleryIndex(row.index, index),
        assetId: requireAssetId(row.assetId, "assetId", project),
      };
    case "insertImage": {
      const assetId = requireAssetId(row.assetId, "assetId", project);
      const galleryIndex =
        row.galleryIndex === undefined
          ? undefined
          : requireGalleryIndex(row.galleryIndex, index);
      const section =
        row.section === undefined
          ? undefined
          : isSectionImageSlot(row.section)
            ? row.section
            : (() => {
                throw new AiError(
                  "bad_request",
                  `Invalid insertImage section at index ${index}.`,
                );
              })();
      if (galleryIndex === undefined && section === undefined) {
        throw new AiError(
          "bad_request",
          `insertImage at index ${index} requires galleryIndex or section.`,
        );
      }
      return {
        operation: "insertImage",
        assetId,
        ...(galleryIndex !== undefined ? { galleryIndex } : {}),
        ...(section ? { section } : {}),
        ...(parsePosition(row.position)
          ? { position: parsePosition(row.position) }
          : {}),
        ...(typeof row.relativeTo === "string"
          ? { relativeTo: row.relativeTo as InsertImageRelative }
          : {}),
      };
    }
    case "deleteImage":
      return {
        operation: "deleteImage",
        target: parseTargetRef(row.target, `deleteImage.target`, project),
      };
    case "moveImage":
      return {
        operation: "moveImage",
        from: parseTargetRef(row.from, `moveImage.from`, project),
        to: parseTargetRef(row.to, `moveImage.to`, project),
      };
    case "moveGallery": {
      const position = parsePosition(row.position);
      if (!position) {
        throw new AiError(
          "bad_request",
          `moveGallery requires a position at index ${index}.`,
        );
      }
      return {
        operation: "moveGallery",
        position,
        ...(typeof row.relativeTo === "string"
          ? { relativeTo: row.relativeTo as MoveGalleryRelative }
          : {}),
      };
    }
    case "replacePlaceholder": {
      const placeholder =
        row.placeholder === "all"
          ? "all"
          : isImagePlaceholderKind(row.placeholder)
            ? row.placeholder
            : null;
      if (!placeholder) {
        throw new AiError(
          "bad_request",
          `Invalid placeholder "${String(row.placeholder)}" at index ${index}.`,
        );
      }
      return {
        operation: "replacePlaceholder",
        placeholder,
        assetId: requireAssetId(row.assetId, "assetId", project),
      };
    }
    case "setLogo":
      return {
        operation: "setLogo",
        assetId: optionalAssetId(row.assetId, "assetId", project),
      };
    case "removeSectionImage": {
      if (!isSectionImageSlot(row.section)) {
        throw new AiError(
          "bad_request",
          `Invalid section "${String(row.section)}" at index ${index}.`,
        );
      }
      return { operation: "removeSectionImage", section: row.section };
    }
    default: {
      const _exhaustive: never = kind;
      throw new AiError(
        "bad_request",
        `Unhandled image operation "${String(_exhaustive)}".`,
      );
    }
  }
}

type InsertImageRelative = NonNullable<
  Extract<ImageOperation, { operation: "insertImage" }>["relativeTo"]
>;
type MoveGalleryRelative = NonNullable<
  Extract<ImageOperation, { operation: "moveGallery" }>["relativeTo"]
>;

/**
 * Validate an image operation list against the current project media library.
 */
export function validateImageOperations(
  raw: unknown,
  project: BusinessProject,
): ImageOperation[] {
  if (!Array.isArray(raw)) {
    throw new AiError("bad_request", "Image operations must be an array.");
  }
  if (raw.length === 0) {
    throw new AiError("bad_request", "Image operations list is empty.");
  }
  if (raw.length > MAX_OPS) {
    throw new AiError(
      "bad_request",
      `Too many image operations (max ${MAX_OPS}).`,
    );
  }
  return raw.map((item, index) => validateOne(item, index, project));
}
