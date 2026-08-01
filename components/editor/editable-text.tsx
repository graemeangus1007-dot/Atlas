"use client";

import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { shouldRunEditorShortcut } from "@/lib/editor/is-typing-target";

type EditableTextProps = {
  value: string;
  onChange: (value: string) => void;
  as?: "h1" | "h2" | "p" | "span";
  multiline?: boolean;
  className?: string;
  inputClassName?: string;
  placeholder?: string;
  "aria-label"?: string;
};

/**
 * Click-to-edit text control.
 * Enter (single-line) or Ctrl/Cmd+Enter (multiline) / blur saves;
 * Escape cancels.
 */
export default function EditableText({
  value,
  onChange,
  as: Tag = "p",
  multiline = false,
  className = "",
  inputClassName = "",
  placeholder = "Click to edit",
  "aria-label": ariaLabel,
}: EditableTextProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!isEditing) return;
    const field = multiline ? textareaRef.current : inputRef.current;
    field?.focus();
    field?.select();
  }, [isEditing, multiline]);

  function beginEditing() {
    setDraft(value);
    setIsEditing(true);
  }

  function commit() {
    const next = draft.trim();
    setDraft(next);
    onChange(next);
    setIsEditing(false);
  }

  function cancel() {
    setDraft(value);
    setIsEditing(false);
  }

  function handleBlur() {
    commit();
  }

  function handleKeyDown(
    event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) {
    if (event.key === "Escape") {
      event.preventDefault();
      cancel();
      return;
    }

    if (event.key === "Enter") {
      if (multiline && !(event.metaKey || event.ctrlKey)) return;
      event.preventDefault();
      commit();
    }
  }

  if (isEditing) {
    const sharedClass = `w-full rounded-xl border border-[color:var(--site-accent)] bg-surface/90 px-3 py-2 text-inherit outline-none ring-2 ring-[color:var(--site-accent)]/30 ${inputClassName}`;

    if (multiline) {
      return (
        <textarea
          ref={textareaRef}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          rows={5}
          aria-label={ariaLabel}
          className={`${sharedClass} resize-y leading-relaxed`}
        />
      );
    }

    return (
      <input
        ref={inputRef}
        type="text"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        aria-label={ariaLabel}
        className={sharedClass}
      />
    );
  }

  return (
    <Tag
      role="button"
      tabIndex={0}
      aria-label={ariaLabel ?? `Edit ${placeholder}`}
      title="Click to edit"
      className={`cursor-text rounded-lg outline-none transition-shadow hover:ring-2 hover:ring-[color:var(--site-accent)]/35 focus-visible:ring-2 focus-visible:ring-[color:var(--site-accent)]/50 ${className}`}
      onClick={beginEditing}
      onKeyDown={(event) => {
        // Never steal Space/Enter from nested or focused text fields.
        if (!shouldRunEditorShortcut(event)) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          beginEditing();
        }
      }}
    >
      {value || placeholder}
    </Tag>
  );
}
