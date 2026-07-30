"use client";

import type {
  BusinessAdvisorReport,
  BusinessRecommendation,
} from "@/lib/ai/business-advisor-types";
import type {
  CompleteWebsitePlan,
  CreativeDirectorRecommendation,
  CreativeDirectorReport,
} from "@/lib/ai/creative-director-types";
import {
  CRITIQUE_CATEGORY_LABELS,
  CRITIQUE_SCORE_CATEGORIES,
  type CritiqueScoreCategory,
} from "@/lib/ai/critique-scoring";
import type { CritiqueImprovementCard } from "@/lib/ai/critique-message-presentation";

type RecommendationApplyState = {
  status: "idle" | "applying" | "applied" | "failed" | "no_visible_change";
  message?: string | null;
  requestId?: string | null;
};

type AtlasActionAreaProps = {
  sending: boolean;
  reviewOpen: boolean;
  onToggleReview: () => void;
  advisorReport?: BusinessAdvisorReport | null;
  creativeDirectorReport?: CreativeDirectorReport | null;
  completeWebsitePlan?: CompleteWebsitePlan | null;
  creativeRecs: CreativeDirectorRecommendation[];
  recommendations: BusinessRecommendation[];
  opportunityCount: number;
  applyingRecommendationId?: string | null;
  recommendationStates?: Record<string, RecommendationApplyState>;
  /** Parsed improvements from the latest critique (active plan). */
  planImprovements?: CritiqueImprovementCard[];
  planReady?: boolean;
  onApplyAll?: () => void;
  onApplyImprovement?: (index: number) => void;
  onApplyRecommendation?: (recommendation: BusinessRecommendation) => void;
  onApplyCreativeRecommendation?: (
    recommendation: CreativeDirectorRecommendation,
  ) => void;
  onCompleteWebsite?: () => void;
  onDismissCompletePlan?: () => void;
  followUpSuggestions?: string[];
  onFollowUpSuggestion?: (suggestion: string) => void;
  onAfterAction?: () => void;
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

/**
 * Permanent Action Area — recommendations, Apply All, active plan.
 * Lives between conversation and composer; never inside the chat scroller.
 */
export default function AtlasActionArea({
  sending,
  reviewOpen,
  onToggleReview,
  advisorReport = null,
  creativeDirectorReport = null,
  completeWebsitePlan = null,
  creativeRecs,
  recommendations,
  opportunityCount,
  applyingRecommendationId = null,
  recommendationStates = {},
  planImprovements = [],
  planReady = false,
  onApplyAll,
  onApplyImprovement,
  onApplyRecommendation,
  onApplyCreativeRecommendation,
  onCompleteWebsite,
  onDismissCompletePlan,
  followUpSuggestions = [],
  onFollowUpSuggestion,
  onAfterAction,
}: AtlasActionAreaProps) {
  const hasReview = Boolean(advisorReport || creativeDirectorReport);
  const hasPlan = planReady || planImprovements.length > 0;
  const hasFollowUps = followUpSuggestions.length > 0 && Boolean(onFollowUpSuggestion);
  const hasAnything =
    hasReview || hasPlan || hasFollowUps || Boolean(completeWebsitePlan);

  if (!hasAnything) {
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
      className="flex min-h-0 max-h-[min(36vh,20rem)] flex-col border-t border-border bg-surface/90"
      data-testid="atlas-action-region"
      aria-label="Atlas actions"
    >
      <div
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-2.5"
        data-testid="atlas-action-body"
      >
        {hasPlan || completeWebsitePlan ? (
          <div
            className="rounded-lg border border-accent/35 bg-accent/10 px-3 py-2.5"
            data-testid="atlas-critique-apply-all-card"
            role="region"
            aria-label="Apply improvements"
          >
            <p className="text-xs font-medium text-foreground">
              {planImprovements.length > 0
                ? `${planImprovements.length} improvement${planImprovements.length === 1 ? "" : "s"} ready`
                : completeWebsitePlan
                  ? "Launch-ready plan ready"
                  : "Improvements ready"}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {onApplyAll ? (
                <button
                  type="button"
                  disabled={sending}
                  onClick={() => {
                    onApplyAll();
                    onAfterAction?.();
                  }}
                  className="rounded-md border border-accent/50 bg-accent/20 px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 disabled:opacity-40"
                  data-testid="atlas-critique-apply-all"
                >
                  Apply All
                </button>
              ) : null}
              {hasReview ? (
                <button
                  type="button"
                  disabled={sending}
                  onClick={onToggleReview}
                  className="rounded-md border border-border px-3 py-1.5 text-xs text-muted transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 disabled:opacity-40"
                  data-testid="atlas-critique-review-individually"
                >
                  Review Individually
                </button>
              ) : null}
              {completeWebsitePlan && onDismissCompletePlan ? (
                <button
                  type="button"
                  disabled={sending}
                  onClick={onDismissCompletePlan}
                  className="rounded-md border border-border px-3 py-1.5 text-xs text-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 disabled:opacity-40"
                >
                  Back to review
                </button>
              ) : null}
            </div>
          </div>
        ) : null}

        {planImprovements.length > 0 ? (
          <div className="mt-2.5" data-testid="atlas-plan-improvements">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
              Top Improvements
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {planImprovements.map((card) => (
                <article
                  key={`${card.index}-${card.title}`}
                  className="flex min-w-[10.5rem] max-w-full flex-1 flex-col rounded-lg border border-border/60 bg-background/60 p-2.5"
                  data-testid={`critique-improvement-card-${card.index}`}
                >
                  <h4 className="text-sm font-medium leading-snug text-foreground">
                    {card.title}
                  </h4>
                  <p className="mt-1.5 text-xs leading-relaxed text-muted">
                    <span className="font-medium text-foreground/80">Why · </span>
                    {card.why}
                  </p>
                  <p className="mt-1 text-[11px] text-muted">
                    <span className="text-foreground/80">Impact · </span>
                    {card.impact}
                    <span className="mx-1.5 text-border">·</span>
                    <span className="text-foreground/80">Time · </span>
                    {card.timeEstimate}
                  </p>
                  {onApplyImprovement ? (
                    <button
                      type="button"
                      disabled={sending}
                      onClick={() => {
                        onApplyImprovement(card.index - 1);
                        onAfterAction?.();
                      }}
                      className="mt-2 self-start rounded-md border border-accent/40 bg-accent/10 px-2.5 py-1 text-[11px] font-medium text-foreground transition-colors hover:bg-accent/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 disabled:opacity-40"
                    >
                      Apply
                    </button>
                  ) : null}
                </article>
              ))}
            </div>
          </div>
        ) : null}

        {hasFollowUps ? (
          <div
            className="mt-2.5 flex flex-wrap gap-1.5"
            data-testid="atlas-follow-up-suggestions"
          >
            <p className="w-full text-[11px] text-muted">Would you like me to…</p>
            {followUpSuggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                disabled={sending}
                onClick={() => {
                  onFollowUpSuggestion?.(suggestion);
                  onAfterAction?.();
                }}
                className="rounded-full border border-border/70 bg-background/50 px-2.5 py-1 text-[11px] text-foreground transition-colors hover:border-accent/40 hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 disabled:opacity-40"
              >
                {suggestion}
              </button>
            ))}
          </div>
        ) : null}

        {hasReview ? (
          <div className="mt-2.5" data-testid="atlas-review-region">
            <button
              type="button"
              className="flex w-full items-center justify-between py-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
              onClick={onToggleReview}
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
              <div className="mt-2 border-t border-border/60 pt-2" data-testid="atlas-review-body">
                {creativeDirectorReport ? (
                  <div data-testid="creative-director-review">
                    <p className="whitespace-pre-line text-[11px] leading-relaxed text-muted">
                      {completeWebsitePlan?.narrative ??
                        creativeDirectorReport.narrative}
                    </p>
                    <div className="mt-3 flex items-end justify-between gap-3 rounded-lg border border-border/60 bg-background/50 px-3 py-2">
                      <div>
                        <p className="text-[10px] uppercase tracking-wide text-muted">
                          Overall
                        </p>
                        <p
                          className={`mt-0.5 font-[family-name:var(--font-atlas-display)] text-2xl font-semibold tabular-nums ${scoreTone(creativeDirectorReport.overallCompleteness)}`}
                        >
                          {creativeDirectorReport.overallCompleteness}
                          <span className="ml-1 text-sm font-normal text-muted">
                            %
                          </span>
                        </p>
                      </div>
                      <p
                        className="pb-1 text-sm font-medium text-foreground"
                        data-testid="creative-maturity-level"
                      >
                        {completeWebsitePlan?.maturityLevel ??
                          creativeDirectorReport.maturityLevel}
                      </p>
                    </div>

                    {creativeDirectorReport.offerCompleteWebsite &&
                    !completeWebsitePlan &&
                    onCompleteWebsite ? (
                      <button
                        type="button"
                        disabled={sending}
                        onClick={() => {
                          onCompleteWebsite();
                          onAfterAction?.();
                        }}
                        className="mt-3 w-full rounded-lg border border-accent/50 bg-accent/15 px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-accent/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 disabled:opacity-40"
                        data-testid="complete-my-website"
                      >
                        Complete My Website
                      </button>
                    ) : null}

                    {completeWebsitePlan && onApplyAll ? (
                      <button
                        type="button"
                        disabled={sending}
                        onClick={() => {
                          onApplyAll();
                          onAfterAction?.();
                        }}
                        className="mt-3 rounded-lg border border-accent/50 bg-accent/15 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 disabled:opacity-40"
                        data-testid="apply-all-creative"
                      >
                        Apply All
                      </button>
                    ) : null}

                    {creativeRecs.length > 0 ? (
                      <ul className="mt-3 space-y-2.5">
                        {creativeRecs.map((rec) => {
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
                              data-testid={`creative-rec-${rec.id}`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <p className="text-sm font-medium leading-snug text-foreground">
                                  {rec.title}
                                </p>
                                <span className="shrink-0 rounded-md border border-border/60 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted">
                                  {rec.kind}
                                </span>
                              </div>
                              <p className="mt-1.5 text-xs leading-relaxed text-muted">
                                {rec.explanation}
                              </p>
                              {label ? (
                                <p className="mt-1.5 text-[11px] font-medium text-muted">
                                  {label}
                                </p>
                              ) : null}
                              {onApplyCreativeRecommendation ? (
                                <button
                                  type="button"
                                  disabled={
                                    sending ||
                                    (!rec.applyable && Boolean(rec.blockedReason))
                                  }
                                  onClick={() => {
                                    onApplyCreativeRecommendation(rec);
                                    onAfterAction?.();
                                  }}
                                  className="mt-2 rounded-lg border border-accent/40 bg-accent/10 px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 disabled:opacity-40"
                                  title={rec.blockedReason}
                                >
                                  {applying
                                    ? "Applying…"
                                    : rec.applyable
                                      ? "Apply"
                                      : "Needs upload"}
                                </button>
                              ) : null}
                            </li>
                          );
                        })}
                      </ul>
                    ) : null}
                  </div>
                ) : (
                  <p className="text-[11px] leading-relaxed text-muted">
                    {advisorReport?.summary}
                  </p>
                )}

                {advisorReport ? (
                  <>
                    <div className="mt-3 flex items-end justify-between gap-3 rounded-lg border border-border/60 bg-background/50 px-3 py-2">
                      <div>
                        <p className="text-[10px] uppercase tracking-wide text-muted">
                          Critique score
                        </p>
                        <p
                          className={`mt-0.5 font-[family-name:var(--font-atlas-display)] text-2xl font-semibold tabular-nums ${scoreTone(advisorReport.overallScore)}`}
                        >
                          {advisorReport.overallScore}
                          <span className="ml-1 text-sm font-normal text-muted">
                            /100
                          </span>
                        </p>
                      </div>
                    </div>
                    <ul className="mt-2 grid grid-cols-2 gap-1.5">
                      {CRITIQUE_SCORE_CATEGORIES.map(
                        (key: CritiqueScoreCategory) => {
                          const value = advisorReport.categoryScores[key];
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
                        },
                      )}
                    </ul>
                  </>
                ) : null}

                {!creativeDirectorReport && recommendations.length > 0 ? (
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
                          </dl>
                          {onApplyRecommendation ? (
                            <button
                              type="button"
                              disabled={sending}
                              onClick={() => {
                                onApplyRecommendation(rec);
                                onAfterAction?.();
                              }}
                              className="mt-2.5 rounded-lg border border-accent/40 bg-accent/10 px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 disabled:opacity-40"
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
      </div>
    </section>
  );
}
