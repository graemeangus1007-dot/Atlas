"use client";

type AtlasActivePlanBarProps = {
  improvementCount: number;
  sending: boolean;
  applying: boolean;
  appliedCount?: number | null;
  onReview: () => void;
  onApplyAll: () => void;
  onViewChanges?: () => void;
  onCancel?: () => void;
};

/**
 * Compact contextual action bar — at most two rows.
 * Authoritative Apply All surface for the active plan.
 */
export default function AtlasActivePlanBar({
  improvementCount,
  sending,
  applying,
  appliedCount = null,
  onReview,
  onApplyAll,
  onViewChanges,
  onCancel,
}: AtlasActivePlanBarProps) {
  if (improvementCount <= 0 && appliedCount == null && !applying) {
    return (
      <section
        className="min-h-0 border-t border-transparent"
        data-testid="atlas-action-region"
        data-empty="true"
        aria-label="Atlas actions"
      />
    );
  }

  return (
    <section
      className="shrink-0 border-t border-border bg-surface/95 px-3 py-2"
      data-testid="atlas-action-region"
      aria-label="Active plan"
    >
      <div
        className="flex flex-wrap items-center justify-between gap-2"
        data-testid="atlas-active-plan-bar"
        data-rows="1"
      >
        {applying ? (
          <>
            <p className="text-xs text-foreground" role="status" aria-live="polite">
              Applying those improvements…
            </p>
            {onCancel ? (
              <button
                type="button"
                onClick={onCancel}
                className="rounded-md px-2 py-1 text-xs text-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
              >
                Cancel
              </button>
            ) : null}
          </>
        ) : appliedCount != null && appliedCount > 0 ? (
          <>
            <p className="text-xs text-foreground" role="status">
              {appliedCount} recommendation{appliedCount === 1 ? "" : "s"} applied
            </p>
            {onViewChanges ? (
              <button
                type="button"
                onClick={onViewChanges}
                className="rounded-md px-2 py-1 text-xs font-medium text-foreground hover:bg-background/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
                data-testid="atlas-view-changes"
              >
                View changes
              </button>
            ) : null}
          </>
        ) : (
          <>
            <p
              className="text-xs text-foreground"
              data-testid="atlas-critique-apply-all-card"
            >
              {improvementCount} improvement
              {improvementCount === 1 ? "" : "s"} ready
            </p>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={sending}
                onClick={onReview}
                className="rounded-md border border-border px-2.5 py-1 text-xs text-muted transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 disabled:opacity-40"
                data-testid="atlas-review-plan"
              >
                Review
              </button>
              <button
                type="button"
                disabled={sending}
                onClick={onApplyAll}
                className="rounded-md border border-accent/50 bg-accent/15 px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-accent/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 disabled:opacity-40"
                data-testid="atlas-critique-apply-all"
              >
                Apply all
              </button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
