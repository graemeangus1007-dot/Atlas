"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  allAttachmentsReady,
  anyAttachmentUploading,
  attachmentsToContext,
  createQueuedAttachment,
  isComposerImageMime,
  MAX_COMPOSER_ATTACHMENTS,
  readImageDimensions,
  revokeLocalObjectUrl,
  toPersistedAttachment,
  validateComposerImageFile,
  type ConversationAttachment,
} from "@/lib/ai/conversation-attachments";
import { uploadProjectMedia } from "@/lib/supabase/storage";
import type { MediaAsset } from "@/types/media";

export type UseComposerAttachmentsOptions = {
  projectId: string | null;
  /** Called when an upload finishes so the project media library can merge the asset. */
  onAssetUploaded?: (asset: MediaAsset) => void;
};

export function useComposerAttachments({
  projectId,
  onAssetUploaded,
}: UseComposerAttachmentsOptions) {
  const [attachments, setAttachments] = useState<ConversationAttachment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const filesRef = useRef<Map<string, File>>(new Map());
  const uploadingRef = useRef<Set<string>>(new Set());
  const onAssetUploadedRef = useRef(onAssetUploaded);

  useEffect(() => {
    onAssetUploadedRef.current = onAssetUploaded;
  }, [onAssetUploaded]);

  const updateAttachment = useCallback(
    (id: string, patch: Partial<ConversationAttachment>) => {
      setAttachments((prev) =>
        prev.map((item) => (item.id === id ? { ...item, ...patch } : item)),
      );
    },
    [],
  );

  const uploadOne = useCallback(
    async (attachmentId: string) => {
      const file = filesRef.current.get(attachmentId);
      const pid = projectId?.trim();
      if (!file || !pid) {
        updateAttachment(attachmentId, {
          status: "failed",
          errorMessage: pid
            ? "That photo is no longer available to upload."
            : "Open a project before attaching photos.",
        });
        return;
      }
      if (uploadingRef.current.has(attachmentId)) return;
      uploadingRef.current.add(attachmentId);
      updateAttachment(attachmentId, {
        status: "uploading",
        errorMessage: undefined,
      });

      try {
        let titleIndex = 0;
        setAttachments((prev) => {
          titleIndex = Math.max(
            0,
            prev.findIndex((item) => item.id === attachmentId),
          );
          return prev;
        });
        const result = await uploadProjectMedia(pid, file, { titleIndex });
        if (!result.ok) {
          updateAttachment(attachmentId, {
            status: "failed",
            errorMessage: result.error,
          });
          return;
        }
        const asset = result.data;
        onAssetUploadedRef.current?.(asset);
        setAttachments((prev) =>
          prev.map((item) => {
            if (item.id !== attachmentId) return item;
            revokeLocalObjectUrl(item);
            return {
              ...item,
              status: "uploaded" as const,
              assetId: asset.id,
              storagePath: asset.storagePath ?? undefined,
              previewUrl: asset.url,
              localObjectUrl: undefined,
              altText: asset.title || asset.alt,
              errorMessage: undefined,
            };
          }),
        );
        filesRef.current.delete(attachmentId);
      } finally {
        uploadingRef.current.delete(attachmentId);
      }
    },
    [projectId, updateAttachment],
  );

  const enqueueFiles = useCallback(
    async (
      files: File[],
      type: "image" | "logo",
    ): Promise<ConversationAttachment[]> => {
      setError(null);
      const pid = projectId?.trim();
      if (!pid) {
        setError("Open a project before attaching photos.");
        return [];
      }

      const room = MAX_COMPOSER_ATTACHMENTS - attachments.length;
      if (room <= 0) {
        setError(
          `You can attach up to ${MAX_COMPOSER_ATTACHMENTS} photos per message.`,
        );
        return [];
      }

      const selected =
        type === "logo" ? files.slice(0, 1) : files.slice(0, room);
      if (type !== "logo" && files.length > room) {
        setError(
          `Only ${room} more photo${room === 1 ? "" : "s"} can be attached to this message.`,
        );
      }

      const created: ConversationAttachment[] = [];
      const baseIndex = type === "logo" ? 0 : attachments.length;
      for (const file of selected) {
        const validated = validateComposerImageFile(file);
        if (!validated.ok) {
          setError(validated.error);
          continue;
        }
        const dims = await readImageDimensions(file);
        if (dims && !dims.ok) {
          setError(dims.error);
          continue;
        }

        const attachment = createQueuedAttachment({
          file,
          projectId: pid,
          type,
          titleIndex: baseIndex + created.length,
        });
        if (dims?.ok) {
          attachment.width = dims.width;
          attachment.height = dims.height;
        }
        filesRef.current.set(attachment.id, file);
        created.push(attachment);
      }

      if (created.length === 0) return [];

      setAttachments((prev) => {
        if (type === "logo") {
          // Replace any existing logo attachment.
          const withoutLogo = prev.filter((a) => a.type !== "logo");
          for (const old of prev.filter((a) => a.type === "logo")) {
            revokeLocalObjectUrl(old);
            filesRef.current.delete(old.id);
          }
          return [...withoutLogo, ...created].slice(0, MAX_COMPOSER_ATTACHMENTS);
        }
        return [...prev, ...created].slice(0, MAX_COMPOSER_ATTACHMENTS);
      });

      for (const att of created) {
        void uploadOne(att.id);
      }
      return created;
    },
    [attachments.length, projectId, uploadOne],
  );

  const attachExistingAssets = useCallback(
    (assets: MediaAsset[], type: "image" | "logo" = "image") => {
      setError(null);
      const pid = projectId?.trim();
      if (!pid) {
        setError("Open a project before attaching photos.");
        return;
      }
      const available = assets.filter((a) => !a.unavailable && a.id);
      if (available.length === 0) {
        setError("No project images are available to attach.");
        return;
      }

      setAttachments((prev) => {
        const room = MAX_COMPOSER_ATTACHMENTS - prev.length;
        const slice =
          type === "logo" ? available.slice(0, 1) : available.slice(0, room);
        if (slice.length === 0) {
          setError(
            `You can attach up to ${MAX_COMPOSER_ATTACHMENTS} photos per message.`,
          );
          return prev;
        }
        const nextItems: ConversationAttachment[] = slice.map((asset) => ({
          id: `existing-${asset.id}-${Date.now()}`,
          type,
          projectId: pid,
          assetId: asset.id,
          storagePath: asset.storagePath ?? undefined,
          previewUrl: asset.url.startsWith("blob:") ? undefined : asset.url,
          filename: asset.name || asset.filename,
          mimeType: asset.mimeType,
          sizeBytes: asset.size,
          altText: asset.alt || asset.title,
          status: "uploaded" as const,
          createdAt: new Date().toISOString(),
        }));
        if (type === "logo") {
          for (const old of prev.filter((a) => a.type === "logo")) {
            revokeLocalObjectUrl(old);
            filesRef.current.delete(old.id);
          }
          return [
            ...prev.filter((a) => a.type !== "logo"),
            ...nextItems,
          ].slice(0, MAX_COMPOSER_ATTACHMENTS);
        }
        return [...prev, ...nextItems].slice(0, MAX_COMPOSER_ATTACHMENTS);
      });
    },
    [projectId],
  );

  const removeAttachment = useCallback((id: string) => {
    setAttachments((prev) => {
      const target = prev.find((a) => a.id === id);
      if (target) revokeLocalObjectUrl(target);
      filesRef.current.delete(id);
      return prev.filter((a) => a.id !== id);
    });
  }, []);

  const retryAttachment = useCallback(
    (id: string) => {
      const file = filesRef.current.get(id);
      if (!file) {
        updateAttachment(id, {
          status: "failed",
          errorMessage: "Re-select the photo to try uploading again.",
        });
        return;
      }
      void uploadOne(id);
    },
    [updateAttachment, uploadOne],
  );

  const moveAttachment = useCallback((id: string, direction: -1 | 1) => {
    setAttachments((prev) => {
      const index = prev.findIndex((a) => a.id === id);
      if (index < 0) return prev;
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= prev.length) return prev;
      const copy = [...prev];
      const [item] = copy.splice(index, 1);
      copy.splice(nextIndex, 0, item!);
      return copy;
    });
  }, []);

  const clearAttachments = useCallback(() => {
    setAttachments((prev) => {
      for (const att of prev) revokeLocalObjectUrl(att);
      return [];
    });
    filesRef.current.clear();
    setError(null);
  }, []);

  const ingestDroppedOrPastedFiles = useCallback(
    (files: File[]) => {
      const images = files.filter((f) => isComposerImageMime(f.type));
      if (images.length === 0) {
        if (files.length > 0) {
          setError("Please use a JPEG, PNG, or WebP image.");
        }
        return;
      }
      void enqueueFiles(images, "image");
    },
    [enqueueFiles],
  );

  const attachmentsRef = useRef(attachments);

  useEffect(() => {
    attachmentsRef.current = attachments;
  }, [attachments]);

  useEffect(() => {
    const files = filesRef.current;
    return () => {
      for (const att of attachmentsRef.current) revokeLocalObjectUrl(att);
      files.clear();
    };
  }, []);

  return {
    attachments,
    error,
    setError,
    enqueueFiles,
    attachExistingAssets,
    removeAttachment,
    retryAttachment,
    moveAttachment,
    clearAttachments,
    ingestDroppedOrPastedFiles,
    ready: allAttachmentsReady(attachments),
    uploading: anyAttachmentUploading(attachments),
    contexts: attachmentsToContext(attachments),
    persistedForMessage: () =>
      attachments
        .map(toPersistedAttachment)
        .filter((a): a is ConversationAttachment => Boolean(a)),
  };
}
