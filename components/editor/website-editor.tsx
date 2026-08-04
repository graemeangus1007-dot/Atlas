"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import AtlasAiPanel, {
  type AtlasAiUiStatus,
  type RecommendationApplyState,
} from "@/components/editor/atlas-ai-panel";
import EditorCanvas from "@/components/editor/editor-canvas";
import EditorDesignPanel from "@/components/editor/editor-design-panel";
import EditorSidebar from "@/components/editor/editor-sidebar";
import EditorSiteSettingsPanel from "@/components/editor/editor-site-settings-panel";
import EditorTopBar from "@/components/editor/editor-topbar";
import PublishModal from "@/components/publishing/publish-modal";
import { useProject } from "@/context/project-context";
import {
  EDITOR_PANEL_HINTS,
  type EditorSidebarId,
} from "@/data/editor";
import { deriveAltText, deriveDisplayTitle } from "@/lib/media-titles";
import {
  appendConversationMessage,
  applyAdvisorRecommendation,
  applyCreativeRecommendation,
  buildDesignAssistantMeta,
  canRedoEditorRevision,
  canUndoEditorRevision,
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
import { ATLAS_VOICE } from "@/lib/ai/atlas-designer-voice";
import type { ConversationAttachment } from "@/lib/ai/conversation-attachments";
import { buildSiteDesignStyle } from "@/lib/design-theme";
import { updateMediaAssetMeta } from "@/lib/media";
import { generateWebsiteContent } from "@/lib/website-generator";
import type { BusinessProject } from "@/types/business-project";

/**
 * Canonical Atlas v1 website editor shell.
 * Tools rail (secondary) · canvas (primary) · Atlas conversation (primary).
 */
export default function WebsiteEditor() {
  const { project, projectId, updateProject, setProject, saveNow } = useProject();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activePanel, setActivePanel] = useState<EditorSidebarId>("content");
  const [publishOpen, setPublishOpen] = useState(false);
  const [publishIntent, setPublishIntent] = useState<"preview" | "production">(
    "preview",
  );
  const welcomeHandledRef = useRef(false);

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

  // After New Site onboarding — Atlas greets the user once.
  useEffect(() => {
    if (welcomeHandledRef.current) return;
    if (searchParams.get("welcome") !== "1") return;
    if (hydratedProjectIdRef.current === null) return;

    welcomeHandledRef.current = true;
    const name = project.businessName?.trim() || "your business";
    setConversation((prev) => {
      if (prev.messages.some((m) => m.role === "assistant")) return prev;
      return appendConversationMessage(prev, {
        role: "assistant",
        content: ATLAS_VOICE.welcome(name),
      });
    });

    const next = new URLSearchParams(searchParams.toString());
    next.delete("welcome");
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }, [pathname, project.businessName, router, searchParams]);

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

  const content = useMemo(
    () => generateWebsiteContent(project),
    [project],
  );

  const themeStyle = useMemo(
    () => buildSiteDesignStyle(project),
    [project],
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

  async function handleDesignSend(
    request: string,
    attachments?: ConversationAttachment[],
  ) {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setUiStatus("sending");
    setStatusMessage(null);

    const persistedAttachments = (attachments ?? []).filter(
      (att) =>
        att.status === "uploaded" &&
        Boolean(att.assetId) &&
        !att.previewUrl?.startsWith("blob:") &&
        !att.localObjectUrl,
    );

    const withUser = appendConversationMessage(conversation, {
      role: "user",
      content: request,
      ...(persistedAttachments.length
        ? { attachments: persistedAttachments }
        : {}),
    });
    setConversation(withUser);

    const attachmentContexts = persistedAttachments
      .filter(
        (att): att is typeof att & { assetId: string; type: "image" | "logo" } =>
          Boolean(att.assetId) &&
          (att.type === "image" || att.type === "logo"),
      )
      .map((att, position) => ({
        attachmentId: att.id,
        assetId: att.assetId,
        type: att.type,
        filename: att.filename,
        width: att.width,
        height: att.height,
        position,
      }));

    // Ensure attachment assets are on the project snapshot sent to Atlas.
    let library = project.mediaLibrary ?? [];
    let libraryChanged = false;
    for (const att of persistedAttachments) {
      if (!att.assetId) continue;
      if (library.some((asset) => asset.id === att.assetId)) continue;
      if (!libraryChanged) {
        library = [...library];
        libraryChanged = true;
      }
      const cleanTitle = deriveDisplayTitle(att.filename, 0);
      library.unshift({
        id: att.assetId,
        name: att.filename,
        filename: att.filename,
        url:
          att.previewUrl && !att.previewUrl.startsWith("blob:")
            ? att.previewUrl
            : "",
        storagePath: att.storagePath ?? null,
        mimeType: att.mimeType,
        size: att.sizeBytes,
        sizeLabel: "",
        createdAt: Date.now(),
        title: cleanTitle,
        description: "",
        alt: deriveAltText(cleanTitle, att.filename, 0),
        unavailable: !att.storagePath,
      });
    }
    const projectForEdit = libraryChanged
      ? { ...project, mediaLibrary: library }
      : project;
    if (libraryChanged) {
      setProject(projectForEdit);
    }

    try {
      const result = await requestEditorAgentEdit({
        project: projectForEdit,
        projectId,
        request,
        history: withUser.messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        imageEditorState,
        attachmentContexts,
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
          ? ATLAS_VOICE.applyFailed
          : ATLAS_VOICE.applyFailed;
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
          : ATLAS_VOICE.applyFailed;
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
          : ATLAS_VOICE.applyFailed;
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
      onMediaAssetsAdded={(assets) => {
        updateProject((current) => ({
          mediaLibrary: [
            ...assets,
            ...(current.mediaLibrary ?? []).filter(
              (existing) => !assets.some((asset) => asset.id === existing.id),
            ),
          ],
        }));
      }}
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
      onClearConversation={() => {
        setConversation(createEmptyEditorConversation());
        setFollowUpSuggestions([]);
        setLastChanges(null);
        setUiStatus("idle");
        setStatusMessage(null);
      }}
      onNewConversation={() => {
        setConversation(createEmptyEditorConversation());
        setFollowUpSuggestions([]);
        setLastChanges(null);
        setCompleteWebsitePlan(null);
        setUiStatus("idle");
        setStatusMessage(null);
      }}
    />
  );

  return (
    <div
      className="flex min-h-screen flex-1 bg-background"
      data-testid="website-editor-shell"
    >
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

        <div className="flex-1 overflow-y-auto px-3 py-4 sm:px-5 lg:px-6">
          {activePanel === "content" ? (
            <p
              className="mx-auto mb-4 max-w-5xl text-sm text-muted"
              data-testid="editor-panel-hint"
            >
              {EDITOR_PANEL_HINTS.content}
            </p>
          ) : (
            <p
              className="mx-auto mb-3 max-w-7xl text-xs text-muted"
              data-testid="editor-panel-hint"
            >
              {EDITOR_PANEL_HINTS[activePanel]}
            </p>
          )}

          <div
            className={`mx-auto flex w-full gap-4 ${
              activePanel === "design" || activePanel === "settings"
                ? "max-w-7xl"
                : "max-w-5xl"
            }`}
          >
            {activePanel === "design" ? (
              <div className="mb-4 w-full shrink-0 lg:mb-0 lg:w-80">
                <EditorDesignPanel
                  project={project}
                  projectId={projectId}
                  onChange={updateProject}
                />
              </div>
            ) : null}

            {activePanel === "settings" ? (
              <div className="mb-4 w-full shrink-0 lg:mb-0 lg:w-80">
                <EditorSiteSettingsPanel
                  project={project}
                  onChange={updateProject}
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
                contact={project.contact}
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
              />
            </div>
          </div>
        </div>
      </div>

      {/* Atlas: readable 360–440px; visible from lg for desktop parity */}
      <div
        className="sticky top-0 hidden h-screen min-h-0 w-[min(28vw,440px)] min-w-[360px] max-w-[440px] shrink-0 flex-col overflow-hidden border-l border-border/70 lg:flex"
        data-testid="atlas-desktop-panel"
      >
        {panel}
      </div>

      <div className="fixed bottom-4 right-4 z-30 lg:hidden">
        <details className="group">
          <summary className="cursor-pointer list-none rounded-full border border-border bg-surface/95 px-4 py-2 text-xs font-medium text-foreground shadow-lg backdrop-blur">
            Atlas
          </summary>
          <div className="absolute bottom-12 right-0 flex h-[min(78vh,36rem)] w-[min(100vw-2rem,24rem)] flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl">
            {panel}
          </div>
        </details>
      </div>

      <PublishModal
        open={publishOpen}
        intent={publishIntent}
        onClose={() => setPublishOpen(false)}
      />
    </div>
  );
}
