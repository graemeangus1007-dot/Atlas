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

function statusClass(label: string): string {
  switch (label) {
    case "Saving...":
      return "text-muted";
    case "Unsaved changes":
      return "text-amber-300";
    case "Save failed":
      return "text-red-400";
    case "Saved":
      return "text-accent";
    default:
      return "text-muted";
  }
}

/**
 * Simplified editor top bar — brand, project, save status, Preview, Publish.
 */
export default function EditorTopBar({
  businessName,
  onSave,
  onMenuClick,
  onPublish,
}: EditorTopBarProps) {
  const { label, saveStatus, canSave, showRetry, retry, saveError, isSaving } =
    useAutosave();

  return (
    <header
      className="flex h-12 shrink-0 items-center gap-3 border-b border-border/70 bg-background/90 px-3 backdrop-blur-xl sm:px-4"
      data-testid="editor-topbar"
    >
      <button
        type="button"
        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border/80 transition-colors hover:bg-white/[0.03] lg:hidden"
        aria-label="Open editor sidebar"
        onClick={onMenuClick}
      >
        <span aria-hidden="true">☰</span>
      </button>

      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
        <Link
          href="/projects"
          className="rounded-md font-[family-name:var(--font-atlas-display)] text-base font-semibold tracking-tight text-foreground transition-colors hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          data-testid="editor-topbar-atlas"
        >
          Atlas
        </Link>
        <span className="hidden h-3.5 w-px bg-border sm:block" aria-hidden="true" />
        <p
          className="hidden min-w-0 truncate text-sm text-muted sm:block"
          data-testid="editor-topbar-project"
        >
          {businessName}
        </p>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
          <p
            className={`truncate text-xs ${statusClass(label)}`}
            aria-live="polite"
            data-testid="editor-topbar-save-status"
          >
            {label}
          </p>
          {showRetry ? (
            <button
              type="button"
              onClick={() => void retry()}
              className="text-xs font-medium text-accent underline-offset-2 hover:underline"
            >
              Retry
            </button>
          ) : null}
          {saveStatus === "unsaved" || saveStatus === "error" ? (
            <button
              type="button"
              onClick={showRetry ? () => void retry() : onSave}
              disabled={!canSave || isSaving}
              className="text-xs font-medium text-muted underline-offset-2 hover:text-foreground hover:underline"
              data-testid="editor-topbar-save"
            >
              Save
            </button>
          ) : null}
        </div>
        {showRetry && saveError ? (
          <p className="truncate text-[11px] text-red-400/80" title={saveError}>
            {saveError}
          </p>
        ) : null}
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2">
        <Button
          href="/preview"
          variant="ghost"
          className="px-3 py-1.5 text-xs sm:text-sm"
          data-testid="editor-topbar-preview"
        >
          Preview
        </Button>
        <Button
          type="button"
          className="px-3 py-1.5 text-xs sm:px-4 sm:text-sm"
          onClick={onPublish}
          data-testid="editor-topbar-publish"
        >
          Publish
        </Button>
        <Link
          href="/projects"
          className="hidden rounded-md px-2 py-1.5 text-xs text-muted transition-colors hover:text-foreground sm:inline-flex"
          data-testid="editor-topbar-projects"
          aria-label="Back to projects"
        >
          Projects
        </Link>
      </div>
    </header>
  );
}
