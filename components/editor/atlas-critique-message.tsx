"use client";

import { useId } from "react";
import { parseCritiqueAssistantContent } from "@/lib/ai/critique-fallback-presentation";
import { parseCritiqueMessage } from "@/lib/ai/critique-message-presentation";

type AtlasCritiqueMessageProps = {
  content: string;
  messageId: string;
  onReviewPlan?: () => void;
  onApplyAll?: () => void;
  showPlanActions?: boolean;
};

/**
 * Compact critique in conversation — agency-quality review summary + plan CTAs.
 * Empty sections are never rendered (v1.6.3 invariant).
 */
export default function AtlasCritiqueMessage({
  content,
  messageId,
  onReviewPlan,
  onApplyAll,
  showPlanActions = true,
}: AtlasCritiqueMessageProps) {
  const parsedFallback = parseCritiqueAssistantContent(content);
  const critique = parseCritiqueMessage(parsedFallback.body);
  const reactId = useId();

  if (critique.kind === "plain") {
    const showCollapse = critique.shouldCollapseFull;
    const visible = showCollapse
      ? critique.executiveSummary
      : critique.fullText;

    return (
      <div
        className="mt-1 max-w-[36rem] space-y-2"
        data-testid="atlas-plain-message"
      >
        {parsedFallback.fallbackCard ? (
          <FallbackCard text={parsedFallback.fallbackCard} />
        ) : null}
        <p className="whitespace-pre-wrap text-sm leading-relaxed">{visible}</p>
        {showCollapse ? (
          <details className="text-[11px] text-muted">
            <summary
              className="cursor-pointer font-medium hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
              data-testid="atlas-toggle-full-message"
            >
              View full message
            </summary>
            <p className="mt-2 whitespace-pre-wrap leading-relaxed">
              {critique.fullText}
            </p>
          </details>
        ) : null}
      </div>
    );
  }

  const count = critique.improvements.length;
  const strengths = critique.strengths ?? [];
  const needsInput = critique.needsInput ?? [];
  const highestPriority = critique.highestPriority?.trim() || null;

  return (
    <div
      className="mt-1 max-w-[36rem] space-y-3"
      data-testid="atlas-critique-message"
      data-message-id={messageId}
    >
      {parsedFallback.fallbackCard ? (
        <FallbackCard text={parsedFallback.fallbackCard} />
      ) : null}

      <div>
        <h3
          id={`${reactId}-title`}
          className="text-[11px] font-semibold uppercase tracking-wide text-muted"
        >
          Homepage review
        </h3>
        <p className="mt-1 text-sm leading-relaxed text-foreground">
          {critique.executiveSummary}
        </p>
      </div>

      {strengths.length > 0 ? (
        <section data-testid="atlas-review-strengths">
          <h4 className="text-[11px] font-semibold uppercase tracking-wide text-muted">
            What&apos;s working
          </h4>
          <ul className="mt-1 space-y-1 text-sm leading-relaxed text-foreground">
            {strengths.map((item) => (
              <li key={item}>• {item}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {highestPriority ? (
        <section data-testid="atlas-review-highest-priority">
          <h4 className="text-[11px] font-semibold uppercase tracking-wide text-muted">
            Highest priority
          </h4>
          <p className="mt-1 text-sm font-medium leading-relaxed text-foreground">
            {highestPriority}
          </p>
        </section>
      ) : null}

      {count > 0 ? (
        <section data-testid="atlas-review-next-improvements">
          <h4 className="text-[11px] font-semibold uppercase tracking-wide text-muted">
            Next improvements
          </h4>
          <ol className="mt-1 list-decimal space-y-1 pl-4 text-sm leading-relaxed text-foreground">
            {critique.improvements.slice(0, 5).map((item) => (
              <li key={`${item.index}-${item.title}`}>{item.title}</li>
            ))}
          </ol>
        </section>
      ) : null}

      {needsInput.length > 0 ? (
        <section data-testid="atlas-review-needs-input">
          <h4 className="text-[11px] font-semibold uppercase tracking-wide text-muted">
            Needs your input
          </h4>
          <ul className="mt-1 space-y-1 text-sm leading-relaxed text-foreground">
            {needsInput.map((item) => (
              <li key={item}>• {item}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {count > 0 ? (
        <p className="text-xs text-muted">
          {count} improvement{count === 1 ? "" : "s"} ready
        </p>
      ) : null}

      {showPlanActions && (critique.applyAllReady || count > 0) ? (
        <div className="flex flex-wrap gap-2">
          {onReviewPlan ? (
            <button
              type="button"
              onClick={onReviewPlan}
              className="rounded-md border border-border px-2.5 py-1 text-xs text-muted transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
              data-testid="atlas-message-review-plan"
            >
              Review plan
            </button>
          ) : null}
          {onApplyAll ? (
            <button
              type="button"
              onClick={onApplyAll}
              className="rounded-md border border-accent/45 bg-accent/10 px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-accent/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
              data-testid="atlas-message-apply-all"
            >
              Apply all
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function FallbackCard({ text }: { text: string }) {
  return (
    <div
      className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-2 text-xs leading-relaxed text-foreground"
      data-testid="atlas-critique-fallback-card"
    >
      {text.split("\n").map((line, i) => (
        <p key={i} className="[&:not(:first-child)]:mt-0.5">
          {line}
        </p>
      ))}
    </div>
  );
}

export { applyImprovementRequest } from "@/lib/ai/critique-message-presentation";
