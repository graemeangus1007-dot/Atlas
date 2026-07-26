"use client";

import { useState } from "react";
import ImageGrid from "@/components/media/image-grid";
import ImageUploader from "@/components/media/image-uploader";
import {
  isAcceptedImageFile,
  revokeMediaUrl,
  updateMediaAssetMeta,
} from "@/lib/media";
import { deleteProjectMedia, uploadProjectMedia } from "@/lib/supabase/storage";
import type { BusinessProject } from "@/types/business-project";
import type { MediaAsset, MediaAssetMeta } from "@/types/media";
import { GALLERY_SLOT_COUNT } from "@/types/media";

type MediaLibraryProps = {
  project: BusinessProject;
  projectId: string | null;
  onChange: (partial: Partial<BusinessProject>) => void;
};

/**
 * Atlas Media Library panel — upload to Supabase Storage, manage, assign images.
 */
export default function MediaLibrary({
  project,
  projectId,
  onChange,
}: MediaLibraryProps) {
  const isEmpty = project.mediaLibrary.length === 0;
  const [actionError, setActionError] = useState<string | null>(null);
  const [replacingId, setReplacingId] = useState<string | null>(null);

  function handleUploaded(assets: MediaAsset[]) {
    setActionError(null);
    // Durable Storage URLs only — triggers Context autosave.
    onChange({ mediaLibrary: [...assets, ...project.mediaLibrary] });
  }

  function handleSetHero(id: string) {
    setActionError(null);
    const nextId = project.heroImageId === id ? null : id;
    const asset = nextId
      ? project.mediaLibrary.find((item) => item.id === nextId)
      : null;

    if (asset?.unavailable) {
      setActionError(
        "This image is no longer available. Re-upload it to use as the hero.",
      );
      return;
    }

    onChange({ heroImageId: nextId });
  }

  function handleToggleGallery(id: string) {
    setActionError(null);
    const asset = project.mediaLibrary.find((item) => item.id === id);
    if (asset?.unavailable) {
      setActionError(
        "This image is no longer available. Re-upload it to use in the gallery.",
      );
      return;
    }

    const current = project.galleryImageIds;
    if (current.includes(id)) {
      onChange({ galleryImageIds: current.filter((item) => item !== id) });
      return;
    }

    if (current.length >= GALLERY_SLOT_COUNT) {
      onChange({
        galleryImageIds: [...current.slice(1), id],
      });
      return;
    }

    onChange({ galleryImageIds: [...current, id] });
  }

  async function handleReplace(id: string, file: File) {
    if (!isAcceptedImageFile(file)) return;
    if (!projectId) {
      setActionError("Open or create a project before replacing media.");
      return;
    }

    setActionError(null);
    setReplacingId(id);

    const existing = project.mediaLibrary.find((asset) => asset.id === id);
    const result = await uploadProjectMedia(projectId, file);

    if (!result.ok) {
      setActionError(result.error);
      setReplacingId(null);
      return;
    }

    if (existing?.storagePath) {
      const removed = await deleteProjectMedia(existing.storagePath);
      if (!removed.ok) {
        // New file is already uploaded; surface a soft warning.
        setActionError(
          "Image replaced, but the previous file could not be removed from storage.",
        );
      }
    }

    if (existing) revokeMediaUrl(existing.url);

    const mediaLibrary = project.mediaLibrary.map((asset) => {
      if (asset.id !== id) return asset;
      return {
        ...result.data,
        id: asset.id,
        title: asset.title,
        description: asset.description,
        alt: asset.alt,
      };
    });

    onChange({ mediaLibrary });
    setReplacingId(null);
  }

  function handleMetaChange(id: string, meta: Partial<MediaAssetMeta>) {
    onChange({
      mediaLibrary: updateMediaAssetMeta(project.mediaLibrary, id, meta),
    });
  }

  async function handleDelete(id: string) {
    setActionError(null);
    const removed = project.mediaLibrary.find((asset) => asset.id === id);

    if (removed?.storagePath) {
      const storageResult = await deleteProjectMedia(removed.storagePath);
      if (!storageResult.ok) {
        setActionError(
          `${storageResult.error} The image was removed from this project anyway.`,
        );
      }
    }

    if (removed) revokeMediaUrl(removed.url);

    onChange({
      mediaLibrary: project.mediaLibrary.filter((asset) => asset.id !== id),
      heroImageId: project.heroImageId === id ? null : project.heroImageId,
      galleryImageIds: project.galleryImageIds.filter((item) => item !== id),
    });
  }

  return (
    <aside
      className="flex h-full max-h-[calc(100vh-8rem)] w-full flex-col overflow-hidden rounded-2xl border border-border bg-surface/80 backdrop-blur-xl lg:sticky lg:top-4 lg:rounded-2xl lg:rounded-r-none lg:border-r-0"
      aria-label="Media Library"
    >
      <div className="border-b border-border px-4 py-4">
        <h2 className="font-[family-name:var(--font-atlas-display)] text-sm font-semibold text-foreground">
          Media Library
        </h2>
        <p className="mt-1 text-xs text-muted">
          Upload photos to secure storage, set a hero image, and pick gallery
          images.
        </p>
      </div>

      <div className="flex-1 space-y-6 overflow-y-auto p-4">
        {actionError ? (
          <p className="text-xs text-red-400" role="alert">
            {actionError}
          </p>
        ) : null}

        {!projectId ? (
          <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
            Save or open a project to upload media to cloud storage.
          </p>
        ) : null}

        {isEmpty ? (
          <ImageUploader
            projectId={projectId}
            onUploaded={handleUploaded}
            emptyState
          />
        ) : (
          <>
            <section aria-labelledby="media-upload-heading">
              <h3
                id="media-upload-heading"
                className="mb-2 text-xs font-medium uppercase tracking-wide text-muted"
              >
                Upload
              </h3>
              <ImageUploader
                projectId={projectId}
                onUploaded={handleUploaded}
              />
            </section>

            <section aria-labelledby="media-library-heading" className="space-y-2">
              <h3
                id="media-library-heading"
                className="text-xs font-medium uppercase tracking-wide text-muted"
              >
                Library ({project.mediaLibrary.length})
                {replacingId ? " · Replacing…" : ""}
              </h3>
              <ImageGrid
                assets={project.mediaLibrary}
                heroImageId={project.heroImageId}
                galleryImageIds={project.galleryImageIds}
                onSetHero={handleSetHero}
                onToggleGallery={handleToggleGallery}
                onReplace={(id, file) => void handleReplace(id, file)}
                onDelete={(id) => void handleDelete(id)}
                onMetaChange={handleMetaChange}
              />
            </section>
          </>
        )}
      </div>
    </aside>
  );
}
