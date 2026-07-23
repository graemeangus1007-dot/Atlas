"use client";

import { useMemo, useState } from "react";
import BrandStudioPanel from "@/components/design/brand-studio-panel";
import AiAssistantPanel from "@/components/editor/ai-assistant-panel";
import EditorCanvas from "@/components/editor/editor-canvas";
import EditorSidebar from "@/components/editor/editor-sidebar";
import EditorTopBar from "@/components/editor/editor-topbar";
import MediaLibrary from "@/components/media/media-library";
import EditorPublishPanel from "@/components/publishing/editor-publish-panel";
import PublishModal from "@/components/publishing/publish-modal";
import { useProject } from "@/context/project-context";
import {
  EDITOR_PANEL_HINTS,
  type EditorSidebarId,
} from "@/data/editor";
import {
  applyAiFieldValue,
  createAiHistoryEntry,
} from "@/lib/ai/apply-ai-field";
import { buildSiteDesignStyle } from "@/lib/design-theme";
import { updateMediaAssetMeta } from "@/lib/media";
import { generateWebsiteContent } from "@/lib/website-generator";
import type { AiContentField, AiFieldTarget, AiHistoryEntry } from "@/types/ai";
import type { BusinessProject } from "@/types/business-project";

/**
 * Website editor shell — Brand Studio, Media, canvas, and AI Copywriter.
 */
export default function WebsiteEditor() {
  const { project, updateProject, setProject, saveNow } = useProject();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activePanel, setActivePanel] = useState<EditorSidebarId>("content");
  const [publishOpen, setPublishOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiTarget, setAiTarget] = useState<AiFieldTarget | null>(null);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [previewValue, setPreviewValue] = useState<string | null>(null);
  const [aiHistory, setAiHistory] = useState<AiHistoryEntry | null>(null);

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

  return (
    <div className="flex min-h-full flex-1 bg-background">
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
          onPublish={() => setPublishOpen(true)}
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
                <MediaLibrary project={project} onChange={updateProject} />
              </div>
            ) : null}

            {activePanel === "publish" ? (
              <div className="mb-4 w-full shrink-0 lg:mb-0 lg:w-80">
                <EditorPublishPanel onPublish={() => setPublishOpen(true)} />
              </div>
            ) : null}

            <div className="min-w-0 flex-1" style={themeStyle}>
              <EditorCanvas
                content={content}
                contact={displayProject.contact}
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
                  updateProject({
                    contact: { ...project.contact, ...patch },
                  })
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
        onClose={() => setPublishOpen(false)}
      />
    </div>
  );
}
