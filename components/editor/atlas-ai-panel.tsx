"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import AtlasActionArea from "@/components/editor/atlas-action-area";
import AtlasCritiqueMessage, {
  applyImprovementRequest,
} from "@/components/editor/atlas-critique-message";
import Button from "@/components/ui/button";
import type {
  BusinessAdvisorReport,
  BusinessRecommendation,
} from "@/lib/ai/business-advisor-types";
import type {
  CompleteWebsitePlan,
  CreativeDirectorRecommendation,
  CreativeDirectorReport,
} from "@/lib/ai/creative-director-types";
import { parseCritiqueAssistantContent } from "@/lib/ai/critique-fallback-presentation";
import { parseCritiqueMessage } from "@/lib/ai/critique-message-presentation";
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
  advisorReport?: BusinessAdvisorReport | null;
  creativeDirectorReport?: CreativeDirectorReport | null;
  completeWebsitePlan?: CompleteWebsitePlan | null;
  applyingRecommendationId?: string | null;
  recommendationStates?: Record<string, RecommendationApplyState>;
  onSend: (request: string) => void;
  onUndo: () => void;
  onRedo: () => void;
  onApplyRecommendation?: (recommendation: BusinessRecommendation) => void;
  onApplyCreativeRecommendation?: (
    recommendation: CreativeDirectorRecommendation,
  ) => void;
  onCompleteWebsite?: () => void;
  onApplyAllCreative?: () => void;
  onDismissCompletePlan?: () => void;
  followUpSuggestions?: string[];
  onFollowUpSuggestion?: (suggestion: string) => void;
};

const NEAR_BOTTOM_PX = 96;

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
 * Atlas AI — permanent three-region layout:
 * 1) Conversation (minmax(0,1fr) — only flexible region)
 * 2) Action Area (auto — recommendations / Apply All / plan)
 * 3) Composer (auto — never depends on conversation height)
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
  creativeDirectorReport = null,
  completeWebsitePlan = null,
  applyingRecommendationId = null,
  recommendationStates = {},
  onSend,
  onUndo,
  onRedo,
  onApplyRecommendation,
  onApplyCreativeRecommendation,
  onCompleteWebsite,
  onApplyAllCreative,
  onDismissCompletePlan,
  followUpSuggestions = [],
  onFollowUpSuggestion,
}: AtlasAiPanelProps) {
  const [draft, setDraft] = useState("");
  const [expandedChanges, setExpandedChanges] = useState(true);
  const [fullCritiqueExpanded, setFullCritiqueExpanded] = useState<
    Record<string, boolean>
  >({});
  const conversationRef = useRef<HTMLDivElement | null>(null);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const stickToBottomRef = useRef(true);
  const prevStatusRef = useRef(status);
  const sending = status === "sending" || Boolean(applyingRecommendationId);
  const recommendations = advisorReport?.recommendations ?? [];
  const creativeRecs =
    completeWebsitePlan?.recommendations ??
    creativeDirectorReport?.recommendedImprovements ??
    [];
  const hasReview = Boolean(advisorReport || creativeDirectorReport);
  const opportunityCount =
    creativeRecs.length > 0 ? creativeRecs.length : recommendations.length;

  const reviewScope = projectId ?? "local";
  const [preferenceScope, setPreferenceScope] = useState(reviewScope);
  const [reviewPreference, setReviewPreference] = useState<boolean | null>(() =>
    readReviewExpanded(projectId),
  );

  if (preferenceScope !== reviewScope) {
    setPreferenceScope(reviewScope);
    setReviewPreference(readReviewExpanded(projectId));
  }

  const reviewOpen = reviewPreference ?? messages.length === 0;

  /** Latest critique plan drives the Action Area (not the conversation scroller). */
  const activePlan = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      const message = messages[i];
      if (!message || message.role !== "assistant") continue;
      const body = parseCritiqueAssistantContent(message.content).body;
      const parsed = parseCritiqueMessage(body);
      if (parsed.kind === "critique" && parsed.applyAllReady) {
        return parsed;
      }
    }
    return null;
  }, [messages]);

  const focusComposer = useCallback((restoreSelection = true) => {
    const el = composerRef.current;
    if (!el || el.disabled) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    el.focus({ preventScroll: true });
    if (restoreSelection && typeof start === "number" && typeof end === "number") {
      try {
        el.setSelectionRange(start, end);
      } catch {
        // ignore
      }
    }
  }, []);

  const isNearBottom = useCallback(() => {
    const node = conversationRef.current;
    if (!node) return true;
    const distance = node.scrollHeight - node.scrollTop - node.clientHeight;
    return distance <= NEAR_BOTTOM_PX;
  }, []);

  const scrollConversationToBottom = useCallback(
    (behavior: ScrollBehavior = "smooth") => {
      const node = conversationRef.current;
      if (!node) return;
      const reduceMotion =
        typeof window !== "undefined" &&
        window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      const top = node.scrollHeight;
      if (typeof node.scrollTo === "function") {
        node.scrollTo({
          top,
          behavior: reduceMotion ? "auto" : behavior,
        });
      } else {
        node.scrollTop = top;
      }
    },
    [],
  );

  function handleConversationScroll() {
    stickToBottomRef.current = isNearBottom();
  }

  useLayoutEffect(() => {
    if (!stickToBottomRef.current) return;
    scrollConversationToBottom(status === "sending" ? "auto" : "smooth");
  }, [messages, status, lastChanges, scrollConversationToBottom]);

  useEffect(() => {
    const prev = prevStatusRef.current;
    prevStatusRef.current = status;
    if (prev === "sending" && status !== "sending") {
      focusComposer();
    }
    if (
      prev !== status &&
      (status === "applied" ||
        status === "no_changes" ||
        status === "failed" ||
        status === "needs_clarification" ||
        status === "idle")
    ) {
      const t = window.setTimeout(() => focusComposer(), 0);
      return () => window.clearTimeout(t);
    }
    return undefined;
  }, [status, applyingRecommendationId, focusComposer]);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const value = draft.trim();
    if (!value || sending) return;
    stickToBottomRef.current = true;
    setDraft("");
    onSend(value);
  }

  function handleUndo() {
    onUndo();
    window.setTimeout(() => focusComposer(), 0);
  }

  function handleRedo() {
    onRedo();
    window.setTimeout(() => focusComposer(), 0);
  }

  function handleRetry() {
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    if (!lastUser || sending) return;
    stickToBottomRef.current = true;
    onSend(lastUser.content);
    window.setTimeout(() => focusComposer(), 0);
  }

  function handleApplyAll() {
    stickToBottomRef.current = true;
    if (onApplyAllCreative) onApplyAllCreative();
    else if (onFollowUpSuggestion) onFollowUpSuggestion("Apply All");
    else onSend("Apply All");
  }

  function handleApplyImprovement(index: number) {
    stickToBottomRef.current = true;
    onSend(applyImprovementRequest(index));
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
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4">
        <div>
          <p className="font-[family-name:var(--font-atlas-display)] text-sm font-semibold text-foreground">
            Atlas AI
          </p>
          <p className="text-xs text-muted">Your design partner</p>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleUndo}
            disabled={!canUndo || sending}
            className="rounded-md px-2 py-1 text-xs text-muted transition-colors hover:bg-white/5 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 disabled:opacity-40"
            title="Undo last AI change"
          >
            Undo
          </button>
          <button
            type="button"
            onClick={handleRedo}
            disabled={!canRedo || sending}
            className="rounded-md px-2 py-1 text-xs text-muted transition-colors hover:bg-white/5 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 disabled:opacity-40"
            title="Redo AI change"
          >
            Redo
          </button>
        </div>
      </header>

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
          {status === "failed" ? (
            <button
              type="button"
              onClick={handleRetry}
              disabled={sending}
              className="mt-1.5 rounded-md border border-border/70 px-2 py-1 text-[11px] font-medium text-foreground hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 disabled:opacity-40"
              data-testid="atlas-retry"
            >
              Retry
            </button>
          ) : null}
        </div>
      ) : null}

      {/*
        Permanent three-region shell.
        grid-rows: conversation takes ALL remaining space; action + composer are content-sized.
        Conversation height can never push the composer out of the viewport.
      */}
      <div
        className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)_auto_auto]"
        data-testid="atlas-panel-body"
      >
        {/* Region 1 — Scrollable Conversation */}
        <section
          ref={conversationRef}
          onScroll={handleConversationScroll}
          className="min-h-0 overflow-y-auto overscroll-contain px-4 py-4"
          data-testid="atlas-conversation-region"
          aria-label="Conversation"
          role="log"
          aria-live="polite"
          aria-relevant="additions"
        >
          <div className="space-y-3">
            {messages.length === 0 && !hasReview ? (
              <div className="rounded-xl border border-border/70 bg-background/40 p-3 text-xs leading-relaxed text-muted">
                Ask Atlas to redesign this site — recommendations and Apply All
                stay in the action area below.
              </div>
            ) : null}

            {messages.length === 0 && hasReview ? (
              <div className="rounded-xl border border-border/70 bg-background/40 p-3 text-xs leading-relaxed text-muted">
                Ask Atlas to redesign this site, or use the action area below
                for one-click improvements.
              </div>
            ) : null}

            {messages.map((message) => (
              <div
                key={message.id}
                className={`rounded-xl px-3 py-2 text-sm [content-visibility:auto] [contain-intrinsic-size:auto_120px] ${
                  message.role === "user"
                    ? "ml-4 bg-[color:var(--site-accent,theme(colors.accent))]/15 text-foreground"
                    : "mr-2 border border-border/70 bg-background/50 text-foreground"
                }`}
                data-testid={`atlas-message-${message.id}`}
              >
                <p className="text-[10px] uppercase tracking-wide text-muted">
                  {message.role === "user" ? "You" : "Atlas"}
                </p>
                {message.role === "assistant" ? (
                  <AtlasCritiqueMessage
                    content={message.content}
                    messageId={message.id}
                    expanded={fullCritiqueExpanded[message.id] ?? false}
                    onExpandedChange={(next) =>
                      setFullCritiqueExpanded((prev) => ({
                        ...prev,
                        [message.id]: next,
                      }))
                    }
                  />
                ) : (
                  <p className="mt-1 max-w-[40rem] whitespace-pre-wrap leading-relaxed">
                    {message.content}
                  </p>
                )}
                {message.role === "assistant" &&
                message.changes &&
                message.changes.length > 0 ? (
                  <ul className="mt-2 space-y-1 border-t border-border/50 pt-2 text-xs text-muted">
                    {message.changes.map((change) => (
                      <li key={change.id} className="flex gap-2">
                        <span className="text-accent" aria-hidden>
                          ✓
                        </span>
                        <span>{change.label}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ))}

            {status === "sending" ? (
              <div
                className="mr-2 rounded-xl border border-border/70 bg-background/50 px-3 py-2 text-sm text-muted"
                data-testid="atlas-streaming-indicator"
                aria-live="polite"
              >
                <span className="inline-flex items-center gap-2">
                  <span className="size-1.5 animate-pulse rounded-full bg-accent motion-reduce:animate-none" />
                  Sending…
                </span>
              </div>
            ) : null}

            {status === "applied" && lastChanges && lastChanges.length > 0 ? (
              <div className="rounded-xl border border-border/70 bg-background/40 p-3">
                <button
                  type="button"
                  className="flex w-full items-center justify-between text-left text-xs font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
                  onClick={() => setExpandedChanges((v) => !v)}
                >
                  <span>
                    {lastChanges.length} change
                    {lastChanges.length === 1 ? "" : "s"} made
                  </span>
                  <span className="text-muted">
                    {expandedChanges ? "Hide" : "Expand"}
                  </span>
                </button>
                {expandedChanges ? (
                  <ul className="mt-2 space-y-1.5 text-xs text-muted">
                    {lastChanges.map((change) => (
                      <li key={change.id} className="flex gap-2">
                        <span className="text-accent" aria-hidden>
                          ✓
                        </span>
                        <span>{change.label}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}
          </div>
        </section>

        {/* Region 2 — Action Area (independent of conversation height) */}
        <AtlasActionArea
          sending={sending}
          reviewOpen={reviewOpen}
          onToggleReview={toggleReview}
          advisorReport={advisorReport}
          creativeDirectorReport={creativeDirectorReport}
          completeWebsitePlan={completeWebsitePlan}
          creativeRecs={creativeRecs}
          recommendations={recommendations}
          opportunityCount={opportunityCount}
          applyingRecommendationId={applyingRecommendationId}
          recommendationStates={recommendationStates}
          planImprovements={activePlan?.improvements ?? []}
          planReady={Boolean(activePlan?.applyAllReady || completeWebsitePlan)}
          onApplyAll={handleApplyAll}
          onApplyImprovement={handleApplyImprovement}
          onApplyRecommendation={onApplyRecommendation}
          onApplyCreativeRecommendation={onApplyCreativeRecommendation}
          onCompleteWebsite={onCompleteWebsite}
          onDismissCompletePlan={onDismissCompletePlan}
          followUpSuggestions={followUpSuggestions}
          onFollowUpSuggestion={onFollowUpSuggestion}
          onAfterAction={() => {
            window.setTimeout(() => focusComposer(), 0);
          }}
        />

        {/* Region 3 — Sticky Composer (always visible; content-sized row) */}
        <form
          onSubmit={handleSubmit}
          className="border-t border-border bg-surface/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
          data-testid="atlas-prompt-region"
          aria-label="Prompt composer"
        >
          <label htmlFor="atlas-ai-prompt" className="sr-only">
            Design request
          </label>
          <textarea
            ref={composerRef}
            id="atlas-ai-prompt"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            rows={3}
            placeholder={`Ask about ${project.businessName || "this website"}…`}
            disabled={sending}
            className="w-full resize-none rounded-xl border border-border bg-background/60 px-3 py-2 text-sm text-foreground outline-none ring-accent/40 placeholder:text-muted focus:ring-2 focus-visible:ring-2 focus-visible:ring-accent/50 disabled:opacity-60"
            data-testid="atlas-prompt-input"
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
      </div>
    </aside>
  );
}
