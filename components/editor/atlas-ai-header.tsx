"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { AtlasAiUiStatus } from "@/components/editor/atlas-ai-panel-types";

type AtlasAiHeaderProps = {
  status: AtlasAiUiStatus;
  applying: boolean;
  websiteScore?: number | null;
  hasNewReview?: boolean;
  canUndo: boolean;
  canRedo: boolean;
  sending: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onOpenReview: () => void;
  onOpenPlan?: () => void;
  onNewConversation?: () => void;
  onClearConversation?: () => void;
};

function statusDotLabel(
  status: AtlasAiUiStatus,
  applying: boolean,
): { label: string; tone: string } {
  if (applying) return { label: "Working", tone: "bg-accent" };
  if (status === "sending") return { label: "Reviewing", tone: "bg-accent" };
  if (status === "failed") return { label: "Couldn’t finish", tone: "bg-red-400" };
  if (status === "applied") return { label: "Done", tone: "bg-emerald-400" };
  if (status === "needs_clarification") {
    return { label: "One question", tone: "bg-amber-400" };
  }
  return { label: "Ready", tone: "bg-emerald-400/80" };
}

export default function AtlasAiHeader({
  status,
  applying,
  websiteScore = null,
  hasNewReview = false,
  canUndo,
  canRedo,
  sending,
  onUndo,
  onRedo,
  onOpenReview,
  onOpenPlan,
  onNewConversation,
  onClearConversation,
}: AtlasAiHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuId = useId();
  const menuRef = useRef<HTMLDivElement | null>(null);
  const { label, tone } = statusDotLabel(status, applying);

  useEffect(() => {
    if (!menuOpen) return;
    function onDoc(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  return (
    <header
      className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-border px-4"
      data-testid="atlas-ai-header"
    >
      <div className="flex min-w-0 items-center gap-3">
        <p className="font-[family-name:var(--font-atlas-display)] text-sm font-semibold text-foreground">
          Atlas
        </p>
        <p
          className="flex items-center gap-1.5 text-xs text-muted"
          role="status"
          aria-live="polite"
          data-testid="atlas-status-pill"
        >
          <span
            className={`size-1.5 rounded-full ${tone} motion-reduce:transition-none`}
            aria-hidden
          />
          <span>{label}</span>
        </p>
      </div>

      <div className="flex items-center gap-1">
        {websiteScore != null ? (
          <button
            type="button"
            onClick={onOpenReview}
            className="relative rounded-md px-2 py-1 text-xs text-muted transition-colors hover:bg-background/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
            data-testid="atlas-open-review"
          >
            Website health · {websiteScore}
            {hasNewReview ? (
              <span
                className="absolute right-0.5 top-0.5 size-1.5 rounded-full bg-accent"
                aria-label="New recommendations"
                data-testid="atlas-review-dot"
              />
            ) : null}
          </button>
        ) : (
          <button
            type="button"
            onClick={onOpenReview}
            className="rounded-md px-2 py-1 text-xs text-muted transition-colors hover:bg-background/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
            data-testid="atlas-open-review"
          >
            Review website
          </button>
        )}

        <div className="relative" ref={menuRef}>
          <button
            type="button"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-controls={menuId}
            onClick={() => setMenuOpen((v) => !v)}
            className="rounded-md px-2 py-1 text-xs text-muted transition-colors hover:bg-background/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
            data-testid="atlas-overflow-menu"
            aria-label="More Atlas options"
          >
            ⋯
          </button>
          {menuOpen ? (
            <div
              id={menuId}
              role="menu"
              className="absolute right-0 z-30 mt-1 min-w-[11rem] rounded-lg border border-border bg-surface py-1 shadow-lg"
              data-testid="atlas-overflow-menu-panel"
            >
              {onNewConversation ? (
                <button
                  type="button"
                  role="menuitem"
                  className="block w-full px-3 py-1.5 text-left text-xs text-foreground hover:bg-background/60"
                  onClick={() => {
                    setMenuOpen(false);
                    onNewConversation();
                  }}
                >
                  New conversation
                </button>
              ) : null}
              {onClearConversation ? (
                <button
                  type="button"
                  role="menuitem"
                  className="block w-full px-3 py-1.5 text-left text-xs text-foreground hover:bg-background/60"
                  onClick={() => {
                    setMenuOpen(false);
                    onClearConversation();
                  }}
                >
                  Clear conversation
                </button>
              ) : null}
              <button
                type="button"
                role="menuitem"
                className="block w-full px-3 py-1.5 text-left text-xs text-foreground hover:bg-background/60"
                onClick={() => {
                  setMenuOpen(false);
                  onOpenReview();
                }}
              >
                Site suggestions
              </button>
              {onOpenPlan ? (
                <button
                  type="button"
                  role="menuitem"
                  className="block w-full px-3 py-1.5 text-left text-xs text-foreground hover:bg-background/60"
                  onClick={() => {
                    setMenuOpen(false);
                    onOpenPlan();
                  }}
                >
                  View active plan
                </button>
              ) : null}
              <div className="my-1 border-t border-border" />
              <button
                type="button"
                role="menuitem"
                disabled={!canUndo || sending}
                className="block w-full px-3 py-1.5 text-left text-xs text-foreground hover:bg-background/60 disabled:opacity-40"
                onClick={() => {
                  setMenuOpen(false);
                  onUndo();
                }}
              >
                Undo
              </button>
              <button
                type="button"
                role="menuitem"
                disabled={!canRedo || sending}
                className="block w-full px-3 py-1.5 text-left text-xs text-foreground hover:bg-background/60 disabled:opacity-40"
                onClick={() => {
                  setMenuOpen(false);
                  onRedo();
                }}
              >
                Redo
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
