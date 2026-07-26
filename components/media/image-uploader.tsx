"use client";

import { useState } from "react";
import DropZone from "@/components/media/drop-zone";
import { uploadProjectMediaFiles } from "@/lib/supabase/storage";
import type { MediaAsset } from "@/types/media";

type ImageUploaderProps = {
  projectId: string | null;
  onUploaded: (assets: MediaAsset[]) => void;
  disabled?: boolean;
  /** Compact empty-state trigger (button + short copy). */
  emptyState?: boolean;
};

/**
 * Multi-image uploader — stores files in Supabase Storage (durable URLs).
 */
export default function ImageUploader({
  projectId,
  onUploaded,
  disabled = false,
  emptyState = false,
}: ImageUploaderProps) {
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingFiles, setPendingFiles] = useState<File[] | null>(null);
  const busy = progress !== null || disabled;

  async function runUpload(files: File[]) {
    if (!projectId) {
      setError("Open or create a project before uploading media.");
      setPendingFiles(files);
      return;
    }

    setError(null);
    setPendingFiles(files);
    setProgress(0);

    try {
      const result = await uploadProjectMediaFiles(
        projectId,
        files,
        setProgress,
      );
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onUploaded(result.data);
      setPendingFiles(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      window.setTimeout(() => setProgress(null), 280);
    }
  }

  async function handleFiles(files: File[]) {
    if (busy || files.length === 0) return;
    await runUpload(files);
  }

  async function handleRetry() {
    if (!pendingFiles?.length || busy) return;
    await runUpload(pendingFiles);
  }

  if (emptyState) {
    return (
      <div className="space-y-3 py-6 text-center" aria-busy={busy || undefined}>
        <p className="text-sm text-muted">
          Upload photos to personalize your website.
        </p>
        <DropZone
          onFiles={(files) => void handleFiles(files)}
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
          <div className="space-y-2" role="alert">
            <p className="text-xs text-red-400">{error}</p>
            {pendingFiles?.length ? (
              <button
                type="button"
                onClick={() => void handleRetry()}
                className="text-xs font-medium text-accent underline-offset-2 hover:underline"
              >
                Retry upload
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-2" aria-busy={busy || undefined}>
      <DropZone
        onFiles={(files) => void handleFiles(files)}
        disabled={busy}
        label="Drop images here or click to browse"
      >
        <p className="text-sm font-medium text-foreground">
          {progress !== null ? "Uploading…" : "Drop images here"}
        </p>
        <p className="mt-1 text-xs text-muted">
          or click to browse · multiple files · JPEG, PNG, WebP, GIF · max 5 MB
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
        <div className="flex flex-wrap items-center gap-3" role="alert">
          <p className="text-xs text-red-400">{error}</p>
          {pendingFiles?.length ? (
            <button
              type="button"
              onClick={() => void handleRetry()}
              disabled={busy}
              className="text-xs font-medium text-accent underline-offset-2 hover:underline disabled:opacity-50"
            >
              Retry upload
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
