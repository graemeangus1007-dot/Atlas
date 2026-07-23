"use client";

import ImageGrid from "@/components/media/image-grid";
import ImageUploader from "@/components/media/image-uploader";
import {
  createMediaAssetFromFile,
  isAcceptedImageFile,
  revokeMediaUrl,
  updateMediaAssetMeta,
} from "@/lib/media";
import type { BusinessProject } from "@/types/business-project";
import type { MediaAsset, MediaAssetMeta } from "@/types/media";
import { GALLERY_SLOT_COUNT } from "@/types/media";

type MediaLibraryProps = {
  project: BusinessProject;
  onChange: (partial: Partial<BusinessProject>) => void;
};

/**
 * Atlas Media Library panel — upload, manage, and assign site images.
 */
export default function MediaLibrary({ project, onChange }: MediaLibraryProps) {
  const isEmpty = project.mediaLibrary.length === 0;

  function handleUploaded(assets: MediaAsset[]) {
    onChange({ mediaLibrary: [...assets, ...project.mediaLibrary] });
  }

  function handleSetHero(id: string) {
    onChange({
      heroImageId: project.heroImageId === id ? null : id,
    });
  }

  function handleToggleGallery(id: string) {
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

  function handleReplace(id: string, file: File) {
    if (!isAcceptedImageFile(file)) return;

    const nextAsset = createMediaAssetFromFile(file);
    const mediaLibrary = project.mediaLibrary.map((asset) => {
      if (asset.id !== id) return asset;
      revokeMediaUrl(asset.url);
      return {
        ...nextAsset,
        id: asset.id,
        /* Keep editable metadata when swapping the file bytes. */
        title: asset.title,
        description: asset.description,
        alt: asset.alt,
      };
    });

    onChange({ mediaLibrary });
  }

  function handleMetaChange(id: string, meta: Partial<MediaAssetMeta>) {
    onChange({
      mediaLibrary: updateMediaAssetMeta(project.mediaLibrary, id, meta),
    });
  }

  function handleDelete(id: string) {
    const removed = project.mediaLibrary.find((asset) => asset.id === id);
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
          Upload photos, set a hero image, and pick gallery images. The preview
          updates instantly.
        </p>
      </div>

      <div className="flex-1 space-y-6 overflow-y-auto p-4">
        {isEmpty ? (
          <ImageUploader onUploaded={handleUploaded} emptyState />
        ) : (
          <>
            <section aria-labelledby="media-upload-heading">
              <h3
                id="media-upload-heading"
                className="mb-2 text-xs font-medium uppercase tracking-wide text-muted"
              >
                Upload
              </h3>
              <ImageUploader onUploaded={handleUploaded} />
            </section>

            <section aria-labelledby="media-library-heading" className="space-y-2">
              <h3
                id="media-library-heading"
                className="text-xs font-medium uppercase tracking-wide text-muted"
              >
                Library ({project.mediaLibrary.length})
              </h3>
              <ImageGrid
                assets={project.mediaLibrary}
                heroImageId={project.heroImageId}
                galleryImageIds={project.galleryImageIds}
                onSetHero={handleSetHero}
                onToggleGallery={handleToggleGallery}
                onReplace={handleReplace}
                onDelete={handleDelete}
                onMetaChange={handleMetaChange}
              />
            </section>
          </>
        )}
      </div>
    </aside>
  );
}
