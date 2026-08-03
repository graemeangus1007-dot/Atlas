/**
 * Resolve conversational attachment references into ImageOperations.
 */

import type { AttachmentContext } from "@/lib/ai/conversation-attachments";
import type { ImageOperation } from "@/lib/ai/image-operations";
import type { BusinessProject } from "@/types/business-project";
import { GALLERY_SLOT_COUNT } from "@/types/media";

export type AttachmentResolution =
  | {
      ok: true;
      operations: ImageOperation[];
      explanation: string;
    }
  | {
      ok: false;
      needsClarification: true;
      explanation: string;
    }
  | {
      ok: false;
      needsClarification: false;
      explanation: string;
    };

function ordinalToIndex(text: string): number | null {
  if (/\b(first|1st)\b/i.test(text)) return 0;
  if (/\b(second|2nd)\b/i.test(text)) return 1;
  if (/\b(third|3rd)\b/i.test(text)) return 2;
  if (/\b(fourth|4th)\b/i.test(text)) return 3;
  if (/\b(fifth|5th)\b/i.test(text)) return 4;
  const n = text.match(/\b(?:image|photo|picture|attachment)\s*#?\s*(\d+)\b/i);
  if (n?.[1]) {
    const idx = Number.parseInt(n[1], 10) - 1;
    return idx >= 0 ? idx : null;
  }
  return null;
}

function pickAttachment(
  contexts: AttachmentContext[],
  request: string,
):
  | { ok: true; ctx: AttachmentContext }
  | { ok: false; clarify?: string; none?: true } {
  if (contexts.length === 0) return { ok: false, none: true };

  const logos = contexts.filter((c) => c.type === "logo");
  if (/\blogo\b/i.test(request) && logos.length === 1) {
    return { ok: true, ctx: logos[0]! };
  }
  if (/\blogo\b/i.test(request) && logos.length > 1) {
    return {
      ok: false,
      clarify: "You attached more than one logo. Which should I use?",
    };
  }

  const ordinal = ordinalToIndex(request);
  if (ordinal != null) {
    const ctx = contexts[ordinal];
    if (!ctx) {
      return {
        ok: false,
        clarify: `You only attached ${contexts.length} photo${contexts.length === 1 ? "" : "s"}. Which one should I use?`,
      };
    }
    return { ok: true, ctx };
  }

  if (
    /\b(this|that|it|the\s+photo|the\s+image|the\s+upload)\b/i.test(request) ||
    /\buse\s+this\b/i.test(request)
  ) {
    if (contexts.length === 1) return { ok: true, ctx: contexts[0]! };
    return {
      ok: false,
      clarify: `You attached ${contexts.length} photos. Which one should I use—the first or second${contexts.length > 2 ? ", or another" : ""}?`,
    };
  }

  if (/\bthese\b/i.test(request) || /\ball\b/i.test(request)) {
    return { ok: true, ctx: contexts[0]! }; // multi handled by caller
  }

  if (contexts.length === 1) return { ok: true, ctx: contexts[0]! };

  return {
    ok: false,
    clarify: `You attached ${contexts.length} photos. Which one should I use as the target?`,
  };
}

/**
 * Map a user request + uploaded attachment context to image operations.
 * Returns null when the request is not attachment-placement related.
 */
export function resolveAttachmentImageRequest(input: {
  request: string;
  attachments: AttachmentContext[];
  project: BusinessProject;
}): AttachmentResolution | null {
  const text = input.request.trim();
  if (!text || input.attachments.length === 0) return null;

  const isPlacement =
    /\b(hero|logo|gallery|about|use\s+this|use\s+the|replace|put\s+this|add\s+these|as\s+the\s+hero|as\s+our\s+logo)\b/i.test(
      text,
    );
  if (!isPlacement) return null;

  // Gallery — all photos
  if (
    /\bgallery\b/i.test(text) &&
    /\b(add|put|use|these|photos?|images?)\b/i.test(text)
  ) {
    const images = input.attachments.filter((a) => a.type === "image");
    if (images.length === 0) {
      return {
        ok: false,
        needsClarification: false,
        explanation: "Attach photo files to add them to the gallery.",
      };
    }
    const filled = (input.project.galleryImageIds ?? []).filter(Boolean).length;
    const operations: ImageOperation[] = [];
    let slot = filled;
    for (const ctx of images) {
      if (slot >= GALLERY_SLOT_COUNT) break;
      operations.push({
        operation: "insertImage",
        assetId: ctx.assetId,
        galleryIndex: slot,
      });
      slot += 1;
    }
    if (operations.length === 0) {
      return {
        ok: false,
        needsClarification: false,
        explanation:
          "The gallery is already full. Remove a gallery photo first, then try again.",
      };
    }
    const placed = operations.length;
    const skipped = images.length - placed;
    return {
      ok: true,
      operations,
      explanation:
        skipped > 0
          ? `Done. I added ${placed} uploaded photo${placed === 1 ? "" : "s"} to the gallery. ${skipped} could not fit in the remaining slots.`
          : `Done. I added ${placed} uploaded photo${placed === 1 ? "" : "s"} to the gallery and saved ${placed === 1 ? "it" : "them"} with the project.`,
    };
  }

  // Logo
  if (/\blogo\b/i.test(text)) {
    const picked = pickAttachment(input.attachments, text);
    if (!picked.ok) {
      return {
        ok: false,
        needsClarification: true,
        explanation: picked.clarify ?? "Which attachment should be the logo?",
      };
    }
    return {
      ok: true,
      operations: [{ operation: "setLogo", assetId: picked.ctx.assetId }],
      explanation:
        "Done. I used the uploaded image as the logo and saved it with the project.",
    };
  }

  // About section
  if (/\babout\b/i.test(text)) {
    const picked = pickAttachment(input.attachments, text);
    if (!picked.ok) {
      return {
        ok: false,
        needsClarification: true,
        explanation: picked.clarify ?? "Which photo should go in About?",
      };
    }
    return {
      ok: true,
      operations: [
        {
          operation: "setSectionImage",
          section: "about",
          assetId: picked.ctx.assetId,
        },
      ],
      explanation:
        "Done. I placed the uploaded photo in the About section and saved it with the project.",
    };
  }

  // Hero / replace hero
  if (/\bhero\b/i.test(text) || /\breplace\b/i.test(text)) {
    const picked = pickAttachment(input.attachments, text);
    if (!picked.ok) {
      return {
        ok: false,
        needsClarification: true,
        explanation:
          picked.clarify ??
          "You attached multiple photos. Which one should I use as the hero—the first or second?",
      };
    }
    return {
      ok: true,
      operations: [
        { operation: "replaceHeroImage", assetId: picked.ctx.assetId },
      ],
      explanation:
        "Done. I used the uploaded photo as the hero image and saved it with the project.",
    };
  }

  return null;
}

/** Ensure every operation's asset exists on the project media library. */
export function attachmentAssetsPresent(
  project: BusinessProject,
  operations: ImageOperation[],
): { ok: true } | { ok: false; missing: string[] } {
  const ids = new Set(
    (project.mediaLibrary ?? [])
      .filter((a) => !a.unavailable)
      .map((a) => a.id),
  );
  const missing: string[] = [];
  for (const op of operations) {
    if ("assetId" in op && typeof op.assetId === "string" && !ids.has(op.assetId)) {
      missing.push(op.assetId);
    }
  }
  if (missing.length) return { ok: false, missing };
  return { ok: true };
}
