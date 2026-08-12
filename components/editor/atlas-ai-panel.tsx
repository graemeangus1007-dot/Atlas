"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type DragEvent,
} from "react";
import AtlasActivePlanBar from "@/components/editor/atlas-active-plan-bar";
import AtlasAiHeader from "@/components/editor/atlas-ai-header";
import AtlasChangesView from "@/components/editor/atlas-changes-view";
import { summarizeWebsiteChanges } from "@/components/editor/atlas-change-summary";
import AtlasComposer from "@/components/editor/atlas-composer";
import AtlasConversation from "@/components/editor/atlas-conversation";
import {
  applyImprovementRequest,
} from "@/components/editor/atlas-critique-message";
import AtlasPlanView from "@/components/editor/atlas-plan-view";
import AtlasReviewView from "@/components/editor/atlas-review-view";
import type {
  ActivePlanSnapshot,
  AtlasAiPanelProps,
  AtlasPanelView,
} from "@/components/editor/atlas-ai-panel-types";
import { useComposerAttachments } from "@/hooks/use-composer-attachments";
import { ATLAS_VOICE } from "@/lib/ai/atlas-designer-voice";
import { parseCritiqueAssistantContent } from "@/lib/ai/critique-fallback-presentation";
import { parseCritiqueMessage } from "@/lib/ai/critique-message-presentation";
import {
  assessApplyAllPlanState,
  assertApplyAllHasExecutablePlan,
} from "@/lib/ai/apply-all-continuity";
import { getActionMemory } from "@/lib/ai/atlas-action-memory";

export type {
  AtlasAiUiStatus,
  RecommendationApplyUiStatus,
  RecommendationApplyState,
} from "@/components/editor/atlas-ai-panel-types";

const NEAR_BOTTOM_PX = 96;

function resolveActivePlan(
  messages: AtlasAiPanelProps["messages"],
  executablePlan: boolean,
): ActivePlanSnapshot | null {
  // v1.6.7 — never surface Apply All from message history alone.
  if (!executablePlan) return null;
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (!message || message.role !== "assistant") continue;
    const body = parseCritiqueAssistantContent(message.content).body;
    const parsed = parseCritiqueMessage(body);
    if (parsed.kind === "critique" && parsed.applyAllReady) {
      return {
        improvements: parsed.improvements,
        applyAllReady: true,
        designDirection: parsed.designDirection,
        executiveSummary: parsed.executiveSummary,
      };
    }
  }
  return null;
}

/**
 * Atlas AI panel — progressive disclosure workspace (Sprint 28.4).
 * Permanent regions: header · conversation · optional plan bar · composer.
 * Secondary views: plan · review · changes.
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
  onMediaAssetsAdded,
  onUndo,
  onRedo,
  onApplyRecommendation,
  onApplyCreativeRecommendation,
  onCompleteWebsite,
  onApplyAllCreative,
  onDismissCompletePlan,
  followUpSuggestions = [],
  onFollowUpSuggestion,
  onClearConversation,
  onNewConversation,
}: AtlasAiPanelProps) {
  const [draft, setDraft] = useState("");
  const [view, setView] = useState<AtlasPanelView>("conversation");
  const [dismissedFollowUpKey, setDismissedFollowUpKey] = useState<
    string | null
  >(null);
  const [panelDragOver, setPanelDragOver] = useState(false);

  const composerAttachments = useComposerAttachments({
    projectId,
    onAssetUploaded: (asset) => onMediaAssetsAdded?.([asset]),
  });

  const conversationRef = useRef<HTMLDivElement | null>(null);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const stickToBottomRef = useRef(true);
  const savedScrollTopRef = useRef(0);
  const restoringScrollRef = useRef(false);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const prevStatusRef = useRef(status);
  const prevViewRef = useRef<AtlasPanelView>("conversation");

  const sending = status === "sending" || Boolean(applyingRecommendationId);

  const recommendations = advisorReport?.recommendations ?? [];
  const creativeRecs =
    completeWebsitePlan?.recommendations ??
    creativeDirectorReport?.recommendedImprovements ??
    [];

  const websiteScore =
    creativeDirectorReport?.overallCompleteness ??
    advisorReport?.overallScore ??
    null;

  const hasReview = Boolean(advisorReport || creativeDirectorReport);
  const hasNewReview = hasReview && creativeRecs.length + recommendations.length > 0;

  const memory = getActionMemory(project);
  const planState = assessApplyAllPlanState({ project });
  const executablePlan = planState.canApply;
  assertApplyAllHasExecutablePlan(memory, executablePlan);
  const activePlan = resolveActivePlan(messages, executablePlan);

  const planImprovementCount =
    activePlan?.improvements.length ??
    (executablePlan
      ? (memory?.activePlan?.recommendations?.length ?? 0)
      : 0);

  const lastChangesSummary = summarizeWebsiteChanges(lastChanges);
  const appliedBannerCount =
    status === "applied" && lastChangesSummary.count > 0
      ? lastChangesSummary.count
      : null;

  const showPlanBar =
    view === "conversation" &&
    executablePlan &&
    (planImprovementCount > 0 ||
      Boolean(completeWebsitePlan) ||
      Boolean(applyingRecommendationId));

  const followUpKey = followUpSuggestions.join("|");
  const showFollowUps =
    view === "conversation" &&
    dismissedFollowUpKey !== followUpKey &&
    followUpSuggestions.length > 0 &&
    status !== "sending" &&
    !activePlan?.applyAllReady;

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

  const openSecondaryView = useCallback((next: AtlasPanelView) => {
    if (view === "conversation" && conversationRef.current) {
      savedScrollTopRef.current = conversationRef.current.scrollTop;
    }
    returnFocusRef.current = document.activeElement as HTMLElement | null;
    setView(next);
  }, [view]);

  const backToConversation = useCallback(() => {
    restoringScrollRef.current = true;
    setView("conversation");
  }, []);

  useLayoutEffect(() => {
    if (view !== "conversation") {
      prevViewRef.current = view;
      return;
    }

    if (restoringScrollRef.current) {
      const node = conversationRef.current;
      if (node) {
        node.scrollTop = savedScrollTopRef.current;
        const distance =
          node.scrollHeight - node.scrollTop - node.clientHeight;
        stickToBottomRef.current = distance <= NEAR_BOTTOM_PX;
      }
      restoringScrollRef.current = false;
      const el = returnFocusRef.current;
      window.setTimeout(() => {
        if (el && typeof el.focus === "function") {
          try {
            el.focus({ preventScroll: true });
          } catch {
            focusComposer();
          }
        } else {
          focusComposer();
        }
      }, 0);
      prevViewRef.current = view;
      return;
    }

    if (stickToBottomRef.current) {
      scrollConversationToBottom(status === "sending" ? "auto" : "smooth");
    }
    prevViewRef.current = view;
  }, [
    messages,
    status,
    lastChanges,
    scrollConversationToBottom,
    view,
    focusComposer,
  ]);

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

  function handleSubmit(value: string) {
    if (
      composerAttachments.attachments.length > 0 &&
      (!composerAttachments.ready || composerAttachments.uploading)
    ) {
      return;
    }
    stickToBottomRef.current = true;
    const persisted = composerAttachments.persistedForMessage();
    setDraft("");
    composerAttachments.clearAttachments();
    onSend(value, persisted.length ? persisted : undefined);
  }

  function handlePanelDragOver(event: DragEvent) {
    if (![...event.dataTransfer.types].includes("Files")) return;
    event.preventDefault();
    setPanelDragOver(true);
  }

  function handlePanelDragLeave(event: DragEvent) {
    event.preventDefault();
    setPanelDragOver(false);
  }

  function handlePanelDrop(event: DragEvent) {
    event.preventDefault();
    setPanelDragOver(false);
    const files = Array.from(event.dataTransfer.files ?? []);
    if (files.length) composerAttachments.ingestDroppedOrPastedFiles(files);
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

  const conversationVisible = view === "conversation";

  return (
    <aside
      className="relative flex h-full min-h-0 w-full flex-col border-l border-border bg-surface/95 backdrop-blur-xl"
      aria-label="Atlas"
      aria-busy={sending || undefined}
      data-testid="atlas-ai-panel"
      data-view={view}
      onDragOver={handlePanelDragOver}
      onDragLeave={handlePanelDragLeave}
      onDrop={handlePanelDrop}
    >
      {panelDragOver ? (
        <div
          className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center bg-accent/10 text-sm font-medium text-foreground backdrop-blur-[1px]"
          data-testid="atlas-panel-drop-overlay"
          aria-hidden
        >
          Drop photos to attach
        </div>
      ) : null}
      <AtlasAiHeader
        status={status}
        applying={Boolean(applyingRecommendationId)}
        websiteScore={websiteScore}
        hasNewReview={hasNewReview && view !== "review"}
        canUndo={canUndo}
        canRedo={canRedo}
        sending={sending}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onOpenReview={() => openSecondaryView("review")}
        onOpenPlan={
          planImprovementCount > 0
            ? () => openSecondaryView("plan")
            : undefined
        }
        onNewConversation={onNewConversation}
        onClearConversation={onClearConversation}
      />

      {status === "failed" ? (
        <div
          className="shrink-0 border-b border-red-500/30 bg-red-500/10 px-4 py-2 text-xs text-red-200"
          role="alert"
          data-testid="atlas-error-banner"
        >
          <p className="font-medium">{ATLAS_VOICE.somethingWrongTitle}</p>
          {statusMessage ? (
            <p className="mt-0.5 font-normal opacity-90">{statusMessage}</p>
          ) : null}
          <button
            type="button"
            onClick={handleRetry}
            disabled={sending}
            className="mt-1.5 rounded-md border border-border/70 px-2 py-1 text-[11px] font-medium text-foreground hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 disabled:opacity-40"
            data-testid="atlas-retry"
          >
            {ATLAS_VOICE.retry}
          </button>
        </div>
      ) : null}

      <div
        className={
          conversationVisible
            ? "grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)_auto_auto]"
            : "flex min-h-0 flex-1 flex-col"
        }
        data-testid="atlas-panel-body"
      >
        {view === "plan" ? (
          <AtlasPlanView
            designDirection={activePlan?.designDirection ?? null}
            improvements={activePlan?.improvements ?? []}
            sending={sending}
            onBack={backToConversation}
            onApplyAll={handleApplyAll}
            onApplyImprovement={handleApplyImprovement}
          />
        ) : null}

        {view === "review" ? (
          <AtlasReviewView
            advisorReport={advisorReport}
            creativeDirectorReport={creativeDirectorReport}
            completeWebsitePlan={completeWebsitePlan}
            creativeRecs={creativeRecs}
            recommendations={recommendations}
            applyingRecommendationId={applyingRecommendationId}
            recommendationStates={recommendationStates}
            sending={sending}
            onBack={backToConversation}
            onApplyAll={handleApplyAll}
            onCompleteWebsite={onCompleteWebsite}
            onApplyCreativeRecommendation={onApplyCreativeRecommendation}
            onApplyRecommendation={onApplyRecommendation}
          />
        ) : null}

        {view === "changes" ? (
          <AtlasChangesView
            summary={lastChangesSummary}
            onBack={backToConversation}
          />
        ) : null}

        {conversationVisible ? (
          <>
            <AtlasConversation
              ref={conversationRef}
              messages={messages}
              status={status}
              lastChangesSummary={lastChangesSummary}
              onScroll={handleConversationScroll}
              onReviewPlan={() => openSecondaryView("plan")}
              onApplyAll={executablePlan ? handleApplyAll : undefined}
              canApplyAll={executablePlan}
              onViewChanges={() => openSecondaryView("changes")}
              resolveAttachmentPreviewUrl={(assetId) =>
                project.mediaLibrary?.find((asset) => asset.id === assetId)
                  ?.url
              }
            />

            {showPlanBar ? (
              <AtlasActivePlanBar
                improvementCount={planImprovementCount}
                sending={sending}
                applying={Boolean(applyingRecommendationId)}
                appliedCount={
                  status === "applied" ? appliedBannerCount : null
                }
                onReview={() => openSecondaryView("plan")}
                onApplyAll={handleApplyAll}
                onViewChanges={() => openSecondaryView("changes")}
                onCancel={
                  completeWebsitePlan && onDismissCompletePlan
                    ? onDismissCompletePlan
                    : undefined
                }
              />
            ) : (
              <section
                className="min-h-0 border-t border-transparent"
                data-testid="atlas-action-region"
                data-empty="true"
                aria-label="Atlas actions"
              />
            )}

            <AtlasComposer
              ref={composerRef}
              draft={draft}
              onDraftChange={setDraft}
              onSubmit={handleSubmit}
              sending={sending}
              placeholder={ATLAS_VOICE.composerPlaceholder}
              followUpSuggestions={followUpSuggestions}
              onFollowUpSuggestion={onFollowUpSuggestion}
              onDismissFollowUps={() => setDismissedFollowUpKey(followUpKey)}
              showFollowUps={showFollowUps}
              attachments={composerAttachments.attachments}
              attachmentError={composerAttachments.error}
              onUploadPhotos={(files) => {
                void composerAttachments.enqueueFiles(files, "image");
              }}
              onUploadLogo={(files) => {
                void composerAttachments.enqueueFiles(files, "logo");
              }}
              onAttachExisting={(assets) => {
                composerAttachments.attachExistingAssets(assets, "image");
              }}
              onRemoveAttachment={composerAttachments.removeAttachment}
              onRetryAttachment={composerAttachments.retryAttachment}
              onMoveAttachment={composerAttachments.moveAttachment}
              onIngestFiles={composerAttachments.ingestDroppedOrPastedFiles}
              projectMedia={project.mediaLibrary ?? []}
              attachmentsReady={composerAttachments.ready}
              attachmentsUploading={composerAttachments.uploading}
            />
          </>
        ) : null}
      </div>

      {/* Keep project name available for a11y context */}
      <span className="sr-only">{project.businessName}</span>
      <span className="sr-only">{projectId}</span>
    </aside>
  );
}
