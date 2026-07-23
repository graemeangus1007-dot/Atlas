"use client";

import ImageCard from "@/components/media/image-card";
import type { MediaAsset, MediaAssetMeta } from "@/types/media";

type ImageGridProps = {
  assets: MediaAsset[];
  heroImageId: string | null;
  galleryImageIds: string[];
  onSetHero: (id: string) => void;
  onToggleGallery: (id: string) => void;
  onReplace: (id: string, file: File) => void;
  onDelete: (id: string) => void;
  onMetaChange: (id: string, meta: Partial<MediaAssetMeta>) => void;
};

/**
 * Responsive grid of uploaded media cards.
 */
export default function ImageGrid({
  assets,
  heroImageId,
  galleryImageIds,
  onSetHero,
  onToggleGallery,
  onReplace,
  onDelete,
  onMetaChange,
}: ImageGridProps) {
  return (
    <ul
      className="grid grid-cols-1 gap-3 sm:grid-cols-2"
      aria-label="Uploaded images"
    >
      {assets.map((asset) => {
        const galleryIndex = galleryImageIds.indexOf(asset.id);
        return (
          <li key={asset.id}>
            <ImageCard
              asset={asset}
              isHero={heroImageId === asset.id}
              isGallery={galleryIndex >= 0}
              galleryOrder={galleryIndex >= 0 ? galleryIndex + 1 : null}
              onSetHero={onSetHero}
              onToggleGallery={onToggleGallery}
              onReplace={onReplace}
              onDelete={onDelete}
              onMetaChange={onMetaChange}
            />
          </li>
        );
      })}
    </ul>
  );
}
