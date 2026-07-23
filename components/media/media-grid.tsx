"use client";

import type { MediaAsset } from "@/types/media";
import { GALLERY_SLOT_COUNT } from "@/types/media";

type MediaGridProps = {
  assets: MediaAsset[];
  heroImageUrl: string | null;
  galleryImageUrls: (string | null)[];
  onSetHero: (url: string) => void;
  onSetGallery: (slotIndex: number, url: string) => void;
  onRemove: (id: string) => void;
};

/**
 * Responsive grid of uploaded media with assign / remove actions.
 */
export default function MediaGrid({
  assets,
  heroImageUrl,
  galleryImageUrls,
  onSetHero,
  onSetGallery,
  onRemove,
}: MediaGridProps) {
  if (assets.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-background/30 px-4 py-8 text-center">
        <p className="text-sm text-muted">No uploads yet.</p>
        <p className="mt-1 text-xs text-muted">
          Drop a photo above to start building your library.
        </p>
      </div>
    );
  }

  return (
    <ul className="grid grid-cols-2 gap-2 sm:grid-cols-2">
      {assets.map((asset) => {
        const isHero = heroImageUrl === asset.url;
        const gallerySlot = galleryImageUrls.findIndex(
          (url) => url === asset.url,
        );

        return (
          <li
            key={asset.id}
            className="overflow-hidden rounded-xl border border-border bg-background/40"
          >
            <div className="relative aspect-[4/3] bg-surface">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={asset.url}
                alt={asset.name}
                className="h-full w-full object-cover"
              />
              <div className="absolute left-1.5 top-1.5 flex flex-wrap gap-1">
                {isHero ? (
                  <span className="rounded-md bg-accent px-1.5 py-0.5 text-[10px] font-medium text-background">
                    Hero
                  </span>
                ) : null}
                {gallerySlot >= 0 ? (
                  <span className="rounded-md bg-foreground/80 px-1.5 py-0.5 text-[10px] font-medium text-background">
                    Gallery {gallerySlot + 1}
                  </span>
                ) : null}
              </div>
            </div>

            <div className="space-y-2 p-2">
              <p className="truncate text-xs font-medium text-foreground">
                {asset.name}
              </p>
              <p className="text-[10px] text-muted">{asset.sizeLabel}</p>

              <div className="flex flex-col gap-1">
                <button
                  type="button"
                  onClick={() => onSetHero(asset.url)}
                  className="rounded-md border border-border px-2 py-1 text-[11px] text-muted transition-colors hover:border-accent/40 hover:text-foreground"
                >
                  {isHero ? "Hero selected" : "Use as hero"}
                </button>

                <div className="grid grid-cols-4 gap-1">
                  {Array.from({ length: GALLERY_SLOT_COUNT }, (_, index) => (
                    <button
                      key={index}
                      type="button"
                      title={`Gallery slot ${index + 1}`}
                      onClick={() => onSetGallery(index, asset.url)}
                      className={`rounded-md border px-1 py-1 text-[10px] transition-colors ${
                        gallerySlot === index
                          ? "border-accent bg-accent-soft text-foreground"
                          : "border-border text-muted hover:border-accent/40 hover:text-foreground"
                      }`}
                    >
                      G{index + 1}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => onRemove(asset.id)}
                  className="rounded-md px-2 py-1 text-[11px] text-muted transition-colors hover:text-red-400"
                >
                  Remove
                </button>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
