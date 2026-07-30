"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import BrandStudioPanel from "@/components/design/brand-studio-panel";
import AiAssistantPanel from "@/components/editor/ai-assistant-panel";
import AtlasAiPanel, {
  type AtlasAiUiStatus,
  type RecommendationApplyState,
} from "@/components/editor/atlas-ai-panel";
import EditorCanvas from "@/components/editor/editor-canvas";
import EditorSidebar from "@/components/editor/editor-sidebar";
import EditorTopBar from "@/components/editor/editor-topbar";
import MediaLibrary from "@/components/media/media-library";
import EditorPublishPanel from "@/components/publishing/editor-publish-panel";
import PublishModal from "@/components/publishing/publish-modal";
import SeoPanel from "@/components/seo/seo-panel";
import { useProject } from "@/context/project-context";
import {
  EDITOR_PANEL_HINTS,
  type EditorSidebarId,
} from "@/data/editor";
import {
  appendConversationMessage,
  applyAdvisorRecommendation,
  applyAiFieldValue,
  applyCreativeRecommendation,
  buildDesignAssistantMeta,
  canRedoEditorRevision,
  canUndoEditorRevision,
  createAiHistoryEntry,
  createEmptyEditorConversation,
  createEmptyRevisionStack,
  logDesignAssistantDiagnostic,
  pushEditorRevision,
  redoEditorRevision,
  requestEditorAgentEdit,
  restoreDesignAssistantState,
  reviewBusinessProject,
  reviewCreativeDirector,
  shouldRefreshAdvisorReport,
  shouldRefreshCreativeDirector,
  toLocalStore,
  undoEditorRevision,
  writeDesignAssistantLocal,
  type BusinessAdvisorReport,
  type BusinessRecommendation,
  type CompleteWebsitePlan,
  type CreativeDirectorRecommendation,
  type CreativeDirectorReport,
  type EditChangeSummary,
  type EditorConversation,
  type EditorRevisionStack,
  type ImageEditorState,
} from "@/lib/ai";
import { buildSiteDesignStyle } from "@/lib/design-theme";
import { updateMediaAssetMeta } from "@/lib/media";
import { generateWebsiteContent } from "@/lib/website-generator";
import type { AiContentField, AiFieldTarget, AiHistoryEntry } from "@/types/ai";
import type { BusinessProject } from "@/types/business-project";

/**
 * Website editor shell — Brand Studio, Media, canvas, and Atlas AI.
 */
export default function WebsiteEditor() {
  const { project, projectId, updateProject, setProject, saveNow } = useProject();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activePanel, setActivePanel] = useState<EditorSidebarId>("content");
  const [publishOpen, setPublishOpen] = useState(false);
  const [publishIntent, setPublishIntent] = useState<"preview" | "production">(
    "preview",
  );
  const [aiOpen, setAiOpen] = useState(false);
  const [aiTarget, setAiTarget] = useState<AiFieldTarget | null>(null);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [previewValue, setPreviewValue] = useState<string | null>(null);
  const [aiHistory, setAiHistory] = useState<AiHistoryEntry | null>(null);

  const [conversation, setConversation] = useState<EditorConversation>(
    createEmptyEditorConversation,
  );
  const [revisionStack, setRevisionStack] = useState<EditorRevisionStack>(
    createEmptyRevisionStack,
  );
  const [lastChanges, setLastChanges] = useState<EditChangeSummary[] | null>(
    null,
  );
  const [uiStatus, setUiStatus] = useState<AtlasAiUiStatus>("idle");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [advisorReport, setAdvisorReport] =
    useState<BusinessAdvisorReport | null>(null);
  const [creativeDirectorReport, setCreativeDirectorReport] =
    useState<CreativeDirectorReport | null>(null);
  const [completeWebsitePlan, setCompleteWebsitePlan] =
    useState<CompleteWebsitePlan | null>(null);
  const [applyingRecommendationId, setApplyingRecommendationId] = useState<
    string | null
  >(null);
  const [recommendationStates, setRecommendationStates] = useState<
    Record<string, RecommendationApplyState>
  >({});
  const [imageEditorState, setImageEditorState] =
    useState<ImageEditorState | null>(null);
  const [followUpSuggestions, setFollowUpSuggestions] = useState<string[]>([]);
  const inFlightRef = useRef(false);
  const hydratedProjectIdRef = useRef<string | null>(null);
  const lastAdvisorFingerprintRef = useRef<string | null>(null);
  const lastCreativeFingerprintRef = useRef<string | null>(null);

  // Restore conversation + revisions when the active project changes / after refresh.
  useEffect(() => {
    const key = projectId ?? "local";
    if (hydratedProjectIdRef.current === key) return;
    hydratedProjectIdRef.current = key;

    const restored = restoreDesignAssistantState({
      projectId,
      projectMeta: project.designAssistant ?? null,
    });
    setConversation(restored.conversation);
    setRevisionStack(restored.revisionStack);
    setLastChanges(restored.lastChanges);
    setUiStatus("idle");
    setStatusMessage(null);
    setRecommendationStates({});
    lastAdvisorFingerprintRef.current = null;
    lastCreativeFingerprintRef.current = null;
    setCompleteWebsitePlan(null);
  }, [projectId, project.designAssistant]);

  // Continuous Business Advisor review — silently refresh when the site changes.
  useEffect(() => {
    const previous = lastAdvisorFingerprintRef.current
      ? ({
          fingerprint: lastAdvisorFingerprintRef.current,
          recommendations: [],
          summary: "",
          reviewedAt: "",
          overallScore: 0,
          categoryScores: {
            conversion: 0,
            trust: 0,
            seo: 0,
            accessibility: 0,
            mobile: 0,
            branding: 0,
          },
        } satisfies BusinessAdvisorReport)
      : null;

    if (!shouldRefreshAdvisorReport(previous, project)) return;

    const report = reviewBusinessProject({
      project,
      history: conversation.messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    });

    lastAdvisorFingerprintRef.current = report.fingerprint;
    setAdvisorReport(report);
  }, [project, conversation.messages]);

  // Creative Director maturity review — independent of advisor fingerprint.
  useEffect(() => {
    const previous = lastCreativeFingerprintRef.current
      ? ({
          fingerprint: lastCreativeFingerprintRef.current,
          overallCompleteness: 0,
          maturityLevel: "Draft",
          missingCapabilities: [],
          recommendedImprovements: [],
          strengths: [],
          narrative: "",
          reviewedAt: "",
          offerCompleteWebsite: false,
        } satisfies CreativeDirectorReport)
      : null;
    if (!shouldRefreshCreativeDirector(previous, project)) return;

    const creative = reviewCreativeDirector({
      project,
      history: conversation.messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    });
    lastCreativeFingerprintRef.current = creative.fingerprint;
    setCreativeDirectorReport(creative);
    setCompleteWebsitePlan(null);
  }, [project, conversation.messages]);

  const displayProject = useMemo<BusinessProject>(() => {
    if (!aiTarget || previewValue === null) return project;
    return applyAiFieldValue(
      project,
      aiTarget.field,
      previewValue,
      aiTarget.serviceIndex,
    );
  }, [project, aiTarget, previewValue]);

  const content = useMemo(
    () => generateWebsiteContent(displayProject),
    [displayProject],
  );

  const themeStyle = useMemo(
    () => buildSiteDesignStyle(displayProject),
    [displayProject],
  );

  function persistAssistantState(input: {
    nextProject: BusinessProject;
    conversation: EditorConversation;
    revisionStack: EditorRevisionStack;
    lastChanges: EditChangeSummary[] | null;
  }) {
    const meta = buildDesignAssistantMeta({
      conversation: input.conversation,
      revisionStack: input.revisionStack,
      lastChanges: input.lastChanges,
    });
    writeDesignAssistantLocal(
      projectId,
      toLocalStore(meta, input.revisionStack),
    );
    const withMeta: BusinessProject = {
      ...input.nextProject,
      designAssistant: meta,
    };
    setProject(withMeta);
    void saveNow();
    return withMeta;
  }

  function handleSave() {
    void saveNow();
  }

  function openAiForField(
    field: AiContentField,
    label: string,
    value: string,
    serviceIndex?: number,
  ) {
    setAiTarget({ field, label, originalValue: value, serviceIndex });
    setPreviewIndex(null);
    setPreviewValue(null);
    setAiOpen(true);
  }

  function handlePreview(index: number, value: string) {
    setPreviewIndex(index);
    setPreviewValue(value);
  }

  function handleApply(value: string) {
    if (!aiTarget) return;

    setAiHistory(
      createAiHistoryEntry(project, aiTarget.field, aiTarget.serviceIndex),
    );

    setProject(
      applyAiFieldValue(
        project,
        aiTarget.field,
        value,
        aiTarget.serviceIndex,
      ),
    );

    setPreviewIndex(null);
    setPreviewValue(null);
    setAiTarget(null);
    setAiOpen(false);
  }

  function handleKeepOriginal() {
    setPreviewIndex(null);
    setPreviewValue(null);
    setAiTarget(null);
    setAiOpen(false);
  }

  function handleCloseAi() {
    setPreviewIndex(null);
    setPreviewValue(null);
    setAiOpen(false);
  }

  function handleUndoLastAiChange() {
    if (!aiHistory) return;
    setProject(
      applyAiFieldValue(
        project,
        aiHistory.field,
        aiHistory.previousValue,
        aiHistory.serviceIndex,
      ),
    );
    setAiHistory(null);
  }

  async function handleDesignSend(request: string) {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setUiStatus("sending");
    setStatusMessage(null);

    const withUser = appendConversationMessage(conversation, {
      role: "user",
      content: request,
    });
    setConversation(withUser);

    try {
      const result = await requestEditorAgentEdit({
        project,
        projectId,
        request,
        history: withUser.messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        imageEditorState,
      });
      if (result.ok && result.imageEditorState) {
        setImageEditorState(result.imageEditorState);
      }
      if (result.ok) {
        setFollowUpSuggestions(result.followUpSuggestions ?? []);
      }

      if (!result.ok) {
        setFollowUpSuggestions([]);
        const failedConvo = appendConversationMessage(withUser, {
          role: "assistant",
          content: result.message,
        });
        setConversation(failedConvo);
        setUiStatus("failed");
        setStatusMessage(result.message);
        writeDesignAssistantLocal(
          projectId,
          toLocalStore(
            buildDesignAssistantMeta({
              conversation: failedConvo,
              revisionStack,
              lastChanges,
            }),
            revisionStack,
          ),
        );
        logDesignAssistantDiagnostic({
          requestId: result.requestId,
          projectId,
          operationCount: 0,
          applyResult: "failed",
          ok: false,
        });
        return;
      }

      if (result.applyStatus === "needs_clarification") {
        const noChangeConvo = appendConversationMessage(withUser, {
          role: "assistant",
          content: result.explanation,
        });
        setConversation(noChangeConvo);
        setLastChanges([]);
        setUiStatus("needs_clarification");
        setStatusMessage(result.explanation);
        writeDesignAssistantLocal(
          projectId,
          toLocalStore(
            buildDesignAssistantMeta({
              conversation: noChangeConvo,
              revisionStack,
              lastChanges: [],
            }),
            revisionStack,
          ),
        );
        setProject({
          ...result.project,
          designAssistant: buildDesignAssistantMeta({
            conversation: noChangeConvo,
            revisionStack,
            lastChanges: [],
          }),
        });
        void saveNow();
        logDesignAssistantDiagnostic({
          requestId: result.requestId,
          projectId,
          operationCount: 0,
          applyResult: "no_changes",
          ok: true,
        });
        return;
      }

      if (result.applyStatus !== "applied") {
        const noChangeConvo = appendConversationMessage(withUser, {
          role: "assistant",
          content: result.explanation,
        });
        setConversation(noChangeConvo);
        setLastChanges([]);
        setUiStatus("no_changes");
        setStatusMessage(result.explanation);
        // Persist memory even when no visual edits landed.
        setProject({
          ...result.project,
          designAssistant: buildDesignAssistantMeta({
            conversation: noChangeConvo,
            revisionStack,
            lastChanges: [],
          }),
        });
        void saveNow();
        writeDesignAssistantLocal(
          projectId,
          toLocalStore(
            buildDesignAssistantMeta({
              conversation: noChangeConvo,
              revisionStack,
              lastChanges: [],
            }),
            revisionStack,
          ),
        );
        logDesignAssistantDiagnostic({
          requestId: result.requestId,
          projectId,
          operationCount: 0,
          applyResult: "no_changes",
          ok: true,
        });
        return;
      }

      const nextStack = pushEditorRevision(revisionStack, {
        before: project,
        after: result.project,
        operations: result.operations,
        changes: result.changes,
        prompt: request,
      });
      const withAssistant = appendConversationMessage(withUser, {
        role: "assistant",
        content: result.explanation,
        operations: result.operations,
        changes: result.changes,
      });

      setRevisionStack(nextStack);
      setConversation(withAssistant);
      setLastChanges(result.changes);
      setUiStatus("applied");
      setStatusMessage(
        `${result.changes.length} change${result.changes.length === 1 ? "" : "s"} applied`,
      );

      persistAssistantState({
        nextProject: result.project,
        conversation: withAssistant,
        revisionStack: nextStack,
        lastChanges: result.changes,
      });

      logDesignAssistantDiagnostic({
        requestId: result.requestId,
        projectId,
        operationCount: result.operations.length,
        applyResult: "applied",
        ok: true,
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? "Atlas AI could not apply that design request. Please try again."
          : "Atlas AI could not apply that design request. Please try again.";
      const failedConvo = appendConversationMessage(withUser, {
        role: "assistant",
        content: message,
      });
      setConversation(failedConvo);
      setUiStatus("failed");
      setStatusMessage(message);
      logDesignAssistantDiagnostic({
        requestId: "client-exception",
        projectId,
        operationCount: 0,
        applyResult: "failed",
        ok: false,
      });
    } finally {
      inFlightRef.current = false;
    }
  }

  function handleDesignUndo() {
    if (inFlightRef.current) return;
    const undone = undoEditorRevision(revisionStack);
    if (!undone) return;
    setRevisionStack(undone.stack);
    setLastChanges(null);
    setUiStatus("idle");
    setStatusMessage(null);
    persistAssistantState({
      nextProject: undone.project,
      conversation,
      revisionStack: undone.stack,
      lastChanges: null,
    });
  }

  function handleDesignRedo() {
    if (inFlightRef.current) return;
    const redone = redoEditorRevision(revisionStack);
    if (!redone) return;
    const head = redone.stack.revisions[redone.stack.index];
    setRevisionStack(redone.stack);
    setLastChanges(head?.changes ?? null);
    setUiStatus("applied");
    persistAssistantState({
      nextProject: redone.project,
      conversation,
      revisionStack: redone.stack,
      lastChanges: head?.changes ?? null,
    });
  }

  function handleApplyRecommendation(recommendation: BusinessRecommendation) {
    if (inFlightRef.current || applyingRecommendationId) return;
    inFlightRef.current = true;
    setApplyingRecommendationId(recommendation.id);
    setRecommendationStates((current) => ({
      ...current,
      [recommendation.id]: { status: "applying", message: null, requestId: null },
    }));
    setUiStatus("sending");
    setStatusMessage(null);

    try {
      const result = applyAdvisorRecommendation({
        project,
        recommendation,
      });

      if (!result.ok) {
        const detail = `${result.message} (Request ID: ${result.requestId})`;
        const failedConvo = appendConversationMessage(conversation, {
          role: "assistant",
          content: detail,
        });
        setConversation(failedConvo);
        setUiStatus("failed");
        setStatusMessage(detail);
        setRecommendationStates((current) => ({
          ...current,
          [recommendation.id]: {
            status: "failed",
            message: result.message,
            requestId: result.requestId,
          },
        }));
        return;
      }

      if (result.status === "no_visible_change") {
        const detail = `${result.explanation} (Request ID: ${result.requestId})`;
        const noOpConvo = appendConversationMessage(conversation, {
          role: "assistant",
          content: detail,
        });
        setConversation(noOpConvo);
        setUiStatus("no_changes");
        setStatusMessage(detail);
        setRecommendationStates((current) => ({
          ...current,
          [recommendation.id]: {
            status: "no_visible_change",
            message: result.explanation,
            requestId: result.requestId,
          },
        }));
        return;
      }

      const nextStack = pushEditorRevision(revisionStack, {
        before: project,
        after: result.project,
        operations: recommendation.operations,
        changes: result.changes,
        prompt: `Apply: ${recommendation.title}`,
      });
      const withAssistant = appendConversationMessage(conversation, {
        role: "assistant",
        content: `${recommendation.narrative} ${result.explanation}`,
        operations: recommendation.operations,
        changes: result.changes,
      });

      setRevisionStack(nextStack);
      setConversation(withAssistant);
      setLastChanges(result.changes);
      setUiStatus("applied");
      setStatusMessage(
        `${result.changes.length} change${result.changes.length === 1 ? "" : "s"} applied`,
      );
      setRecommendationStates((current) => ({
        ...current,
        [recommendation.id]: {
          status: "applied",
          message: result.explanation,
          requestId: result.requestId,
        },
      }));

      // Apply to editor immediately + force persistence.
      persistAssistantState({
        nextProject: result.project,
        conversation: withAssistant,
        revisionStack: nextStack,
        lastChanges: result.changes,
      });

      // Refresh Atlas Review from the post-apply project so satisfied
      // recommendations disappear instead of flashing back unchanged.
      const refreshed = reviewBusinessProject({
        project: result.project,
        history: withAssistant.messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
      });
      lastAdvisorFingerprintRef.current = refreshed.fingerprint;
      setAdvisorReport(refreshed);
    } catch (error) {
      const requestId = `advisor-apply-client-${Date.now().toString(36)}`;
      const message =
        error instanceof Error
          ? error.message
          : "Could not apply that improvement. Please try again.";
      const detail = `${message} (Request ID: ${requestId})`;
      setUiStatus("failed");
      setStatusMessage(detail);
      setRecommendationStates((current) => ({
        ...current,
        [recommendation.id]: {
          status: "failed",
          message,
          requestId,
        },
      }));
    } finally {
      inFlightRef.current = false;
      setApplyingRecommendationId(null);
    }
  }

  function handleCompleteWebsite() {
    // Sprint 28.1 — same Brain → critique pipeline as chat (no heuristic side path).
    void handleDesignSend("Complete my website");
  }

  function handleApplyCreativeRecommendation(
    recommendation: CreativeDirectorRecommendation,
  ) {
    if (inFlightRef.current || applyingRecommendationId) return;
    inFlightRef.current = true;
    setApplyingRecommendationId(recommendation.id);
    setRecommendationStates((current) => ({
      ...current,
      [recommendation.id]: { status: "applying", message: null, requestId: null },
    }));
    setUiStatus("sending");
    setStatusMessage(null);

    try {
      const result = applyCreativeRecommendation({
        project,
        recommendation,
      });

      if (!result.ok) {
        const detail = `${result.message} (Request ID: ${result.requestId})`;
        setConversation(
          appendConversationMessage(conversation, {
            role: "assistant",
            content: detail,
          }),
        );
        setUiStatus("failed");
        setStatusMessage(detail);
        setRecommendationStates((current) => ({
          ...current,
          [recommendation.id]: {
            status: "failed",
            message: result.message,
            requestId: result.requestId,
          },
        }));
        return;
      }

      if (result.status === "no_visible_change") {
        setConversation(
          appendConversationMessage(conversation, {
            role: "assistant",
            content: result.explanation,
          }),
        );
        setUiStatus("no_changes");
        setStatusMessage(result.explanation);
        setRecommendationStates((current) => ({
          ...current,
          [recommendation.id]: {
            status: "no_visible_change",
            message: result.explanation,
            requestId: result.requestId,
          },
        }));
        return;
      }

      const nextStack = pushEditorRevision(revisionStack, {
        before: project,
        after: result.project,
        operations: recommendation.operations,
        changes: result.changes,
        prompt: `Creative: ${recommendation.title}`,
      });
      const withAssistant = appendConversationMessage(conversation, {
        role: "assistant",
        content: result.explanation,
        operations: recommendation.operations,
        changes: result.changes,
      });

      setRevisionStack(nextStack);
      setConversation(withAssistant);
      setLastChanges(result.changes);
      setUiStatus("applied");
      setStatusMessage(
        `${result.changes.length} change${result.changes.length === 1 ? "" : "s"} applied`,
      );
      setRecommendationStates((current) => ({
        ...current,
        [recommendation.id]: {
          status: "applied",
          message: result.explanation,
          requestId: result.requestId,
        },
      }));

      persistAssistantState({
        nextProject: result.project,
        conversation: withAssistant,
        revisionStack: nextStack,
        lastChanges: result.changes,
      });

      const refreshed = reviewCreativeDirector({ project: result.project });
      lastCreativeFingerprintRef.current = refreshed.fingerprint;
      setCreativeDirectorReport(refreshed);
    } catch (error) {
      const requestId = `creative-apply-client-${Date.now().toString(36)}`;
      const message =
        error instanceof Error
          ? error.message
          : "Could not apply that improvement. Please try again.";
      setUiStatus("failed");
      setStatusMessage(`${message} (Request ID: ${requestId})`);
      setRecommendationStates((current) => ({
        ...current,
        [recommendation.id]: { status: "failed", message, requestId },
      }));
    } finally {
      inFlightRef.current = false;
      setApplyingRecommendationId(null);
    }
  }

  function handleApplyAllCreative() {
    // Sprint 28.1 — Apply All always goes through Brain action memory (critique plan).
    void handleDesignSend("Apply All");
  }

  const panel = (
    <AtlasAiPanel
      project={project}
      projectId={projectId}
      messages={conversation.messages}
      status={uiStatus}
      statusMessage={statusMessage}
      canUndo={canUndoEditorRevision(revisionStack)}
      canRedo={canRedoEditorRevision(revisionStack)}
      lastChanges={lastChanges}
      advisorReport={advisorReport}
      creativeDirectorReport={creativeDirectorReport}
      completeWebsitePlan={completeWebsitePlan}
      applyingRecommendationId={applyingRecommendationId}
      recommendationStates={recommendationStates}
      onSend={handleDesignSend}
      onUndo={handleDesignUndo}
      onRedo={handleDesignRedo}
      onApplyRecommendation={handleApplyRecommendation}
      onApplyCreativeRecommendation={handleApplyCreativeRecommendation}
      onCompleteWebsite={handleCompleteWebsite}
      onApplyAllCreative={handleApplyAllCreative}
      onDismissCompletePlan={() => setCompleteWebsitePlan(null)}
      followUpSuggestions={followUpSuggestions}
      onFollowUpSuggestion={(suggestion) => {
        void handleDesignSend(suggestion);
      }}
    />
  );

  return (
    <div className="flex min-h-screen flex-1 bg-background">
      <EditorSidebar
        activeId={activePanel}
        onSelect={setActivePanel}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <EditorTopBar
          businessName={project.businessName}
          onSave={handleSave}
          onMenuClick={() => setSidebarOpen(true)}
          onPublish={() => {
            setPublishIntent("preview");
            setPublishOpen(true);
          }}
        />

        <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto mb-5 flex max-w-5xl items-center justify-between gap-3">
            <p className="text-sm text-muted transition-opacity duration-200">
              <span className="font-medium capitalize text-foreground">
                {activePanel === "branding" ? "Brand Studio" : activePanel}
              </span>
              {" — "}
              {EDITOR_PANEL_HINTS[activePanel]}
            </p>
            <button
              type="button"
              onClick={() => setAiOpen(true)}
              className="shrink-0 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:border-accent/40 hover:text-foreground xl:hidden"
            >
              AI Copywriter
            </button>
          </div>

          <div
            className={`mx-auto flex w-full gap-0 ${
              activePanel === "branding" ||
              activePanel === "media" ||
              activePanel === "seo" ||
              activePanel === "publish"
                ? "max-w-7xl"
                : "max-w-5xl"
            }`}
          >
            {activePanel === "branding" ? (
              <div className="mb-4 w-full shrink-0 lg:mb-0 lg:w-80">
                <BrandStudioPanel project={project} onChange={updateProject} />
              </div>
            ) : null}

            {activePanel === "media" ? (
              <div className="mb-4 w-full shrink-0 lg:mb-0 lg:w-80">
                <MediaLibrary
                  project={project}
                  projectId={projectId}
                  onChange={updateProject}
                />
              </div>
            ) : null}

            {activePanel === "seo" ? (
              <div className="mb-4 w-full shrink-0 lg:mb-0 lg:w-80">
                <SeoPanel project={project} onChange={updateProject} />
              </div>
            ) : null}

            {activePanel === "publish" ? (
              <div className="mb-4 w-full shrink-0 lg:mb-0 lg:w-80">
                <EditorPublishPanel
                  onPublish={() => {
                    setPublishIntent("preview");
                    setPublishOpen(true);
                  }}
                  onPublishToProduction={() => {
                    setPublishIntent("production");
                    setPublishOpen(true);
                  }}
                />
              </div>
            ) : null}

            <div className="min-w-0 flex-1" style={themeStyle}>
              <EditorCanvas
                content={content}
                contact={displayProject.contact}
                projectId={projectId}
                onBusinessNameChange={(businessName) =>
                  updateProject({ businessName })
                }
                onHeadlineChange={(heroHeadline) =>
                  updateProject({ heroHeadline })
                }
                onSubheadlineChange={(heroSubheadline) =>
                  updateProject({ heroSubheadline })
                }
                onAboutChange={(description) => updateProject({ description })}
                onPrimaryCtaChange={(primaryCta) =>
                  updateProject({ primaryCta })
                }
                onServiceChange={(index, patch) =>
                  updateProject({
                    services: project.services.map((service, i) =>
                      i === index ? { ...service, ...patch } : service,
                    ),
                  })
                }
                onContactChange={(patch) =>
                  updateProject((current) => ({
                    contact: { ...current.contact, ...patch },
                  }))
                }
                onGalleryTitleChange={(assetId, title) =>
                  updateProject({
                    mediaLibrary: updateMediaAssetMeta(
                      project.mediaLibrary,
                      assetId,
                      { title },
                    ),
                  })
                }
                onImproveField={openAiForField}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="sticky top-0 hidden h-screen min-h-0 w-80 shrink-0 flex-col overflow-hidden xl:flex">
        {panel}
      </div>

      <div className="fixed bottom-4 right-4 z-30 xl:hidden">
        <details className="group">
          <summary className="cursor-pointer list-none rounded-full border border-border bg-surface/95 px-4 py-2 text-xs font-medium text-foreground shadow-lg backdrop-blur">
            Atlas AI
          </summary>
          <div className="absolute bottom-12 right-0 flex h-[min(78vh,36rem)] w-[min(100vw-2rem,22rem)] flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl">
            {panel}
          </div>
        </details>
      </div>

      <AiAssistantPanel
        open={aiOpen}
        onClose={handleCloseAi}
        target={aiTarget}
        businessName={project.businessName}
        businessType={project.businessType || "Other"}
        previewIndex={previewIndex}
        canUndo={aiHistory !== null}
        onPreview={handlePreview}
        onApply={handleApply}
        onKeepOriginal={handleKeepOriginal}
        onUndoLastAiChange={handleUndoLastAiChange}
      />

      <PublishModal
        open={publishOpen}
        intent={publishIntent}
        onClose={() => setPublishOpen(false)}
      />
    </div>
  );
}
