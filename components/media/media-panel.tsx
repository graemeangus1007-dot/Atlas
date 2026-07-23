"use client";

import MediaGrid from "@/components/media/media-grid";
import MediaUploadZone from "@/components/media/media-upload-zone";
import type { BusinessProject } from "@/types/business-project";
import type { GalleryImageUrls, MediaAsset } from "@/types/media";
import { GALLERY_SLOT_COUNT } from "@/types/media";

type MediaPanelProps = {
  project: BusinessProject;
  onChange: (partial: Partial<BusinessProject>) => void;
};

/**
 * Media Library — upload, browse, and assign images to hero / gallery.
 */
export default function MediaPanel({ project, onChange }: MediaPanelProps) {
  function handleUploaded(asset: MediaAsset) {
    onChange({ mediaLibrary: [asset, ...project.mediaLibrary] });
  }

  function handleSetHero(url: string) {
    onChange({ heroImageUrl: url });
  }

  function handleClearHero() {
    onChange({ heroImageUrl: null });
  }

  function handleSetGallery(slotIndex: number, url: string) {
    const next = [...project.galleryImageUrls] as GalleryImageUrls;
    next[slotIndex] = url;
    onChange({ galleryImageUrls: next });
  }

  function handleClearGallery(slotIndex: number) {
    const next = [...project.galleryImageUrls] as GalleryImageUrls;
    next[slotIndex] = null;
    onChange({ galleryImageUrls: next });
  }

  function handleRemove(id: string) {
    const removed = project.mediaLibrary.find((asset) => asset.id === id);
    const mediaLibrary = project.mediaLibrary.filter((asset) => asset.id !== id);

    const partial: Partial<BusinessProject> = { mediaLibrary };

    if (removed && project.heroImageUrl === removed.url) {
      partial.heroImageUrl = null;
    }

    if (removed) {
      const next = [...project.galleryImageUrls] as GalleryImageUrls;
      let changed = false;
      for (let i = 0; i < GALLERY_SLOT_COUNT; i += 1) {
        if (next[i] === removed.url) {
          next[i] = null;
          changed = true;
        }
      }
      if (changed) partial.galleryImageUrls = next;
    }

    onChange(partial);
  }

  return (
    <aside
      className="flex h-full max-h-[calc(100vh-8rem)] w-full flex-col overflow-hidden rounded-2xl border border-border bg-surface/80 backdrop-blur-xl lg:sticky lg:top-4 lg:rounded-2xl lg:rounded-r-none lg:border-r-0"
      aria-label="Media Library"
    >
      <div className="border-b border-border px-4 py-4">
        <p className="font-[family-name:var(--font-atlas-display)] text-sm font-semibold text-foreground">
          Media Library
        </p>
        <p className="mt-1 text-xs text-muted">
          Upload photos and assign them to the hero or gallery. Preview updates
          live.
        </p>
      </div>

      <div className="flex-1 space-y-6 overflow-y-auto p-4">
        <section>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
            Upload
          </p>
          <MediaUploadZone onUploaded={handleUploaded} />
        </section>

        <section className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted">
              Hero image
            </p>
            {project.heroImageUrl ? (
              <button
                type="button"
                onClick={handleClearHero}
                className="text-[11px] text-muted transition-colors hover:text-foreground"
              >
                Use placeholder
              </button>
            ) : null}
          </div>
          <div className="overflow-hidden rounded-xl border border-border bg-background/40">
            <div className="relative aspect-[16/9] bg-surface">
              {project.heroImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={project.heroImageUrl}
                  alt="Current hero"
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full items-center justify-center bg-gradient-to-br from-[color:var(--site-accent)]/20 to-surface px-3 text-center text-xs text-muted">
                  Placeholder hero in use
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">
            Gallery slots
          </p>
          <ul className="grid grid-cols-2 gap-2">
            {Array.from({ length: GALLERY_SLOT_COUNT }, (_, index) => {
              const url = project.galleryImageUrls[index];
              return (
                <li
                  key={index}
                  className="overflow-hidden rounded-xl border border-border bg-background/40"
                >
                  <div className="relative aspect-square bg-surface">
                    {url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={url}
                        alt={`Gallery slot ${index + 1}`}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center bg-gradient-to-br from-white/5 to-surface text-[10px] text-muted">
                        Slot {index + 1}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center justify-between px-2 py-1.5">
                    <span className="text-[10px] text-muted">G{index + 1}</span>
                    {url ? (
                      <button
                        type="button"
                        onClick={() => handleClearGallery(index)}
                        className="text-[10px] text-muted hover:text-foreground"
                      >
                        Clear
                      </button>
                    ) : (
                      <span className="text-[10px] text-muted">Placeholder</span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">
            Library ({project.mediaLibrary.length})
          </p>
          <MediaGrid
            assets={project.mediaLibrary}
            heroImageUrl={project.heroImageUrl}
            galleryImageUrls={project.galleryImageUrls}
            onSetHero={handleSetHero}
            onSetGallery={handleSetGallery}
            onRemove={handleRemove}
          />
        </section>
      </div>
    </aside>
  );
}
