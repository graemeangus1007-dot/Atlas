"use client";

import {
  useCallback,
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { ACCEPTED_IMAGE_ACCEPT } from "@/data/media";

type DropZoneProps = {
  onFiles: (files: File[]) => void;
  disabled?: boolean;
  multiple?: boolean;
  children?: ReactNode;
  className?: string;
  label?: string;
};

/**
 * Accessible drag-and-drop / click target for image files.
 */
export default function DropZone({
  onFiles,
  disabled = false,
  multiple = true,
  children,
  className = "",
  label = "Upload images",
}: DropZoneProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const emitFiles = useCallback(
    (list: FileList | File[] | null) => {
      if (!list || disabled) return;
      const files = Array.from(list);
      if (files.length > 0) onFiles(files);
    },
    [disabled, onFiles],
  );

  function openPicker() {
    if (!disabled) inputRef.current?.click();
  }

  function onDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    if (!disabled) setDragging(true);
  }

  function onDragLeave(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    emitFiles(event.dataTransfer.files);
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openPicker();
    }
  }

  function onChange(event: ChangeEvent<HTMLInputElement>) {
    emitFiles(event.target.files);
    event.target.value = "";
  }

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-label={label}
      aria-disabled={disabled || undefined}
      aria-controls={inputId}
      onClick={openPicker}
      onKeyDown={onKeyDown}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={`rounded-xl border border-dashed px-4 py-6 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
        dragging
          ? "border-accent bg-accent-soft"
          : "border-border bg-background/40 hover:border-white/20"
      } ${disabled ? "cursor-wait opacity-70" : "cursor-pointer"} ${className}`}
    >
      {children}

      <input
        id={inputId}
        ref={inputRef}
        type="file"
        accept={ACCEPTED_IMAGE_ACCEPT}
        multiple={multiple}
        className="sr-only"
        onChange={onChange}
        disabled={disabled}
        tabIndex={-1}
        aria-hidden="true"
      />
    </div>
  );
}
