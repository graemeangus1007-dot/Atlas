"use client";

import { useEffect, useRef } from "react";
import type { CompactChangeSummary } from "@/components/editor/atlas-change-summary";

type AtlasChangesViewProps = {
  summary: CompactChangeSummary;
  onBack: () => void;
};

export default function AtlasChangesView({
  summary,
  onBack,
}: AtlasChangesViewProps) {
  const backRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    backRef.current?.focus();
  }, []);

  return (
    <section
      className="flex min-h-0 flex-1 flex-col"
      data-testid="atlas-changes-view"
      aria-label="Website changes"
    >
      <div className="flex shrink-0 items-center border-b border-border px-4 py-2.5">
        <button
          ref={backRef}
          type="button"
          onClick={onBack}
          className="rounded-md px-2 py-1 text-xs font-medium text-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
          data-testid="atlas-back-to-conversation"
        >
          ← Back to conversation
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <h2 className="font-[family-name:var(--font-atlas-display)] text-base font-semibold text-foreground">
          Website changes
        </h2>
        <p className="mt-1 text-sm text-muted">
          {summary.count} change{summary.count === 1 ? "" : "s"}
          {summary.areas.length > 0
            ? ` across ${summary.areas.join(" · ")}`
            : ""}
        </p>
        <ul className="mt-4 space-y-2 text-sm text-foreground">
          {summary.items.map((change) => (
            <li key={change.id} className="flex gap-2 border-b border-border/40 pb-2">
              <span className="text-accent" aria-hidden>
                ✓
              </span>
              <span>{change.label}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
