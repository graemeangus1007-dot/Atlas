"use client";

import { useEffect, useId, useRef } from "react";
import type { MediaAsset } from "@/types/media";

type ComposerExistingImagePickerProps = {
  open: boolean;
  assets: MediaAsset[];
  onClose: () => void;
  onSelect: (assets: MediaAsset[]) => void;
  multiple?: boolean;
};

/**
 * Compact project-image picker for composer attachments (not the full Media Library).
 */
export default function ComposerExistingImagePicker({
  open,
  assets,
  onClose,
  onSelect,
  multiple = true,
}: ComposerExistingImagePickerProps) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const available = assets.filter((a) => !a.unavailable && a.storagePath);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-black/35 p-3 sm:items-center"
      role="presentation"
      data-testid="composer-existing-image-picker"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex max-h-[70vh] w-full max-w-md flex-col rounded-xl border border-border bg-surface shadow-lg"
      >
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <h2 id={titleId} className="text-sm font-medium text-foreground">
            Choose existing image
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="rounded-md px-2 py-1 text-xs text-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
            aria-label="Close image picker"
          >
            Close
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {available.length === 0 ? (
            <p className="text-sm text-muted">
              No project photos yet. Upload a photo from the + menu.
            </p>
          ) : (
            <ul
              className="grid grid-cols-3 gap-2"
              aria-label="Project images"
            >
              {available.map((asset) => (
                <li key={asset.id}>
                  <button
                    type="button"
                    className="group w-full overflow-hidden rounded-lg border border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
                    onClick={() => {
                      onSelect([asset]);
                      if (!multiple) onClose();
                      else onClose();
                    }}
                    aria-label={`Attach ${asset.name || asset.filename}`}
                    data-testid={`composer-existing-asset-${asset.id}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={asset.url}
                      alt=""
                      className="aspect-square w-full object-cover transition-opacity group-hover:opacity-90 motion-reduce:transition-none"
                      draggable={false}
                    />
                    <span className="block truncate px-1 py-0.5 text-[10px] text-muted">
                      {asset.name || asset.filename}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
