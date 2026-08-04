"use client";

import { useRef, useState } from "react";
import EditableGalleryTitle from "@/components/gallery/editable-gallery-title";
import GalleryLightbox from "@/components/gallery/gallery-lightbox";
import SectionHeading from "@/components/preview/section-heading";
import PreviewSection from "@/components/preview/section";
import { galleryGridClass } from "@/lib/templates";
import type { GalleryLayout } from "@/lib/templates";
import type { WebsiteGalleryItem } from "@/types/website-content";

type PreviewGalleryProps = {
  items: WebsiteGalleryItem[];
  galleryLayout?: GalleryLayout;
  onTitleChange?: (assetId: string, title: string) => void;
  /** When true, thumbnails open the fullscreen viewer (Preview / publish parity). */
  lightboxEnabled?: boolean;
  lightboxNavigation?: boolean;
  lightboxCaptions?: boolean;
};

/**
 * Gallery grid — layout variant from the active template.
 * Lightbox is enabled in Preview; disabled in the editor canvas so title edits stay usable.
 */
export default function PreviewGallery({
  items,
  galleryLayout = "grid-2",
  onTitleChange,
  lightboxEnabled = false,
  lightboxNavigation = true,
  lightboxCaptions = false,
}: PreviewGalleryProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const triggerRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const restoreRef = useRef<HTMLElement | null>(null);
  const interactive = lightboxEnabled && !onTitleChange;

  return (
    <PreviewSection id="gallery">
      <SectionHeading
        eyebrow="Gallery"
        title="A look inside"
        accentClassName="text-[color:var(--site-accent)]"
      />

      {onTitleChange && lightboxEnabled ? (
        <p className="mt-3 text-xs text-muted">
          Full-screen photo viewing is available in Preview.
        </p>
      ) : null}

      <ul className={`mt-12 ${galleryGridClass(galleryLayout)}`}>
        {items.map((item, index) => {
          const canEdit = Boolean(onTitleChange && item.assetId);
          const showTitle =
            item.showTitle !== false && Boolean(item.title?.trim());
          const masonrySpan =
            galleryLayout === "masonry" && index % 3 === 0
              ? "sm:row-span-2 sm:min-h-[24rem]"
              : "";

          const media = (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.imageUrl}
                alt=""
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                aria-hidden={interactive ? true : undefined}
              />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent" />
            </>
          );

          return (
            <li key={item.id} className={`flex flex-col ${masonrySpan}`}>
              <div
                className={`group relative min-h-40 overflow-hidden rounded-3xl border border-border sm:min-h-48 ${
                  galleryLayout === "wide" ? "aspect-[3/4]" : "aspect-[4/3]"
                } ${masonrySpan ? "h-full" : ""}`}
              >
                {interactive ? (
                  <button
                    type="button"
                    ref={(el) => {
                      triggerRefs.current[index] = el;
                    }}
                    className="absolute inset-0 h-full w-full cursor-zoom-in focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--site-accent)]"
                    onClick={() => {
                      restoreRef.current = triggerRefs.current[index];
                      setOpenIndex(index);
                    }}
                    aria-label={`View ${item.alt || item.title || "gallery photo"} fullscreen`}
                    data-testid={`gallery-lightbox-trigger-${index}`}
                  >
                    {media}
                  </button>
                ) : (
                  media
                )}
              </div>

              {showTitle || item.description || canEdit ? (
                <div className="mt-3 px-1">
                  {canEdit && item.assetId && onTitleChange ? (
                    <EditableGalleryTitle
                      value={item.title}
                      onChange={(title) => onTitleChange(item.assetId!, title)}
                      aria-label={`Edit title for gallery photo ${index + 1}`}
                    />
                  ) : showTitle ? (
                    <p className="text-sm font-medium text-foreground">
                      {item.title}
                    </p>
                  ) : null}
                  {item.description ? (
                    <p className="mt-1 text-xs leading-relaxed text-muted">
                      {item.description}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>

      {interactive && openIndex != null ? (
        <GalleryLightbox
          key={openIndex}
          items={items}
          openIndex={openIndex}
          onClose={() => setOpenIndex(null)}
          showCaptions={lightboxCaptions}
          navigation={lightboxNavigation}
          restoreFocusRef={restoreRef}
        />
      ) : null}
    </PreviewSection>
  );
}
