"use client";

import { useEffect, useRef, useState } from "react";
import Button from "@/components/ui/button";
import type {
  BusinessAdvisorReport,
  BusinessRecommendation,
} from "@/lib/ai/business-advisor-types";
import {
  CRITIQUE_CATEGORY_LABELS,
  CRITIQUE_SCORE_CATEGORIES,
  type CritiqueScoreCategory,
} from "@/lib/ai/critique-scoring";
import type { EditChangeSummary } from "@/lib/ai/edit-operations";
import type { EditorConversationMessage } from "@/lib/ai/editor-conversation";
import type { BusinessProject } from "@/types/business-project";

export type AtlasAiUiStatus =
  | "idle"
  | "sending"
  | "applied"
  | "no_changes"
  | "needs_clarification"
  | "failed";

export type RecommendationApplyUiStatus =
  | "idle"
  | "applying"
  | "applied"
  | "failed"
  | "no_visible_change";

export type RecommendationApplyState = {
  status: RecommendationApplyUiStatus;
  message?: string | null;
  requestId?: string | null;
};

type AtlasAiPanelProps = {
  project: BusinessProject;
  projectId?: string | null;
  messages: EditorConversationMessage[];
  status: AtlasAiUiStatus;
  statusMessage?: string | null;
  canUndo: boolean;
  canRedo: boolean;
  lastChanges: EditChangeSummary[] | null;
  /** Full Atlas Review report (scores + opportunities). */
  advisorReport?: BusinessAdvisorReport | null;
  applyingRecommendationId?: string | null;
  recommendationStates?: Record<string, RecommendationApplyState>;
  onSend: (request: string) => void;
  onUndo: () => void;
  onRedo: () => void;
  onApplyRecommendation?: (recommendation: BusinessRecommendation) => void;
};

function impactBadgeClass(impact: BusinessRecommendation["impact"]): string {
  if (impact === "high") return "border-accent/50 text-foreground";
  if (impact === "medium") return "border-border text-muted";
  return "border-border/60 text-muted";
}

function scoreTone(score: number): string {
  if (score >= 80) return "text-emerald-300";
  if (score >= 60) return "text-amber-200";
  return "text-red-200";
}

function recStatusLabel(state: RecommendationApplyState | undefined): string | null {
  if (!state || state.status === "idle") return null;
  if (state.status === "applying") return "Applying";
  if (state.status === "applied") return "Applied";
  if (state.status === "failed") return "Failed";
  if (state.status === "no_visible_change") return "No visible change";
  return null;
}

function reviewStorageKey(projectId: string | null | undefined): string {
  return `atlas-review-expanded:${projectId ?? "local"}`;
}

function readReviewExpanded(
  projectId: string | null | undefined,
): boolean | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(reviewStorageKey(projectId));
    if (raw === "1") return true;
    if (raw === "0") return false;
  } catch {
    // ignore
  }
  return null;
}

function writeReviewExpanded(
  projectId: string | null | undefined,
  expanded: boolean,
) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      reviewStorageKey(projectId),
      expanded ? "1" : "0",
    );
  } catch {
    // ignore
  }
}

/**
 * Right-rail Atlas AI — conversation first, sticky prompt, collapsible Review below.
 */
export default function AtlasAiPanel({
  project,
  projectId = null,
  messages,
  status,
  statusMessage,
  canUndo,
  canRedo,
  lastChanges,
  advisorReport = null,
  applyingRecommendationId = null,
  recommendationStates = {},
  onSend,
  onUndo,
  onRedo,
  onApplyRecommendation,
}: AtlasAiPanelProps) {
  const [draft, setDraft] = useState("");
  const [expanded, setExpanded] = useState(true);
  const conversationEndRef = useRef<HTMLDivElement | null>(null);
  const sending = status === "sending" || Boolean(applyingRecommendationId);
  const recommendations = advisorReport?.recommendations ?? [];
  const hasReview = Boolean(advisorReport);
  const opportunityCount = recommendations.length;

  const reviewScope = projectId ?? "local";
  const [preferenceScope, setPreferenceScope] = useState(reviewScope);
  const [reviewPreference, setReviewPreference] = useState<boolean | null>(() =>
    readReviewExpanded(projectId),
  );

  // Reset stored preference when the active project changes (render-time sync).
  if (preferenceScope !== reviewScope) {
    setPreferenceScope(reviewScope);
    setReviewPreference(readReviewExpanded(projectId));
  }

  // No saved preference → open before chat, collapsed after chatting begins.
  const reviewOpen = reviewPreference ?? messages.length === 0;

  // Only auto-scroll the conversation region — never the recommendations.
  useEffect(() => {
    const node = conversationEndRef.current;
    if (node && typeof node.scrollIntoView === "function") {
      node.scrollIntoView({
        behavior: "smooth",
        block: "end",
      });
    }
  }, [messages, status, lastChanges]);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const value = draft.trim();
    if (!value || sending) return;
    setDraft("");
    onSend(value);
  }

  function toggleReview() {
    const next = !reviewOpen;
    setReviewPreference(next);
    writeReviewExpanded(projectId, next);
  }

  const statusLabel =
    status === "sending"
      ? "Sending…"
      : status === "applied"
        ? "Applied"
        : status === "no_changes"
          ? "No changes needed"
          : status === "needs_clarification"
            ? "Quick question"
            : status === "failed"
              ? "Failed"
              : null;

  return (
    <aside
      className="flex h-full min-h-0 w-full flex-col border-l border-border bg-surface/95 backdrop-blur-xl"
      aria-label="Atlas AI Design Assistant"
      aria-busy={sending || undefined}
      data-testid="atlas-ai-panel"
    >
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4">
        <div>
          <p className="font-[family-name:var(--font-atlas-display)] text-sm font-semibold text-foreground">
            Atlas AI
          </p>
          <p className="text-xs text-muted">Review + design assistant</p>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onUndo}
            disabled={!canUndo || sending}
            className="rounded-md px-2 py-1 text-xs text-muted transition-colors hover:bg-white/5 hover:text-foreground disabled:opacity-40"
            title="Undo last AI change"
          >
            Undo
          </button>
          <button
            type="button"
            onClick={onRedo}
            disabled={!canRedo || sending}
            className="rounded-md px-2 py-1 text-xs text-muted transition-colors hover:bg-white/5 hover:text-foreground disabled:opacity-40"
            title="Redo AI change"
          >
            Redo
          </button>
        </div>
      </div>

      {statusLabel ? (
        <div
          className={`shrink-0 border-b px-4 py-2 text-xs font-medium ${
            status === "failed"
              ? "border-red-500/30 bg-red-500/10 text-red-200"
              : status === "no_changes"
                ? "border-border bg-background/50 text-muted"
                : status === "needs_clarification"
                  ? "border-amber-500/30 bg-amber-500/10 text-foreground"
                  : status === "applied"
                    ? "border-accent/30 bg-accent/10 text-foreground"
                    : "border-border bg-background/40 text-muted"
          }`}
          role={status === "failed" ? "alert" : "status"}
          aria-live="polite"
        >
          {statusLabel}
          {statusMessage ? (
            <span className="mt-0.5 block font-normal opacity-90">
              {statusMessage}
            </span>
          ) : null}
        </div>
      ) : null}

      {/* Primary: scrollable conversation — largest area */}
      <div
        className="min-h-[12rem] flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 py-4"
        data-testid="atlas-conversation-region"
      >
        {messages.length === 0 && !hasReview ? (
          <div className="rounded-xl border border-border/70 bg-background/40 p-3 text-xs leading-relaxed text-muted">
            Ask Atlas to redesign this site — I’ll also keep a scored review
            ready under the composer.
          </div>
        ) : null}

        {messages.length === 0 && hasReview ? (
          <div className="rounded-xl border border-border/70 bg-background/40 p-3 text-xs leading-relaxed text-muted">
            Ask Atlas to redesign this site, or open Atlas Review below for
            one-click improvements.
          </div>
        ) : null}

        {messages.map((message) => (
          <div
            key={message.id}
            className={`rounded-xl px-3 py-2 text-sm ${
              message.role === "user"
                ? "ml-4 bg-[color:var(--site-accent,theme(colors.accent))]/15 text-foreground"
                : "mr-2 border border-border/70 bg-background/50 text-foreground"
            }`}
          >
            <p className="text-[10px] uppercase tracking-wide text-muted">
              {message.role === "user" ? "You" : "Atlas"}
            </p>
            <p className="mt-1 whitespace-pre-wrap leading-relaxed">
              {message.content}
            </p>
            {message.role === "assistant" &&
            message.changes &&
            message.changes.length > 0 ? (
              <ul className="mt-2 space-y-1 border-t border-border/50 pt-2 text-xs text-muted">
                {message.changes.map((change) => (
                  <li key={change.id} className="flex gap-2">
                    <span className="text-accent">✓</span>
                    <span>{change.label}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ))}

        {status === "sending" ? (
          <div className="mr-2 rounded-xl border border-border/70 bg-background/50 px-3 py-2 text-sm text-muted">
            <span className="inline-flex items-center gap-2">
              <span className="size-1.5 animate-pulse rounded-full bg-accent" />
              Sending…
            </span>
          </div>
        ) : null}

        {status === "applied" && lastChanges && lastChanges.length > 0 ? (
          <div className="rounded-xl border border-border/70 bg-background/40 p-3">
            <button
              type="button"
              className="flex w-full items-center justify-between text-left text-xs font-medium text-foreground"
              onClick={() => setExpanded((v) => !v)}
            >
              <span>
                {lastChanges.length} change
                {lastChanges.length === 1 ? "" : "s"} made
              </span>
              <span className="text-muted">{expanded ? "Hide" : "Expand"}</span>
            </button>
            {expanded ? (
              <ul className="mt-2 space-y-1.5 text-xs text-muted">
                {lastChanges.map((change) => (
                  <li key={change.id} className="flex gap-2">
                    <span className="text-accent">✓</span>
                    <span>{change.label}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        <div ref={conversationEndRef} />
      </div>

      {/* Sticky prompt composer */}
      <form
        onSubmit={handleSubmit}
        className="shrink-0 border-t border-border p-3"
        data-testid="atlas-prompt-region"
      >
        <label htmlFor="atlas-ai-prompt" className="sr-only">
          Design request
        </label>
        <textarea
          id="atlas-ai-prompt"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          rows={3}
          placeholder={`Ask about ${project.businessName || "this website"}…`}
          disabled={sending}
          className="w-full resize-none rounded-xl border border-border bg-background/60 px-3 py-2 text-sm text-foreground outline-none ring-accent/40 placeholder:text-muted focus:ring-2 disabled:opacity-60"
        />
        <div className="mt-2 flex justify-end">
          <Button
            type="submit"
            disabled={sending || !draft.trim()}
            className="px-4 py-2 text-xs"
          >
            {status === "sending" ? "Sending…" : "Send"}
          </Button>
        </div>
      </form>

      {/* Collapsible Atlas Review below the prompt */}
      {hasReview ? (
        <div
          className="shrink-0 border-t border-border bg-surface/90"
          data-testid="atlas-review-region"
        >
          <button
            type="button"
            className="flex w-full items-center justify-between px-4 py-2.5 text-left"
            onClick={toggleReview}
            aria-expanded={reviewOpen}
            data-testid="atlas-review-toggle"
          >
            <p className="text-xs font-medium text-foreground">
              Atlas Review
              <span className="font-normal text-muted">
                {" "}
                · {opportunityCount} opportunit
                {opportunityCount === 1 ? "y" : "ies"}
              </span>
            </p>
            <span className="text-[11px] text-muted">
              {reviewOpen ? "Hide" : "Show"}
            </span>
          </button>

          {reviewOpen ? (
            <div
              className="max-h-[min(32vh,16rem)] overflow-y-auto overscroll-contain border-t border-border/60 px-4 py-3"
              data-testid="atlas-review-body"
            >
              <p className="text-[11px] leading-relaxed text-muted">
                {advisorReport?.summary}
              </p>

              <div className="mt-3 flex items-end justify-between gap-3 rounded-lg border border-border/60 bg-background/50 px-3 py-2">
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-muted">
                    Overall score
                  </p>
                  <p
                    className={`mt-0.5 font-[family-name:var(--font-atlas-display)] text-2xl font-semibold tabular-nums ${scoreTone(advisorReport!.overallScore)}`}
                  >
                    {advisorReport!.overallScore}
                    <span className="ml-1 text-sm font-normal text-muted">
                      /100
                    </span>
                  </p>
                </div>
              </div>

              <ul className="mt-2 grid grid-cols-2 gap-1.5">
                {CRITIQUE_SCORE_CATEGORIES.map((key: CritiqueScoreCategory) => {
                  const value = advisorReport!.categoryScores[key];
                  return (
                    <li
                      key={key}
                      className="rounded-md border border-border/50 bg-background/40 px-2 py-1.5"
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[10px] text-muted">
                          {CRITIQUE_CATEGORY_LABELS[key]}
                        </span>
                        <span
                          className={`text-[11px] font-medium tabular-nums ${scoreTone(value)}`}
                        >
                          {value}
                        </span>
                      </div>
                      <div className="mt-1 h-1 overflow-hidden rounded-full bg-border/60">
                        <div
                          className="h-full rounded-full bg-accent/70"
                          style={{ width: `${value}%` }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>

              {recommendations.length > 0 ? (
                <ul className="mt-3 space-y-3">
                  {recommendations.map((rec) => {
                    const recState = recommendationStates[rec.id];
                    const applying =
                      applyingRecommendationId === rec.id ||
                      recState?.status === "applying";
                    const label = recStatusLabel(
                      applying ? { status: "applying" } : recState,
                    );
                    return (
                      <li
                        key={rec.id}
                        className="rounded-lg border border-border/60 bg-background/50 p-3"
                        data-testid={`advisor-rec-${rec.id}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-medium leading-snug text-foreground">
                            {rec.title}
                          </p>
                          <span
                            className={`shrink-0 rounded-md border px-1.5 py-0.5 text-[10px] uppercase tracking-wide ${impactBadgeClass(rec.impact)}`}
                          >
                            {rec.impact}
                          </span>
                        </div>

                        {label ? (
                          <p
                            className={`mt-1.5 text-[11px] font-medium ${
                              recState?.status === "failed"
                                ? "text-red-200"
                                : recState?.status === "no_visible_change"
                                  ? "text-amber-200"
                                  : recState?.status === "applied"
                                    ? "text-emerald-300"
                                    : "text-muted"
                            }`}
                            role={
                              recState?.status === "failed" ? "alert" : "status"
                            }
                            data-testid={`advisor-rec-status-${rec.id}`}
                          >
                            {label}
                            {recState?.message ? (
                              <span className="mt-0.5 block font-normal opacity-90">
                                {recState.message}
                              </span>
                            ) : null}
                            {recState?.requestId &&
                            (recState.status === "failed" ||
                              recState.status === "no_visible_change") ? (
                              <span className="mt-0.5 block font-mono text-[10px] opacity-70">
                                Request ID: {recState.requestId}
                              </span>
                            ) : null}
                          </p>
                        ) : null}

                        <dl className="mt-2 space-y-1.5 text-xs leading-relaxed text-muted">
                          <div>
                            <dt className="font-medium text-foreground/85">
                              What I noticed
                            </dt>
                            <dd className="mt-0.5">{rec.noticed}</dd>
                          </div>
                          <div>
                            <dt className="font-medium text-foreground/85">
                              Why it matters
                            </dt>
                            <dd className="mt-0.5">{rec.whyItMatters}</dd>
                          </div>
                          <div>
                            <dt className="font-medium text-foreground/85">
                              Expected outcome
                            </dt>
                            <dd className="mt-0.5">{rec.expectedOutcome}</dd>
                          </div>
                          <div className="flex flex-wrap gap-x-3 gap-y-1 pt-0.5 text-[11px]">
                            <span>
                              <span className="text-foreground/80">Time · </span>
                              {rec.estimatedTime}
                            </span>
                            <span>
                              <span className="text-foreground/80">
                                Impact ·{" "}
                              </span>
                              {rec.impact === "high"
                                ? "High"
                                : rec.impact === "medium"
                                  ? "Medium"
                                  : "Low"}
                            </span>
                          </div>
                        </dl>

                        {onApplyRecommendation ? (
                          <button
                            type="button"
                            disabled={sending}
                            onClick={() => onApplyRecommendation(rec)}
                            className="mt-2.5 rounded-lg border border-accent/40 bg-accent/10 px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent/20 disabled:opacity-40"
                          >
                            {applying ? "Applying…" : "Apply"}
                          </button>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </aside>
  );
}
