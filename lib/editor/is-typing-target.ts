type TypingElement = {
  tagName?: string;
  isContentEditable?: boolean;
  closest?: (selector: string) => unknown;
};

/**
 * True when keyboard events should go to the focused field (not editor shortcuts).
 * Shortcuts that handle Space / letters must bail out when this returns true.
 */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!target || typeof target !== "object") return false;

  const el = target as TypingElement;
  const tag = typeof el.tagName === "string" ? el.tagName.toUpperCase() : "";

  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") {
    return true;
  }

  if (el.isContentEditable) return true;

  if (typeof el.closest === "function") {
    return Boolean(
      el.closest("input, textarea, select, [contenteditable='true']"),
    );
  }

  return false;
}

/**
 * Guard for editor shortcuts (Space, etc.).
 * Returns true when the shortcut may run (focus is not in a text field).
 */
export function shouldRunEditorShortcut(event: {
  target: EventTarget | null;
  defaultPrevented?: boolean;
}): boolean {
  if (event.defaultPrevented) return false;
  return !isTypingTarget(event.target);
}
