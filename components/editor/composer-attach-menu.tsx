"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  type KeyboardEvent,
} from "react";

export type ComposerAttachMenuAction =
  | "upload-photo"
  | "upload-logo"
  | "choose-existing";

type ComposerAttachMenuProps = {
  open: boolean;
  onClose: () => void;
  onAction: (action: ComposerAttachMenuAction) => void;
  anchorRef: React.RefObject<HTMLButtonElement | null>;
};

const ITEMS: Array<{
  action: ComposerAttachMenuAction;
  label: string;
  testId: string;
}> = [
  {
    action: "upload-photo",
    label: "Upload photo",
    testId: "composer-attach-upload-photo",
  },
  {
    action: "upload-logo",
    label: "Upload logo",
    testId: "composer-attach-upload-logo",
  },
  {
    action: "choose-existing",
    label: "Choose existing image",
    testId: "composer-attach-choose-existing",
  },
];

/**
 * Compact accessible menu for the composer + button.
 */
export default function ComposerAttachMenu({
  open,
  onClose,
  onAction,
  anchorRef,
}: ComposerAttachMenuProps) {
  const menuId = useId();
  const menuRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const restoreFocus = useCallback(() => {
    anchorRef.current?.focus();
  }, [anchorRef]);

  useEffect(() => {
    if (!open) return;
    const first = itemRefs.current[0];
    first?.focus();

    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (
        menuRef.current?.contains(target) ||
        anchorRef.current?.contains(target)
      ) {
        return;
      }
      onClose();
      restoreFocus();
    }

    function onKey(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        restoreFocus();
      }
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose, restoreFocus, anchorRef]);

  if (!open) return null;

  function handleItemKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      const next = itemRefs.current[(index + 1) % ITEMS.length];
      next?.focus();
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      const prev =
        itemRefs.current[(index - 1 + ITEMS.length) % ITEMS.length];
      prev?.focus();
    } else if (event.key === "Home") {
      event.preventDefault();
      itemRefs.current[0]?.focus();
    } else if (event.key === "End") {
      event.preventDefault();
      itemRefs.current[ITEMS.length - 1]?.focus();
    } else if (event.key === "Tab") {
      onClose();
    }
  }

  return (
    <div
      ref={menuRef}
      id={menuId}
      role="menu"
      aria-label="Attach to message"
      data-testid="composer-attach-menu"
      className="absolute bottom-full left-0 z-20 mb-1 min-w-[11.5rem] rounded-lg border border-border bg-surface py-1 shadow-md"
    >
      {ITEMS.map((item, index) => (
        <button
          key={item.action}
          ref={(node) => {
            itemRefs.current[index] = node;
          }}
          type="button"
          role="menuitem"
          data-testid={item.testId}
          className="flex w-full px-3 py-2 text-left text-sm text-foreground hover:bg-background/70 focus-visible:bg-background/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/50"
          onClick={() => {
            onAction(item.action);
            onClose();
            restoreFocus();
          }}
          onKeyDown={(event) => handleItemKeyDown(event, index)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
