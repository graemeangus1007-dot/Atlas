"use client";

import type { ConversationAttachment } from "@/lib/ai/conversation-attachments";

type ComposerAttachmentTrayProps = {
  attachments: ConversationAttachment[];
  onRemove: (id: string) => void;
  onRetry: (id: string) => void;
  onMove?: (id: string, direction: -1 | 1) => void;
  onPreview?: (attachment: ConversationAttachment) => void;
  disabled?: boolean;
};

function statusLabel(attachment: ConversationAttachment): string {
  switch (attachment.status) {
    case "queued":
      return "Waiting to upload";
    case "uploading":
      return "Uploading";
    case "uploaded":
      return "Ready";
    case "failed":
      return attachment.errorMessage || "Upload failed";
    default:
      return "";
  }
}

/**
 * Compact horizontal attachment tray for the Atlas composer.
 */
export default function ComposerAttachmentTray({
  attachments,
  onRemove,
  onRetry,
  onMove,
  onPreview,
  disabled = false,
}: ComposerAttachmentTrayProps) {
  if (attachments.length === 0) return null;

  return (
    <div
      className="mb-2"
      data-testid="composer-attachment-tray"
      aria-label="Attached photos"
    >
      <ul className="flex max-w-full gap-2 overflow-x-auto overscroll-x-contain pb-0.5 [-ms-overflow-style:none] [scrollbar-width:thin]">
        {attachments.map((attachment, index) => {
          const label = statusLabel(attachment);
          const preview =
            attachment.previewUrl && !attachment.previewUrl.startsWith("blob:")
              ? attachment.previewUrl
              : attachment.localObjectUrl || attachment.previewUrl;
          return (
            <li
              key={attachment.id}
              className="relative w-[5.5rem] shrink-0"
              data-testid={`composer-attachment-${attachment.id}`}
              data-status={attachment.status}
            >
              <div className="overflow-hidden rounded-lg border border-border bg-background/50">
                <button
                  type="button"
                  className="relative block aspect-square w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
                  onClick={() => onPreview?.(attachment)}
                  disabled={disabled || !preview}
                  aria-label={`Preview ${attachment.filename}`}
                >
                  {preview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={preview}
                      alt=""
                      className="size-full object-cover"
                      draggable={false}
                    />
                  ) : (
                    <span className="flex size-full items-center justify-center text-[10px] text-muted">
                      Photo
                    </span>
                  )}
                  {attachment.status === "uploading" ||
                  attachment.status === "queued" ? (
                    <span className="absolute inset-0 flex items-center justify-center bg-background/55 text-[10px] font-medium text-foreground">
                      …
                    </span>
                  ) : null}
                </button>
                <div className="space-y-0.5 px-1.5 py-1">
                  <p
                    className="truncate text-[10px] text-foreground"
                    title={attachment.filename}
                  >
                    {attachment.type === "logo" ? "Logo · " : ""}
                    {attachment.filename}
                  </p>
                  <p
                    className={`truncate text-[10px] ${
                      attachment.status === "failed"
                        ? "text-red-600"
                        : "text-muted"
                    }`}
                    aria-live="polite"
                  >
                    {label}
                  </p>
                </div>
              </div>

              <div className="mt-0.5 flex items-center justify-between gap-0.5">
                {onMove ? (
                  <div className="flex gap-0.5">
                    <button
                      type="button"
                      className="rounded px-1 text-[10px] text-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 disabled:opacity-30"
                      aria-label={`Move ${attachment.filename} earlier`}
                      disabled={disabled || index === 0}
                      onClick={() => onMove(attachment.id, -1)}
                    >
                      ←
                    </button>
                    <button
                      type="button"
                      className="rounded px-1 text-[10px] text-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 disabled:opacity-30"
                      aria-label={`Move ${attachment.filename} later`}
                      disabled={disabled || index === attachments.length - 1}
                      onClick={() => onMove(attachment.id, 1)}
                    >
                      →
                    </button>
                  </div>
                ) : (
                  <span />
                )}
                <div className="flex gap-0.5">
                  {attachment.status === "failed" ? (
                    <button
                      type="button"
                      className="rounded px-1 text-[10px] font-medium text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
                      aria-label={`Retry uploading ${attachment.filename}`}
                      disabled={disabled}
                      onClick={() => onRetry(attachment.id)}
                      data-testid={`composer-attachment-retry-${attachment.id}`}
                    >
                      Retry
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="rounded px-1 text-[10px] text-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
                    aria-label={`Remove ${attachment.filename}`}
                    disabled={disabled}
                    onClick={() => onRemove(attachment.id)}
                    data-testid={`composer-attachment-remove-${attachment.id}`}
                  >
                    Remove
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
