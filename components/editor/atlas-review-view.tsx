"use client";

import { useEffect, useRef } from "react";
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
import type { RecommendationApplyState } from "@/components/editor/atlas-ai-panel-types";
import { ATLAS_VOICE } from "@/lib/ai/atlas-designer-voice";

type AtlasReviewViewProps = {
  advisorReport?: BusinessAdvisorReport | null;
  creativeDirectorReport?: CreativeDirectorReport | null;
  completeWebsitePlan?: CompleteWebsitePlan | null;
  creativeRecs: CreativeDirectorRecommendation[];
  recommendations: BusinessRecommendation[];
  applyingRecommendationId?: string | null;
  recommendationStates?: Record<string, RecommendationApplyState>;
  sending: boolean;
  onBack: () => void;
  onApplyAll?: () => void;
  onCompleteWebsite?: () => void;
  onApplyCreativeRecommendation?: (
    recommendation: CreativeDirectorRecommendation,
  ) => void;
  onApplyRecommendation?: (recommendation: BusinessRecommendation) => void;
};

function scoreTone(score: number): string {
  if (score >= 80) return "text-emerald-600 dark:text-emerald-300";
  if (score >= 60) return "text-amber-700 dark:text-amber-200";
  return "text-red-600 dark:text-red-200";
}

function recStatusLabel(
  state: RecommendationApplyState | undefined,
): string | null {
  if (!state || state.status === "idle") return null;
  if (state.status === "applying") return ATLAS_VOICE.recApplying;
  if (state.status === "applied") return ATLAS_VOICE.recApplied;
  if (state.status === "failed") return ATLAS_VOICE.recFailed;
  if (state.status === "no_visible_change") return ATLAS_VOICE.noVisibleChange;
  return null;
}

export default function AtlasReviewView({
  advisorReport = null,
  creativeDirectorReport = null,
  completeWebsitePlan = null,
  creativeRecs,
  recommendations,
  applyingRecommendationId = null,
  recommendationStates = {},
  sending,
  onBack,
  onApplyAll,
  onCompleteWebsite,
  onApplyCreativeRecommendation,
  onApplyRecommendation,
}: AtlasReviewViewProps) {
  const backRef = useRef<HTMLButtonElement | null>(null);
  const overall =
    creativeDirectorReport?.overallCompleteness ??
    advisorReport?.overallScore ??
    null;

  useEffect(() => {
    backRef.current?.focus();
  }, []);

  return (
    <section
      className="flex min-h-0 flex-1 flex-col"
      data-testid="atlas-review-view"
      aria-label="Site suggestions"
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
      </div>

      <div
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4"
        data-testid="atlas-review-body"
      >
        <h2 className="font-[family-name:var(--font-atlas-display)] text-base font-semibold text-foreground">
          Site suggestions
        </h2>

        {overall != null ? (
          <div className="mt-3 flex items-end justify-between gap-3 rounded-lg border border-border/70 px-3 py-2">
            <div>
              <p className="text-[10px] uppercase tracking-wide text-muted">
                Overall
              </p>
              <p
                className={`mt-0.5 font-[family-name:var(--font-atlas-display)] text-2xl font-semibold tabular-nums ${scoreTone(overall)}`}
              >
                {overall}
                <span className="ml-1 text-sm font-normal text-muted">
                  {creativeDirectorReport ? "%" : "/100"}
                </span>
              </p>
            </div>
            {creativeDirectorReport ? (
              <p
                className="pb-1 text-sm font-medium text-foreground"
                data-testid="creative-maturity-level"
              >
                {completeWebsitePlan?.maturityLevel ??
                  creativeDirectorReport.maturityLevel}
              </p>
            ) : null}
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted">
            Ask Atlas to review your website to see scores and opportunities.
          </p>
        )}

        {advisorReport ? (
          <ul className="mt-3 grid grid-cols-2 gap-1.5">
            {CRITIQUE_SCORE_CATEGORIES.map((key: CritiqueScoreCategory) => {
              const value = advisorReport.categoryScores[key];
              return (
                <li
                  key={key}
                  className="rounded-md border border-border/50 px-2 py-1.5"
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
        ) : null}

        {creativeDirectorReport?.offerCompleteWebsite &&
        !completeWebsitePlan &&
        onCompleteWebsite ? (
          <button
            type="button"
            disabled={sending}
            onClick={onCompleteWebsite}
            className="mt-4 w-full rounded-lg border border-accent/50 bg-accent/15 px-3 py-2 text-xs font-medium text-foreground hover:bg-accent/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 disabled:opacity-40"
            data-testid="complete-my-website"
          >
            {ATLAS_VOICE.completeWebsite}
          </button>
        ) : null}

        {completeWebsitePlan && onApplyAll ? (
          <button
            type="button"
            disabled={sending}
            onClick={onApplyAll}
            className="mt-3 rounded-lg border border-accent/50 bg-accent/15 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 disabled:opacity-40"
            data-testid="apply-all-creative"
          >
            Apply All
          </button>
        ) : null}

        {creativeRecs.length > 0 ? (
          <ol className="mt-4 space-y-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
              Top opportunities
            </p>
            {creativeRecs.map((rec, index) => {
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
                  className="border-b border-border/50 pb-3"
                  data-testid={`creative-rec-${rec.id}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-foreground">
                      <span className="mr-2 tabular-nums text-muted">
                        {index + 1}
                      </span>
                      {rec.title}
                    </p>
                    <span className="shrink-0 text-[10px] uppercase text-muted">
                      {rec.kind}
                    </span>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-muted">
                    {rec.explanation}
                  </p>
                  {rec.blockedReason ? (
                    <p className="mt-1 text-[11px] text-amber-700 dark:text-amber-200">
                      {rec.applyable
                        ? "Supported"
                        : `Supported: ${rec.blockedReason}`}
                    </p>
                  ) : (
                    <p className="mt-1 text-[11px] text-muted">
                      {rec.applyable ? "Supported" : "Needs upload"}
                    </p>
                  )}
                  {label ? (
                    <p className="mt-1 text-[11px] font-medium text-muted">
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
                      onClick={() => onApplyCreativeRecommendation(rec)}
                      className="mt-2 rounded-md border border-accent/40 bg-accent/10 px-2.5 py-1 text-[11px] font-medium text-foreground hover:bg-accent/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 disabled:opacity-40"
                    >
                      {applying
                        ? ATLAS_VOICE.applyingLabel
                        : rec.applyable
                          ? ATLAS_VOICE.applyLabel
                          : "Add a photo"}
                    </button>
                  ) : null}
                </li>
              );
            })}
          </ol>
        ) : null}

        {!creativeDirectorReport && recommendations.length > 0 ? (
          <ol className="mt-4 space-y-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
              Top opportunities
            </p>
            {recommendations.map((rec, index) => {
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
                  className="border-b border-border/50 pb-3"
                  data-testid={`advisor-rec-${rec.id}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-foreground">
                      <span className="mr-2 tabular-nums text-muted">
                        {index + 1}
                      </span>
                      {rec.title}
                    </p>
                    <span className="shrink-0 text-[10px] uppercase text-muted">
                      {rec.impact}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted">{rec.noticed}</p>
                  {label ? (
                    <p
                      className="mt-1 text-[11px] font-medium text-muted"
                      data-testid={`advisor-rec-status-${rec.id}`}
                    >
                      {label}
                    </p>
                  ) : null}
                  {onApplyRecommendation ? (
                    <button
                      type="button"
                      disabled={sending}
                      onClick={() => onApplyRecommendation(rec)}
                      className="mt-2 rounded-md border border-accent/40 bg-accent/10 px-2.5 py-1 text-[11px] font-medium text-foreground hover:bg-accent/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 disabled:opacity-40"
                    >
                      {applying
                        ? ATLAS_VOICE.applyingLabel
                        : ATLAS_VOICE.applyLabel}
                    </button>
                  ) : null}
                </li>
              );
            })}
          </ol>
        ) : null}
      </div>
    </section>
  );
}
