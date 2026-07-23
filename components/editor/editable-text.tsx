"use client";

import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";

type EditableTextProps = {
  value: string;
  onChange: (value: string) => void;
  as?: "h1" | "h2" | "p" | "span";
  multiline?: boolean;
  className?: string;
  inputClassName?: string;
  placeholder?: string;
  "aria-label"?: string;
  /** When set, shows “Improve with AI” while the field is active. */
  onImproveWithAi?: (currentValue: string) => void;
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
  onImproveWithAi,
}: EditableTextProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const skipBlurCommit = useRef(false);

  useEffect(() => {
    if (!isEditing) setDraft(value);
  }, [value, isEditing]);

  useEffect(() => {
    if (!isEditing) return;
    const field = multiline ? textareaRef.current : inputRef.current;
    field?.focus();
    field?.select();
  }, [isEditing, multiline]);

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
    if (skipBlurCommit.current) {
      skipBlurCommit.current = false;
      return;
    }
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

  const improveButton =
    onImproveWithAi && isEditing ? (
      <button
        type="button"
        className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface/90 px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-accent/40 hover:bg-accent-soft"
        onMouseDown={(event) => {
          // Prevent input blur from committing before the click lands.
          event.preventDefault();
          skipBlurCommit.current = true;
        }}
        onClick={() => {
          const next = draft.trim();
          onChange(next);
          setIsEditing(false);
          onImproveWithAi(next);
        }}
      >
        ✨ Improve with AI
      </button>
    ) : null;

  if (isEditing) {
    const sharedClass = `w-full rounded-xl border border-[color:var(--site-accent)] bg-surface/90 px-3 py-2 text-inherit outline-none ring-2 ring-[color:var(--site-accent)]/30 ${inputClassName}`;

    if (multiline) {
      return (
        <div className="w-full">
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
          {improveButton}
        </div>
      );
    }

    return (
      <div className="w-full">
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
        {improveButton}
      </div>
    );
  }

  return (
    <Tag
      role="button"
      tabIndex={0}
      aria-label={ariaLabel ?? `Edit ${placeholder}`}
      title="Click to edit"
      className={`cursor-text rounded-lg outline-none transition-shadow hover:ring-2 hover:ring-[color:var(--site-accent)]/35 focus-visible:ring-2 focus-visible:ring-[color:var(--site-accent)]/50 ${className}`}
      onClick={() => setIsEditing(true)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          setIsEditing(true);
        }
      }}
    >
      {value || placeholder}
    </Tag>
  );
}
