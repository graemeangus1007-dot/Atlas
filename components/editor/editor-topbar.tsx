"use client";

import Link from "next/link";
import Button from "@/components/ui/button";
import { useAutosave } from "@/hooks/use-autosave";

type EditorTopBarProps = {
  businessName: string;
  onSave: () => void;
  onMenuClick: () => void;
  onPublish: () => void;
};

/**
 * Editor top navigation — Atlas brand, project name, autosave, and actions.
 */
export default function EditorTopBar({
  businessName,
  onSave,
  onMenuClick,
  onPublish,
}: EditorTopBarProps) {
  const { label, saveStatus, canSave } = useAutosave();

  const saveButtonLabel =
    saveStatus === "saving"
      ? "Saving..."
      : saveStatus === "saved"
        ? "Saved ✓"
        : "Save Changes";

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background/90 px-3 backdrop-blur-xl sm:px-5">
      <button
        type="button"
        className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border transition-colors hover:bg-white/[0.03] lg:hidden"
        aria-label="Open editor sidebar"
        onClick={onMenuClick}
      >
        <span aria-hidden="true">☰</span>
      </button>

      <Link
        href="/"
        className="rounded-md font-[family-name:var(--font-atlas-display)] text-lg font-semibold tracking-tight text-foreground transition-colors hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        Atlas
      </Link>

      <span className="hidden h-4 w-px bg-border sm:block" aria-hidden="true" />

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">
          {businessName}
        </p>
        <p className="truncate text-xs text-muted" aria-live="polite">
          {canSave ? label : "Create or open a project to autosave"}
        </p>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        <Button
          type="button"
          variant="secondary"
          onClick={onSave}
          disabled={!canSave || saveStatus === "saving"}
          className="px-3 py-2 text-xs transition-all sm:px-4 sm:text-sm"
        >
          {saveButtonLabel}
        </Button>
        <Button
          href="/preview"
          variant="ghost"
          className="hidden px-4 py-2 text-sm sm:inline-flex"
        >
          Preview
        </Button>
        <Button
          type="button"
          className="px-3 py-2 text-xs sm:px-4 sm:text-sm"
          onClick={onPublish}
        >
          Publish Website
        </Button>
        <Button
          href="/dashboard"
          variant="ghost"
          className="hidden px-3 py-2 text-xs sm:inline-flex sm:px-4 sm:text-sm"
        >
          Dashboard
        </Button>
      </div>
    </header>
  );
}
