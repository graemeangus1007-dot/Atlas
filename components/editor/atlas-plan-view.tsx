"use client";

import { useEffect, useRef } from "react";
import type { CritiqueImprovementCard } from "@/lib/ai/critique-message-presentation";

type AtlasPlanViewProps = {
  designDirection: string | null;
  improvements: CritiqueImprovementCard[];
  sending: boolean;
  onBack: () => void;
  onApplyAll: () => void;
  onApplyImprovement: (index: number) => void;
};

export default function AtlasPlanView({
  designDirection,
  improvements,
  sending,
  onBack,
  onApplyAll,
  onApplyImprovement,
}: AtlasPlanViewProps) {
  const backRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    backRef.current?.focus();
  }, []);

  return (
    <section
      className="flex min-h-0 flex-1 flex-col"
      data-testid="atlas-plan-view"
      aria-label="Review plan"
    >
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-4 py-2.5">
        <button
          ref={backRef}
          type="button"
          onClick={onBack}
          className="rounded-md px-2 py-1 text-xs font-medium text-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
          data-testid="atlas-back-to-conversation"
        >
          ← Back to conversation
        </button>
        <button
          type="button"
          disabled={sending || improvements.length === 0}
          onClick={onApplyAll}
          className="rounded-md border border-accent/50 bg-accent/15 px-2.5 py-1 text-xs font-medium text-foreground hover:bg-accent/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 disabled:opacity-40"
        >
          Apply all
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4">
        <h2 className="font-[family-name:var(--font-atlas-display)] text-base font-semibold text-foreground">
          Review plan
        </h2>
        {designDirection ? (
          <p className="mt-2 text-sm leading-relaxed text-muted">
            <span className="font-medium text-foreground/85">Direction · </span>
            {designDirection}
          </p>
        ) : null}

        <ol className="mt-4 space-y-3" data-testid="atlas-plan-improvements">
          {improvements.map((card) => (
            <li
              key={`${card.index}-${card.title}`}
              className="border-b border-border/50 pb-3 last:border-0"
              data-testid={`critique-improvement-card-${card.index}`}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium text-foreground">
                  <span className="mr-2 tabular-nums text-muted">
                    {card.index}
                  </span>
                  {card.title}
                </p>
                <span className="shrink-0 text-[10px] uppercase tracking-wide text-muted">
                  {card.impact}
                </span>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-muted">
                {card.why}
              </p>
              <p className="mt-1 text-[11px] text-muted">
                Supported · {card.timeEstimate}
              </p>
              <button
                type="button"
                disabled={sending}
                onClick={() => onApplyImprovement(card.index - 1)}
                className="mt-2 rounded-md border border-accent/40 bg-accent/10 px-2.5 py-1 text-[11px] font-medium text-foreground hover:bg-accent/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 disabled:opacity-40"
              >
                Apply
              </button>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
