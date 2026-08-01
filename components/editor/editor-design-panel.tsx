"use client";

import { useState } from "react";
import BrandStudioPanel from "@/components/design/brand-studio-panel";
import MediaLibrary from "@/components/media/media-library";
import type { BusinessProject } from "@/types/business-project";

type EditorDesignPanelProps = {
  project: BusinessProject;
  projectId: string | null;
  onChange: (partial: Partial<BusinessProject>) => void;
};

/**
 * Design tools — appearance first; media as a secondary asset workflow.
 */
export default function EditorDesignPanel({
  project,
  projectId,
  onChange,
}: EditorDesignPanelProps) {
  const [mediaOpen, setMediaOpen] = useState(false);

  return (
    <div className="flex w-full flex-col gap-3" data-testid="editor-design-panel">
      <BrandStudioPanel project={project} onChange={onChange} />
      <div className="rounded-2xl border border-border/70 bg-surface/60">
        <button
          type="button"
          className="flex w-full items-center justify-between px-4 py-3 text-left"
          onClick={() => setMediaOpen((open) => !open)}
          aria-expanded={mediaOpen}
          data-testid="editor-media-secondary-toggle"
        >
          <div>
            <p className="text-sm font-medium text-foreground">Photos</p>
            <p className="text-xs text-muted">
              Upload assets for the hero and gallery
            </p>
          </div>
          <span className="text-xs text-muted" aria-hidden="true">
            {mediaOpen ? "Hide" : "Show"}
          </span>
        </button>
        {mediaOpen ? (
          <div className="border-t border-border/70 p-2" data-testid="editor-media-secondary">
            <MediaLibrary
              project={project}
              projectId={projectId}
              onChange={onChange}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
