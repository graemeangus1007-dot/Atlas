"use client";

import {
  forwardRef,
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type ClipboardEvent,
  type DragEvent,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import ComposerAttachMenu, {
  type ComposerAttachMenuAction,
} from "@/components/editor/composer-attach-menu";
import ComposerAttachmentTray from "@/components/editor/composer-attachment-tray";
import ComposerExistingImagePicker from "@/components/editor/composer-existing-image-picker";
import Button from "@/components/ui/button";
import { ATLAS_VOICE } from "@/lib/ai/atlas-designer-voice";
import {
  COMPOSER_IMAGE_ACCEPT,
  type ConversationAttachment,
} from "@/lib/ai/conversation-attachments";
import type { MediaAsset } from "@/types/media";

type AtlasComposerProps = {
  draft: string;
  onDraftChange: (value: string) => void;
  onSubmit: (value: string) => void;
  sending: boolean;
  placeholder?: string;
  followUpSuggestions?: string[];
  onFollowUpSuggestion?: (suggestion: string) => void;
  onDismissFollowUps?: () => void;
  showFollowUps?: boolean;
  /** Attachment support (v1.3). Optional for older callers/tests. */
  attachments?: ConversationAttachment[];
  attachmentError?: string | null;
  onUploadPhotos?: (files: File[]) => void;
  onUploadLogo?: (files: File[]) => void;
  onAttachExisting?: (assets: MediaAsset[]) => void;
  onRemoveAttachment?: (id: string) => void;
  onRetryAttachment?: (id: string) => void;
  onMoveAttachment?: (id: string, direction: -1 | 1) => void;
  onIngestFiles?: (files: File[]) => void;
  projectMedia?: MediaAsset[];
  attachmentsReady?: boolean;
  attachmentsUploading?: boolean;
};

const MAX_FOLLOW_UPS = 3;
const MAX_TEXTAREA_PX = 160;

const AtlasComposer = forwardRef<HTMLTextAreaElement, AtlasComposerProps>(
  function AtlasComposer(
    {
      draft,
      onDraftChange,
      onSubmit,
      sending,
      placeholder = ATLAS_VOICE.composerPlaceholder,
      followUpSuggestions = [],
      onFollowUpSuggestion,
      onDismissFollowUps,
      showFollowUps = false,
      attachments = [],
      attachmentError = null,
      onUploadPhotos,
      onUploadLogo,
      onAttachExisting,
      onRemoveAttachment,
      onRetryAttachment,
      onMoveAttachment,
      onIngestFiles,
      projectMedia = [],
      attachmentsReady = true,
      attachmentsUploading = false,
    },
    ref,
  ) {
    const innerRef = useRef<HTMLTextAreaElement | null>(null);
    const plusRef = useRef<HTMLButtonElement | null>(null);
    const photoInputRef = useRef<HTMLInputElement | null>(null);
    const logoInputRef = useRef<HTMLInputElement | null>(null);
    const [menuOpen, setMenuOpen] = useState(false);
    const [pickerOpen, setPickerOpen] = useState(false);
    const [dragOver, setDragOver] = useState(false);
    const [previewAttachment, setPreviewAttachment] =
      useState<ConversationAttachment | null>(null);

    const attachmentsEnabled = Boolean(onUploadPhotos || onUploadLogo);

    const setRefs = useCallback(
      (node: HTMLTextAreaElement | null) => {
        innerRef.current = node;
        if (typeof ref === "function") ref(node);
        else if (ref) ref.current = node;
      },
      [ref],
    );

    useLayoutEffect(() => {
      const el = innerRef.current;
      if (!el) return;
      el.style.height = "auto";
      el.style.height = `${Math.min(el.scrollHeight, MAX_TEXTAREA_PX)}px`;
    }, [draft]);

    const canSend =
      Boolean(draft.trim()) &&
      !sending &&
      !attachmentsUploading &&
      attachmentsReady &&
      !attachments.some((a) => a.status === "failed");

    function handleSubmit(event: FormEvent) {
      event.preventDefault();
      const value = draft.trim();
      if (!value || !canSend) return;
      onSubmit(value);
    }

    function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        const value = draft.trim();
        if (!value || !canSend) return;
        onSubmit(value);
      }
    }

    function handleMenuAction(action: ComposerAttachMenuAction) {
      if (action === "upload-photo") {
        photoInputRef.current?.click();
      } else if (action === "upload-logo") {
        logoInputRef.current?.click();
      } else if (action === "choose-existing") {
        setPickerOpen(true);
      }
    }

    function handlePaste(event: ClipboardEvent<HTMLTextAreaElement>) {
      const items = event.clipboardData?.items;
      if (!items || !onIngestFiles) return;
      const files: File[] = [];
      for (const item of Array.from(items)) {
        if (item.kind === "file" && item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) {
            const named =
              file.name && file.name !== "image.png"
                ? file
                : new File(
                    [file],
                    `pasted-image-${Date.now()}.${extensionForMime(file.type)}`,
                    { type: file.type },
                  );
            files.push(named);
          }
        }
      }
      if (files.length === 0) return;
      // Keep text paste; only consume when image files are present.
      event.preventDefault();
      const text = event.clipboardData.getData("text/plain");
      if (text) onDraftChange(draft + text);
      onIngestFiles(files);
    }

    function onDragOverComposer(event: DragEvent) {
      if (!onIngestFiles) return;
      if (![...event.dataTransfer.types].includes("Files")) return;
      event.preventDefault();
      setDragOver(true);
    }

    function onDragLeaveComposer(event: DragEvent) {
      if (!onIngestFiles) return;
      event.preventDefault();
      setDragOver(false);
    }

    function onDropComposer(event: DragEvent) {
      if (!onIngestFiles) return;
      event.preventDefault();
      setDragOver(false);
      const files = Array.from(event.dataTransfer.files ?? []);
      if (files.length) onIngestFiles(files);
    }

    const suggestions = followUpSuggestions.slice(0, MAX_FOLLOW_UPS);
    const typing = draft.trim().length > 0;
    const canShowSuggestions =
      showFollowUps && !typing && suggestions.length > 0 && onFollowUpSuggestion;

    return (
      <form
        onSubmit={handleSubmit}
        onDragOver={onDragOverComposer}
        onDragLeave={onDragLeaveComposer}
        onDrop={onDropComposer}
        className="relative border-t border-border bg-surface/95 px-3 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
        data-testid="atlas-prompt-region"
        aria-label="Prompt composer"
      >
        {dragOver ? (
          <div
            className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-none bg-accent/10 text-sm font-medium text-foreground backdrop-blur-[1px]"
            data-testid="composer-drop-overlay"
            aria-hidden
          >
            Drop photos to attach
          </div>
        ) : null}

        {canShowSuggestions ? (
          <div
            className="mb-2 flex flex-wrap items-center gap-1.5"
            data-testid="atlas-follow-up-suggestions"
          >
            {suggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                disabled={sending}
                onClick={() => onFollowUpSuggestion?.(suggestion)}
                className="truncate rounded-md px-2 py-0.5 text-[11px] text-muted transition-colors hover:bg-background/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 disabled:opacity-40"
              >
                {suggestion}
              </button>
            ))}
            {onDismissFollowUps ? (
              <button
                type="button"
                aria-label="Dismiss suggestions"
                onClick={onDismissFollowUps}
                className="ml-auto rounded-md px-1.5 py-0.5 text-[11px] text-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
                data-testid="atlas-dismiss-follow-ups"
              >
                ✕
              </button>
            ) : null}
          </div>
        ) : null}

        {onRemoveAttachment && onRetryAttachment ? (
          <ComposerAttachmentTray
            attachments={attachments}
            onRemove={onRemoveAttachment}
            onRetry={onRetryAttachment}
            onMove={onMoveAttachment}
            onPreview={setPreviewAttachment}
            disabled={sending}
          />
        ) : null}

        {attachmentError ? (
          <p
            className="mb-1.5 text-[11px] text-red-600"
            role="alert"
            data-testid="composer-attachment-error"
          >
            {attachmentError}
          </p>
        ) : null}

        <label htmlFor="atlas-ai-prompt" className="sr-only">
          Design request
        </label>
        <div className="flex items-end gap-2">
          {attachmentsEnabled ? (
            <div className="relative shrink-0">
              <button
                ref={plusRef}
                type="button"
                data-testid="composer-attach-button"
                aria-label="Attach photos"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                disabled={sending}
                onClick={() => setMenuOpen((open) => !open)}
                className="flex size-9 items-center justify-center rounded-full border border-border bg-background/60 text-lg leading-none text-foreground transition-colors hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 disabled:opacity-50"
              >
                +
              </button>
              <ComposerAttachMenu
                open={menuOpen}
                onClose={() => setMenuOpen(false)}
                onAction={handleMenuAction}
                anchorRef={plusRef}
              />
            </div>
          ) : null}

          <textarea
            ref={setRefs}
            id="atlas-ai-prompt"
            value={draft}
            onChange={(event) => onDraftChange(event.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            rows={2}
            placeholder={placeholder}
            disabled={sending}
            className="max-h-40 min-h-[2.75rem] w-full min-w-0 resize-none overflow-y-auto rounded-xl border border-border bg-background/60 px-3 py-2 text-sm text-foreground outline-none ring-accent/40 placeholder:text-muted focus:ring-2 focus-visible:ring-2 focus-visible:ring-accent/50 disabled:opacity-60"
            data-testid="atlas-prompt-input"
          />
          <Button
            type="submit"
            disabled={!canSend}
            className="shrink-0 px-3 py-2 text-xs"
            aria-label="Send message"
          >
            {sending ? "…" : attachmentsUploading ? "…" : "Send"}
          </Button>
        </div>
        <p className="mt-1 text-[10px] text-muted/80">
          Enter to send · Shift+Enter for new line
          {attachmentsEnabled ? " · + to attach photos" : ""}
        </p>

        <input
          ref={photoInputRef}
          type="file"
          accept={COMPOSER_IMAGE_ACCEPT}
          multiple
          className="sr-only"
          tabIndex={-1}
          data-testid="composer-photo-input"
          onChange={(event) => {
            const files = Array.from(event.target.files ?? []);
            event.target.value = "";
            if (files.length) onUploadPhotos?.(files);
          }}
        />
        <input
          ref={logoInputRef}
          type="file"
          accept={COMPOSER_IMAGE_ACCEPT}
          className="sr-only"
          tabIndex={-1}
          data-testid="composer-logo-input"
          onChange={(event) => {
            const files = Array.from(event.target.files ?? []);
            event.target.value = "";
            if (files.length) onUploadLogo?.(files);
          }}
        />

        {onAttachExisting ? (
          <ComposerExistingImagePicker
            open={pickerOpen}
            assets={projectMedia}
            onClose={() => setPickerOpen(false)}
            onSelect={(assets) => {
              onAttachExisting(assets);
              setPickerOpen(false);
            }}
          />
        ) : null}

        {previewAttachment?.previewUrl || previewAttachment?.localObjectUrl ? (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            role="dialog"
            aria-modal="true"
            aria-label={previewAttachment.filename}
            data-testid="composer-attachment-preview"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                setPreviewAttachment(null);
              }
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={
                previewAttachment.localObjectUrl ||
                previewAttachment.previewUrl ||
                ""
              }
              alt={previewAttachment.altText || previewAttachment.filename}
              className="max-h-[80vh] max-w-full rounded-lg object-contain"
            />
            <button
              type="button"
              className="absolute right-4 top-4 rounded-md bg-surface px-2 py-1 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
              onClick={() => setPreviewAttachment(null)}
            >
              Close
            </button>
          </div>
        ) : null}
      </form>
    );
  },
);

function extensionForMime(mime: string): string {
  switch (mime) {
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/jpeg":
    default:
      return "jpg";
  }
}

export default AtlasComposer;
