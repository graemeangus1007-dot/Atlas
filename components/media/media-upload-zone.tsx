"use client";

import { useRef, useState, type DragEvent, type ChangeEvent } from "react";
import { ACCEPTED_IMAGE_ACCEPT } from "@/data/media";
import { mockUploadImage } from "@/lib/media";
import type { MediaAsset } from "@/types/media";

type MediaUploadZoneProps = {
  onUploaded: (asset: MediaAsset) => void;
  disabled?: boolean;
};

/**
 * Drag-and-drop / click-to-upload zone with mock progress.
 */
export default function MediaUploadZone({
  onUploaded,
  disabled = false,
}: MediaUploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const busy = progress !== null || disabled;

  async function handleFiles(files: FileList | File[]) {
    const file = Array.from(files)[0];
    if (!file || busy) return;

    setError(null);
    setProgress(0);

    try {
      const asset = await mockUploadImage(file, setProgress);
      onUploaded(asset);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      window.setTimeout(() => setProgress(null), 350);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function onDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    if (!busy) setDragging(true);
  }

  function onDragLeave(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    if (event.dataTransfer.files?.length) {
      void handleFiles(event.dataTransfer.files);
    }
  }

  function onChange(event: ChangeEvent<HTMLInputElement>) {
    if (event.target.files?.length) {
      void handleFiles(event.target.files);
    }
  }

  return (
    <div className="space-y-2">
      <div
        role="button"
        tabIndex={0}
        onClick={() => !busy && inputRef.current?.click()}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            if (!busy) inputRef.current?.click();
          }
        }}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={`rounded-xl border border-dashed px-4 py-6 text-center transition-colors ${
          dragging
            ? "border-accent bg-accent-soft"
            : "border-border bg-background/40 hover:border-white/20"
        } ${busy ? "cursor-wait opacity-80" : "cursor-pointer"}`}
        aria-label="Upload images"
      >
        <p className="text-sm font-medium text-foreground">
          {progress !== null ? "Uploading…" : "Drop images here"}
        </p>
        <p className="mt-1 text-xs text-muted">
          or click to browse · JPEG, PNG, WebP, GIF
        </p>

        {progress !== null ? (
          <div className="mx-auto mt-4 w-full max-w-[14rem]">
            <div className="h-1.5 overflow-hidden rounded-full bg-border">
              <div
                className="h-full rounded-full bg-accent transition-all duration-150"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="mt-1.5 text-xs text-muted">{progress}%</p>
          </div>
        ) : null}

        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_IMAGE_ACCEPT}
          className="sr-only"
          onChange={onChange}
          disabled={busy}
        />
      </div>

      {error ? <p className="text-xs text-red-400">{error}</p> : null}
    </div>
  );
}
