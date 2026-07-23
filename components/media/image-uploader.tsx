"use client";

import { useState } from "react";
import DropZone from "@/components/media/drop-zone";
import { mockUploadImages } from "@/lib/media";
import type { MediaAsset } from "@/types/media";

type ImageUploaderProps = {
  onUploaded: (assets: MediaAsset[]) => void;
  disabled?: boolean;
  /** Compact empty-state trigger (button + short copy). */
  emptyState?: boolean;
};

/**
 * Multi-image uploader with mock progress over a DropZone.
 */
export default function ImageUploader({
  onUploaded,
  disabled = false,
  emptyState = false,
}: ImageUploaderProps) {
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const busy = progress !== null || disabled;

  async function handleFiles(files: File[]) {
    if (busy || files.length === 0) return;

    setError(null);
    setProgress(0);

    try {
      const assets = await mockUploadImages(files, setProgress);
      onUploaded(assets);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      window.setTimeout(() => setProgress(null), 280);
    }
  }

  if (emptyState) {
    return (
      <div className="space-y-3 py-6 text-center" aria-busy={busy || undefined}>
        <p className="text-sm text-muted">
          Upload photos to personalize your website.
        </p>
        <DropZone
          onFiles={handleFiles}
          disabled={busy}
          label="Upload photos to personalize your website"
          className="mx-auto max-w-xs border-solid py-3"
        >
          <span className="inline-flex items-center justify-center rounded-lg bg-accent px-4 py-2 text-sm font-medium text-background">
            {progress !== null ? `Uploading ${progress}%` : "Upload photos"}
          </span>
        </DropZone>
        {progress !== null ? (
          <div
            className="mx-auto h-1.5 w-40 overflow-hidden rounded-full bg-border"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress}
            aria-label="Upload progress"
          >
            <div
              className="h-full rounded-full bg-accent transition-all duration-150"
              style={{ width: `${progress}%` }}
            />
          </div>
        ) : null}
        {error ? (
          <p className="text-xs text-red-400" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-2" aria-busy={busy || undefined}>
      <DropZone
        onFiles={handleFiles}
        disabled={busy}
        label="Drop images here or click to browse"
      >
        <p className="text-sm font-medium text-foreground">
          {progress !== null ? "Uploading…" : "Drop images here"}
        </p>
        <p className="mt-1 text-xs text-muted">
          or click to browse · multiple files · JPEG, PNG, WebP, GIF
        </p>

        {progress !== null ? (
          <div className="mx-auto mt-4 w-full max-w-[14rem]">
            <div
              className="h-1.5 overflow-hidden rounded-full bg-border"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progress}
              aria-label="Upload progress"
            >
              <div
                className="h-full rounded-full bg-accent transition-all duration-150"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="mt-1.5 text-xs text-muted">{progress}%</p>
          </div>
        ) : null}
      </DropZone>

      {error ? (
        <p className="text-xs text-red-400" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
