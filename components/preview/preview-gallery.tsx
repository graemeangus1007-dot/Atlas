"use client";

import EditableGalleryTitle from "@/components/gallery/editable-gallery-title";
import SectionHeading from "@/components/preview/section-heading";
import PreviewSection from "@/components/preview/section";
import { galleryGridClass } from "@/lib/templates";
import type { GalleryLayout } from "@/lib/templates";
import type { WebsiteGalleryItem } from "@/types/website-content";

type PreviewGalleryProps = {
  items: WebsiteGalleryItem[];
  galleryLayout?: GalleryLayout;
  onTitleChange?: (assetId: string, title: string) => void;
};

/**
 * Gallery grid — layout variant from the active template.
 */
export default function PreviewGallery({
  items,
  galleryLayout = "grid-2",
  onTitleChange,
}: PreviewGalleryProps) {
  return (
    <PreviewSection id="gallery">
      <SectionHeading
        eyebrow="Gallery"
        title="A look inside"
        accentClassName="text-[color:var(--site-accent)]"
      />

      <ul className={`mt-12 ${galleryGridClass(galleryLayout)}`}>
        {items.map((item, index) => {
          const canEdit = Boolean(onTitleChange && item.assetId);
          const masonrySpan =
            galleryLayout === "masonry" && index % 3 === 0
              ? "sm:row-span-2 sm:min-h-[24rem]"
              : "";

          return (
            <li key={item.id} className={`flex flex-col ${masonrySpan}`}>
              <div
                className={`group relative min-h-40 overflow-hidden rounded-3xl border border-border sm:min-h-48 ${
                  galleryLayout === "wide" ? "aspect-[3/4]" : "aspect-[4/3]"
                } ${masonrySpan ? "h-full" : ""}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.imageUrl}
                  alt={item.alt}
                  className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent" />
              </div>

              <div className="mt-3 px-1">
                {canEdit && item.assetId && onTitleChange ? (
                  <EditableGalleryTitle
                    value={item.title}
                    onChange={(title) => onTitleChange(item.assetId!, title)}
                    aria-label={`Edit title for ${item.title}`}
                  />
                ) : (
                  <p className="text-sm font-medium text-foreground">
                    {item.title}
                  </p>
                )}
                {item.description ? (
                  <p className="mt-1 text-xs leading-relaxed text-muted">
                    {item.description}
                  </p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </PreviewSection>
  );
}
