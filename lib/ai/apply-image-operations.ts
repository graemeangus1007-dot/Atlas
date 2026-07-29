/**
 * Apply validated image operations onto a BusinessProject (immutable).
 * Sprint 24.0A — never called with unvalidated ops.
 */

import type {
  ImageChangeSummary,
  ImageOperation,
  ImageTargetRef,
  SectionImageSlot,
} from "@/lib/ai/image-operations";
import { resolveMediaUrl } from "@/lib/media";
import type { BusinessProject } from "@/types/business-project";
import { GALLERY_SLOT_COUNT } from "@/types/media";
import { getTemplate } from "@/lib/templates";
import "@/lib/templates";

function cloneGalleryIds(project: BusinessProject): string[] {
  const ids = [...project.galleryImageIds];
  while (ids.length < GALLERY_SLOT_COUNT) ids.push("");
  return ids.slice(0, GALLERY_SLOT_COUNT);
}

function summarize(op: ImageOperation, index: number): ImageChangeSummary {
  const id = `${op.operation}-${index}`;
  switch (op.operation) {
    case "replaceHeroImage":
      return { id, label: "Hero image updated", ok: true };
    case "replaceSectionImage":
    case "setSectionImage":
      return { id, label: `${op.section} image updated`, ok: true };
    case "replaceGalleryImage":
      return { id, label: `Gallery image ${op.index + 1} updated`, ok: true };
    case "insertImage":
      return { id, label: "Image added", ok: true };
    case "deleteImage":
      return { id, label: "Image removed", ok: true };
    case "moveImage":
      return { id, label: "Image moved", ok: true };
    case "moveGallery":
      return { id, label: "Gallery moved", ok: true };
    case "replacePlaceholder":
      return { id, label: "Placeholder replaced", ok: true };
    case "setLogo":
      return {
        id,
        label: op.assetId ? "Logo updated" : "Logo removed",
        ok: true,
      };
    case "removeSectionImage":
      return { id, label: `${op.section} image removed`, ok: true };
    default: {
      const _exhaustive: never = op;
      return _exhaustive;
    }
  }
}

function resolveTargetAssetId(
  project: BusinessProject,
  target: ImageTargetRef,
): string | null {
  switch (target.kind) {
    case "hero":
      return project.heroImageId;
    case "logo":
      return project.logoAssetId ?? null;
    case "gallery":
      return project.galleryImageIds[target.index] || null;
    case "section":
      return project.sectionImages?.[target.section] ?? null;
    case "library":
      return target.assetId;
    case "placeholder":
      if (target.placeholder === "hero" || target.placeholder === "logo") {
        return null;
      }
      if (target.placeholder.startsWith("gallery")) {
        const idx = Number.parseInt(target.placeholder.split("-")[1] ?? "0", 10);
        return project.galleryImageIds[idx] || null;
      }
      return project.sectionImages?.[target.placeholder as SectionImageSlot] ?? null;
    case "ordinal": {
      const slots: Array<string | null> = [
        project.heroImageId,
        ...cloneGalleryIds(project).map((id) => id || null),
      ];
      const filled = slots.filter(Boolean) as string[];
      return filled[target.ordinal - 1] ?? null;
    }
    default:
      return null;
  }
}

function clearTarget(
  project: BusinessProject,
  target: ImageTargetRef,
): BusinessProject {
  switch (target.kind) {
    case "hero":
      return { ...project, heroImageId: null };
    case "logo":
      return { ...project, logo: null, logoAssetId: null };
    case "gallery": {
      const ids = cloneGalleryIds(project);
      ids[target.index] = "";
      return { ...project, galleryImageIds: ids };
    }
    case "section": {
      const sectionImages = { ...(project.sectionImages ?? {}) };
      sectionImages[target.section] = null;
      return { ...project, sectionImages };
    }
    case "placeholder":
      if (target.placeholder === "hero") {
        return { ...project, heroImageId: null };
      }
      if (target.placeholder === "logo") {
        return { ...project, logo: null, logoAssetId: null };
      }
      if (target.placeholder.startsWith("gallery")) {
        const idx = Number.parseInt(target.placeholder.split("-")[1] ?? "0", 10);
        const ids = cloneGalleryIds(project);
        ids[idx] = "";
        return { ...project, galleryImageIds: ids };
      }
      return clearTarget(project, {
        kind: "section",
        section: target.placeholder as SectionImageSlot,
      });
    case "library":
    case "ordinal":
      return project;
    default:
      return project;
  }
}

function setGallerySlot(
  project: BusinessProject,
  index: number,
  assetId: string,
): BusinessProject {
  const ids = cloneGalleryIds(project);
  ids[index] = assetId;
  return { ...project, galleryImageIds: ids };
}

function setLogoFromAsset(
  project: BusinessProject,
  assetId: string | null,
): BusinessProject {
  if (!assetId) {
    return { ...project, logo: null, logoAssetId: null };
  }
  const url = resolveMediaUrl(project.mediaLibrary, assetId);
  return {
    ...project,
    logoAssetId: assetId,
    logo: url,
  };
}

function defaultSectionOrder(project: BusinessProject): string[] {
  const template = getTemplate(project.templateId || "modern");
  const design = project.designSections?.enabled ?? [];
  return [...template.sectionOrder, ...design];
}

function moveSectionInOrder(
  order: string[],
  section: string,
  position: string,
  relativeTo?: string,
): string[] {
  const without = order.filter((id) => id !== section);
  if (position === "top") return [section, ...without];
  if (position === "bottom") return [...without, section];
  if (!relativeTo) return [...without, section];

  const anchor = without.indexOf(relativeTo);
  if (anchor < 0) return [...without, section];

  if (position === "above" || position === "before") {
    const next = [...without];
    next.splice(anchor, 0, section);
    return next;
  }
  if (position === "below" || position === "after" || position === "next_to") {
    const next = [...without];
    next.splice(anchor + 1, 0, section);
    return next;
  }
  return [...without, section];
}

/**
 * Apply a validated image operation list. Returns updated project + change bullets.
 */
export function applyImageOperations(
  project: BusinessProject,
  operations: ImageOperation[],
): { project: BusinessProject; changes: ImageChangeSummary[] } {
  let next = { ...project };
  const changes: ImageChangeSummary[] = [];

  for (let i = 0; i < operations.length; i += 1) {
    const op = operations[i]!;
    changes.push(summarize(op, i));

    switch (op.operation) {
      case "replaceHeroImage":
        next = { ...next, heroImageId: op.assetId };
        break;
      case "replaceSectionImage":
      case "setSectionImage":
        if (op.section === "hero") {
          next = { ...next, heroImageId: op.assetId };
        } else if (op.section === "gallery") {
          next = setGallerySlot(next, 0, op.assetId);
        } else {
          next = {
            ...next,
            sectionImages: {
              ...(next.sectionImages ?? {}),
              [op.section]: op.assetId,
            },
          };
        }
        break;
      case "replaceGalleryImage":
        next = setGallerySlot(next, op.index, op.assetId);
        break;
      case "insertImage":
        if (op.galleryIndex !== undefined) {
          next = setGallerySlot(next, op.galleryIndex, op.assetId);
        } else if (op.section) {
          next = {
            ...next,
            sectionImages: {
              ...(next.sectionImages ?? {}),
              [op.section]: op.assetId,
            },
          };
        }
        break;
      case "deleteImage":
        next = clearTarget(next, op.target);
        break;
      case "moveImage": {
        const assetId = resolveTargetAssetId(next, op.from);
        if (!assetId) break;
        const cleared = clearTarget(next, op.from);
        if (op.to.kind === "hero") {
          next = { ...cleared, heroImageId: assetId };
        } else if (op.to.kind === "gallery") {
          next = setGallerySlot(cleared, op.to.index, assetId);
        } else if (op.to.kind === "section") {
          next = {
            ...cleared,
            sectionImages: {
              ...(cleared.sectionImages ?? {}),
              [op.to.section]: assetId,
            },
          };
        } else if (op.to.kind === "logo") {
          next = setLogoFromAsset(cleared, assetId);
        } else {
          next = cleared;
        }
        break;
      }
      case "moveGallery": {
        const order = next.sectionOrder?.length
          ? [...next.sectionOrder]
          : defaultSectionOrder(next);
        const withGallery = order.includes("gallery")
          ? order
          : [...order, "gallery"];
        next = {
          ...next,
          sectionOrder: moveSectionInOrder(
            withGallery,
            "gallery",
            op.position,
            op.relativeTo,
          ),
        };
        break;
      }
      case "replacePlaceholder": {
        if (op.placeholder === "all") {
          next = { ...next, heroImageId: op.assetId };
          const ids = cloneGalleryIds(next).map((id) => (id ? id : op.assetId));
          next = { ...next, galleryImageIds: ids };
        } else if (op.placeholder === "hero") {
          next = { ...next, heroImageId: op.assetId };
        } else if (op.placeholder === "logo") {
          next = setLogoFromAsset(next, op.assetId);
        } else if (op.placeholder.startsWith("gallery")) {
          const idx =
            op.placeholder === "gallery"
              ? 0
              : Number.parseInt(op.placeholder.split("-")[1] ?? "0", 10);
          next = setGallerySlot(next, idx, op.assetId);
        } else {
          next = {
            ...next,
            sectionImages: {
              ...(next.sectionImages ?? {}),
              [op.placeholder]: op.assetId,
            },
          };
        }
        break;
      }
      case "setLogo":
        next = setLogoFromAsset(next, op.assetId);
        break;
      case "removeSectionImage":
        if (op.section === "hero") {
          next = { ...next, heroImageId: null };
        } else if (op.section === "gallery") {
          next = { ...next, galleryImageIds: [] };
        } else {
          next = {
            ...next,
            sectionImages: {
              ...(next.sectionImages ?? {}),
              [op.section]: null,
            },
          };
        }
        break;
      default: {
        const _exhaustive: never = op;
        void _exhaustive;
        break;
      }
    }
  }

  next = {
    ...next,
    galleryImageIds: cloneGalleryIds(next),
  };

  return { project: next, changes };
}
