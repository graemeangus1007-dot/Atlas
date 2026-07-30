"use client";

import { useId, useState } from "react";
import { parseCritiqueAssistantContent } from "@/lib/ai/critique-fallback-presentation";
import { parseCritiqueMessage } from "@/lib/ai/critique-message-presentation";

type AtlasCritiqueMessageProps = {
  content: string;
  messageId: string;
  expanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
};

/**
 * Conversation-region critique renderer — narrative only.
 * Apply All / improvement cards live in the Action Area, not here.
 */
export default function AtlasCritiqueMessage({
  content,
  messageId,
  expanded: controlledExpanded,
  onExpandedChange,
}: AtlasCritiqueMessageProps) {
  const parsedFallback = parseCritiqueAssistantContent(content);
  const critique = parseCritiqueMessage(parsedFallback.body);
  const reactId = useId();
  const fullId = `${reactId}-full-${messageId}`;
  const [internalExpanded, setInternalExpanded] = useState(false);
  const expanded = controlledExpanded ?? internalExpanded;

  function setExpanded(next: boolean) {
    if (onExpandedChange) onExpandedChange(next);
    else setInternalExpanded(next);
  }

  if (critique.kind === "plain") {
    const showCollapse = critique.shouldCollapseFull;
    const visible =
      showCollapse && !expanded ? critique.executiveSummary : critique.fullText;

    return (
      <div
        className="mt-1 max-w-[40rem] space-y-2"
        data-testid="atlas-plain-message"
      >
        {parsedFallback.fallbackCard ? (
          <div
            className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-2 text-xs leading-relaxed text-foreground"
            data-testid="atlas-critique-fallback-card"
          >
            {parsedFallback.fallbackCard.split("\n").map((line, i) => (
              <p key={i} className="[&:not(:first-child)]:mt-0.5">
                {line}
              </p>
            ))}
          </div>
        ) : null}
        <p className="whitespace-pre-wrap text-sm leading-relaxed">{visible}</p>
        {showCollapse ? (
          <button
            type="button"
            className="text-[11px] font-medium text-muted underline-offset-2 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
            aria-expanded={expanded}
            aria-controls={fullId}
            onClick={() => setExpanded(!expanded)}
            data-testid="atlas-toggle-full-message"
          >
            {expanded ? "▲ Hide full message" : "▼ View full message"}
          </button>
        ) : null}
        {expanded && showCollapse ? (
          <div id={fullId} className="sr-only">
            Expanded
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div
      className="mt-1 max-w-[40rem] space-y-3"
      data-testid="atlas-critique-message"
      data-message-id={messageId}
    >
      {parsedFallback.fallbackCard ? (
        <div
          className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-2 text-xs leading-relaxed text-foreground"
          data-testid="atlas-critique-fallback-card"
        >
          {parsedFallback.fallbackCard.split("\n").map((line, i) => (
            <p key={i} className="[&:not(:first-child)]:mt-0.5">
              {line}
            </p>
          ))}
        </div>
      ) : null}

      <section aria-labelledby={`${reactId}-summary`}>
        <h3
          id={`${reactId}-summary`}
          className="text-[11px] font-semibold uppercase tracking-wide text-muted"
        >
          Executive Summary
        </h3>
        <p className="mt-1 text-sm leading-relaxed text-foreground">
          {critique.executiveSummary}
        </p>
        {critique.designDirection ? (
          <p className="mt-1.5 text-xs leading-relaxed text-muted">
            <span className="font-medium text-foreground/85">Direction · </span>
            {critique.designDirection}
          </p>
        ) : null}
      </section>

      {critique.expectedOutcome ? (
        <section aria-labelledby={`${reactId}-outcome`}>
          <h3
            id={`${reactId}-outcome`}
            className="text-[11px] font-semibold uppercase tracking-wide text-muted"
          >
            Expected Outcome
          </h3>
          <p className="mt-1 text-sm leading-relaxed text-foreground">
            {critique.expectedOutcome}
          </p>
        </section>
      ) : null}

      {critique.strengths.length > 0 && expanded ? (
        <section aria-labelledby={`${reactId}-strengths`}>
          <h3
            id={`${reactId}-strengths`}
            className="text-[11px] font-semibold uppercase tracking-wide text-muted"
          >
            Strengths
          </h3>
          <ul className="mt-1 list-disc space-y-1 pl-4 text-sm leading-relaxed text-muted">
            {critique.strengths.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <div>
        <button
          type="button"
          className="text-[11px] font-medium text-muted underline-offset-2 transition-colors hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 motion-reduce:transition-none"
          aria-expanded={expanded}
          aria-controls={fullId}
          onClick={() => setExpanded(!expanded)}
          data-testid="atlas-toggle-full-critique"
        >
          {expanded ? "▲ Hide full critique" : "▼ View full critique"}
        </button>
        {expanded ? (
          <div
            id={fullId}
            className="mt-2 whitespace-pre-wrap rounded-lg border border-border/50 bg-background/40 px-3 py-2 text-xs leading-relaxed text-muted"
            data-testid="atlas-full-critique-body"
          >
            {critique.fullText}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export { applyImprovementRequest } from "@/lib/ai/critique-message-presentation";
