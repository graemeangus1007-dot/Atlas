"use client";

import { useId, useRef, type ChangeEvent } from "react";
import MediaMetadataFields from "@/components/media/media-metadata-fields";
import { ACCEPTED_IMAGE_ACCEPT } from "@/data/media";
import type { MediaAsset, MediaAssetMeta } from "@/types/media";

type ImageCardProps = {
  asset: MediaAsset;
  isHero: boolean;
  isGallery: boolean;
  galleryOrder: number | null;
  onSetHero: (id: string) => void;
  onToggleGallery: (id: string) => void;
  onReplace: (id: string, file: File) => void;
  onDelete: (id: string) => void;
  onMetaChange: (id: string, meta: Partial<MediaAssetMeta>) => void;
};

/**
 * Single media library card — preview, metadata, assign / replace / delete.
 */
export default function ImageCard({
  asset,
  isHero,
  isGallery,
  galleryOrder,
  onSetHero,
  onToggleGallery,
  onReplace,
  onDelete,
  onMetaChange,
}: ImageCardProps) {
  const replaceInputId = useId();
  const replaceRef = useRef<HTMLInputElement>(null);

  function handleReplaceChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) onReplace(asset.id, file);
    event.target.value = "";
  }

  return (
    <article
      className="overflow-hidden rounded-xl border border-border bg-background/40"
      aria-label={`${asset.name}${isHero ? ", hero image" : ""}${
        isGallery && galleryOrder !== null
          ? `, gallery image ${galleryOrder}`
          : ""
      }`}
    >
      <div className="relative aspect-[4/3] bg-surface">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={asset.url}
          alt={asset.alt || `Preview of ${asset.name}`}
          className="h-full w-full object-cover"
        />
        <div className="absolute left-1.5 top-1.5 flex flex-wrap gap-1">
          {isHero ? (
            <span className="rounded-md bg-accent px-1.5 py-0.5 text-[10px] font-medium text-background">
              Hero
            </span>
          ) : null}
          {isGallery && galleryOrder !== null ? (
            <span className="rounded-md bg-foreground/80 px-1.5 py-0.5 text-[10px] font-medium text-background">
              Gallery {galleryOrder}
            </span>
          ) : null}
        </div>
      </div>

      <div className="space-y-2 p-2.5">
        <div>
          <p className="truncate text-xs font-medium text-foreground" title={asset.name}>
            {asset.name}
          </p>
          <p className="mt-0.5 text-[10px] text-muted">{asset.sizeLabel}</p>
        </div>

        <MediaMetadataFields
          value={{
            title: asset.title,
            description: asset.description,
            alt: asset.alt,
          }}
          onChange={(meta) => onMetaChange(asset.id, meta)}
        />

        <div className="grid grid-cols-2 gap-1">
          <button
            type="button"
            onClick={() => onSetHero(asset.id)}
            aria-pressed={isHero}
            aria-label={
              isHero
                ? `${asset.name} is the hero image`
                : `Set ${asset.name} as hero image`
            }
            className={`rounded-md border px-2 py-1.5 text-[11px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
              isHero
                ? "border-accent bg-accent-soft text-foreground"
                : "border-border text-muted hover:border-accent/40 hover:text-foreground"
            }`}
          >
            {isHero ? "Hero" : "Set hero"}
          </button>

          <button
            type="button"
            onClick={() => onToggleGallery(asset.id)}
            aria-pressed={isGallery}
            aria-label={
              isGallery
                ? `Remove ${asset.name} from gallery`
                : `Add ${asset.name} to gallery`
            }
            className={`rounded-md border px-2 py-1.5 text-[11px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
              isGallery
                ? "border-accent bg-accent-soft text-foreground"
                : "border-border text-muted hover:border-accent/40 hover:text-foreground"
            }`}
          >
            {isGallery ? "In gallery" : "Gallery"}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-1">
          <button
            type="button"
            onClick={() => replaceRef.current?.click()}
            aria-label={`Replace ${asset.name}`}
            className="rounded-md border border-border px-2 py-1.5 text-[11px] text-muted transition-colors hover:border-accent/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            Replace
          </button>
          <button
            type="button"
            onClick={() => onDelete(asset.id)}
            aria-label={`Delete ${asset.name}`}
            className="rounded-md border border-border px-2 py-1.5 text-[11px] text-muted transition-colors hover:border-red-400/40 hover:text-red-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            Delete
          </button>
        </div>

        <input
          id={replaceInputId}
          ref={replaceRef}
          type="file"
          accept={ACCEPTED_IMAGE_ACCEPT}
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          onChange={handleReplaceChange}
        />
      </div>
    </article>
  );
}
