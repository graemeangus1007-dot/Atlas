"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import type { WebsiteGalleryItem } from "@/types/website-content";

type GalleryLightboxProps = {
  items: WebsiteGalleryItem[];
  openIndex: number | null;
  onClose: () => void;
  showCaptions?: boolean;
  navigation?: boolean;
  /** Element to restore focus to on close. */
  restoreFocusRef?: React.RefObject<HTMLElement | null>;
};

/**
 * Accessible fullscreen gallery viewer — object-fit: contain, never crop.
 */
export default function GalleryLightbox({
  items,
  openIndex,
  onClose,
  showCaptions = true,
  navigation = true,
  restoreFocusRef,
}: GalleryLightboxProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const open = openIndex != null && openIndex >= 0 && items.length > 0;
  const startIndex =
    openIndex != null && openIndex >= 0
      ? Math.min(openIndex, Math.max(0, items.length - 1))
      : 0;
  const [index, setIndex] = useState(startIndex);

  const go = useCallback(
    (delta: number) => {
      if (!navigation || items.length === 0) return;
      setIndex((current) => {
        const next = current + delta;
        if (next < 0) return items.length - 1;
        if (next >= items.length) return 0;
        return next;
      });
    },
    [items.length, navigation],
  );

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const focusRestore = restoreFocusRef?.current ?? null;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        go(-1);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        go(1);
      } else if (event.key === "Tab" && dialogRef.current) {
        const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (focusable.length === 0) return;
        const first = focusable[0]!;
        const last = focusable[focusable.length - 1]!;
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
      focusRestore?.focus();
    };
  }, [open, onClose, go, restoreFocusRef]);

  // Preload adjacent
  useEffect(() => {
    if (!open) return;
    for (const step of [-1, 1]) {
      const adjacent = items[(index + step + items.length) % items.length];
      if (!adjacent?.imageUrl) continue;
      const img = new Image();
      img.src = adjacent.imageUrl;
    }
  }, [open, index, items]);

  if (!open) return null;
  const item = items[index];
  if (!item) return null;

  const onDialogKeyDown = (event: ReactKeyboardEvent) => {
    if (event.key === "Escape") {
      event.stopPropagation();
      onClose();
    }
  };

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/88 p-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]"
      onClick={onClose}
      onKeyDown={onDialogKeyDown}
      data-testid="gallery-lightbox"
    >
      <div
        className="relative flex max-h-full w-full max-w-5xl flex-col"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between gap-3 text-white">
          <p id={titleId} className="truncate text-sm font-medium">
            {item.title?.trim() || item.alt || "Gallery photo"}
            <span className="ml-2 text-white/60">
              {index + 1} / {items.length}
            </span>
          </p>
          <button
            ref={closeRef}
            type="button"
            className="rounded-md border border-white/30 px-3 py-1.5 text-sm text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            onClick={onClose}
            aria-label="Close photo viewer"
            data-testid="gallery-lightbox-close"
          >
            Close
          </button>
        </div>

        <div className="relative flex min-h-0 flex-1 items-center justify-center">
          {navigation && items.length > 1 ? (
            <button
              type="button"
              className="absolute left-0 z-10 rounded-full bg-black/50 px-3 py-2 text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:left-2"
              onClick={() => go(-1)}
              aria-label="Previous photo"
              data-testid="gallery-lightbox-prev"
            >
              ‹
            </button>
          ) : null}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={item.imageUrl}
            alt={item.alt}
            className="max-h-[min(78vh,900px)] max-w-full object-contain"
            data-testid="gallery-lightbox-image"
          />
          {navigation && items.length > 1 ? (
            <button
              type="button"
              className="absolute right-0 z-10 rounded-full bg-black/50 px-3 py-2 text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:right-2"
              onClick={() => go(1)}
              aria-label="Next photo"
              data-testid="gallery-lightbox-next"
            >
              ›
            </button>
          ) : null}
        </div>

        {showCaptions && (item.title || item.description) ? (
          <div className="mt-3 text-center text-sm text-white/90">
            {item.title ? <p className="font-medium">{item.title}</p> : null}
            {item.description ? (
              <p className="mt-1 text-white/70">{item.description}</p>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
