/**
 * Conversational attachments for the Atlas composer (v1.3).
 * Images/logos only this phase; model is extensible for documents later.
 */

import { deriveDisplayTitle } from "@/lib/media-titles";
import { MAX_PROJECT_MEDIA_BYTES } from "@/types/media";

export type ConversationAttachmentType = "image" | "logo" | "document";

export type ConversationAttachmentStatus =
  | "queued"
  | "uploading"
  | "uploaded"
  | "failed";

export type ConversationAttachment = {
  id: string;
  type: ConversationAttachmentType;
  projectId: string;
  assetId?: string;
  storagePath?: string;
  /** Signed or display URL for preview — never the persisted source of truth. */
  previewUrl?: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  width?: number;
  height?: number;
  altText?: string;
  status: ConversationAttachmentStatus;
  errorMessage?: string;
  createdAt: string;
  /** Local-only object URL for in-flight preview; revoke on cleanup. */
  localObjectUrl?: string;
};

/** Safe context sent to the AI after upload (no raw bytes). */
export type AttachmentContext = {
  attachmentId: string;
  assetId: string;
  type: "image" | "logo";
  filename: string;
  width?: number;
  height?: number;
  position: number;
};

export const COMPOSER_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export const COMPOSER_IMAGE_ACCEPT = COMPOSER_IMAGE_MIME_TYPES.join(",");

export const MAX_COMPOSER_ATTACHMENTS = 8;
export const MAX_COMPOSER_ATTACHMENT_BYTES = MAX_PROJECT_MEDIA_BYTES;
export const MAX_COMPOSER_IMAGE_DIMENSION = 8192;

export function createAttachmentId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `att-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function isComposerImageMime(mime: string): boolean {
  return (COMPOSER_IMAGE_MIME_TYPES as readonly string[]).includes(
    mime.toLowerCase(),
  );
}

export function validateComposerImageFile(
  file: File,
  options?: { maxBytes?: number },
): { ok: true } | { ok: false; error: string } {
  if (!file || file.size <= 0) {
    return { ok: false, error: "That file is empty. Choose a photo and try again." };
  }
  if (!isComposerImageMime(file.type)) {
    return {
      ok: false,
      error: "Please use a JPEG, PNG, or WebP image.",
    };
  }
  const max = options?.maxBytes ?? MAX_COMPOSER_ATTACHMENT_BYTES;
  if (file.size > max) {
    const mb = Math.round(max / (1024 * 1024));
    return {
      ok: false,
      error: `That image is too large. Please use a file under ${mb} MB.`,
    };
  }
  return { ok: true };
}

export function createQueuedAttachment(input: {
  file: File;
  projectId: string;
  type: "image" | "logo";
  /** 0-based index within a multi-file attach batch (Photo 1, Photo 2, …). */
  titleIndex?: number;
}): ConversationAttachment {
  const localObjectUrl =
    typeof URL !== "undefined" ? URL.createObjectURL(input.file) : undefined;
  const titleIndex = input.titleIndex ?? 0;
  return {
    id: createAttachmentId(),
    type: input.type,
    projectId: input.projectId,
    filename: input.file.name || `photo-${Date.now()}.jpg`,
    mimeType: input.file.type || "image/jpeg",
    sizeBytes: input.file.size,
    status: "queued",
    createdAt: new Date().toISOString(),
    previewUrl: localObjectUrl,
    localObjectUrl,
    altText: deriveDisplayTitle(input.file.name || "photo.jpg", titleIndex),
  };
}

/** Persistable snapshot — never includes blob: or localObjectUrl. */
export function toPersistedAttachment(
  attachment: ConversationAttachment,
): ConversationAttachment | null {
  if (attachment.status !== "uploaded" || !attachment.assetId) return null;
  return {
    id: attachment.id,
    type: attachment.type === "document" ? "image" : attachment.type,
    projectId: attachment.projectId,
    assetId: attachment.assetId,
    storagePath: attachment.storagePath,
    filename: attachment.filename,
    mimeType: attachment.mimeType,
    sizeBytes: attachment.sizeBytes,
    width: attachment.width,
    height: attachment.height,
    altText: attachment.altText,
    status: "uploaded",
    createdAt: attachment.createdAt,
  };
}

export function attachmentsToContext(
  attachments: ConversationAttachment[],
): AttachmentContext[] {
  const out: AttachmentContext[] = [];
  let position = 0;
  for (const att of attachments) {
    if (att.status !== "uploaded" || !att.assetId) continue;
    if (att.type !== "image" && att.type !== "logo") continue;
    out.push({
      attachmentId: att.id,
      assetId: att.assetId,
      type: att.type,
      filename: att.filename,
      width: att.width,
      height: att.height,
      position,
    });
    position += 1;
  }
  return out;
}

export function allAttachmentsReady(
  attachments: ConversationAttachment[],
): boolean {
  if (attachments.length === 0) return true;
  return attachments.every((a) => a.status === "uploaded" && Boolean(a.assetId));
}

export function anyAttachmentUploading(
  attachments: ConversationAttachment[],
): boolean {
  return attachments.some(
    (a) => a.status === "queued" || a.status === "uploading",
  );
}

export function revokeLocalObjectUrl(attachment: ConversationAttachment): void {
  if (attachment.localObjectUrl && typeof URL !== "undefined") {
    try {
      URL.revokeObjectURL(attachment.localObjectUrl);
    } catch {
      // ignore
    }
  }
}

export function readImageDimensions(
  file: File,
): Promise<
  | { ok: true; width: number; height: number }
  | { ok: false; error: string }
  | null
> {
  if (typeof window === "undefined" || typeof Image === "undefined") {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const width = img.naturalWidth;
      const height = img.naturalHeight;
      URL.revokeObjectURL(url);
      if (width < 1 || height < 1) {
        resolve({ ok: false, error: "That image could not be read. Try another file." });
        return;
      }
      if (
        width > MAX_COMPOSER_IMAGE_DIMENSION ||
        height > MAX_COMPOSER_IMAGE_DIMENSION
      ) {
        resolve({
          ok: false,
          error: `That image is too large in pixels. Please use an image under ${MAX_COMPOSER_IMAGE_DIMENSION}px on each side.`,
        });
        return;
      }
      resolve({ ok: true, width, height });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve({
        ok: false,
        error: "That image could not be read. Try a JPEG, PNG, or WebP file.",
      });
    };
    img.src = url;
  });
}

/** True when the request places composer attachments (even without “image”). */
export function isAttachmentPlacementRequest(request: string): boolean {
  const text = request.trim();
  if (!text) return false;
  return (
    /\b(hero|logo|gallery|about)\b/i.test(text) &&
    /\b(use|put|add|replace|set|move)\b/i.test(text)
  );
}

/** Alias labels for the planner (attachment[0], logoAttachment). */
export function attachmentAlias(context: AttachmentContext): string {
  if (context.type === "logo") return "logoAttachment";
  return `attachment[${context.position}]`;
}

export function formatAttachmentsForAgentPrompt(
  contexts: AttachmentContext[],
): string {
  if (contexts.length === 0) return "";
  const lines = contexts.map((ctx) => {
    const alias = attachmentAlias(ctx);
    return `- ${alias}: assetId=${ctx.assetId} file="${ctx.filename}" type=${ctx.type}`;
  });
  return [
    "Attached media for this message (use these asset ids; do not invent others):",
    ...lines,
  ].join("\n");
}
