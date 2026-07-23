"use client";

import Button from "@/components/ui/button";
import { useProject } from "@/context/project-context";
import { buildPublishedSitePath } from "@/lib/publishing";

type EditorPublishPanelProps = {
  onPublish: () => void;
};

/**
 * Editor sidebar panel for publish — opens the shared PublishModal.
 */
export default function EditorPublishPanel({
  onPublish,
}: EditorPublishPanelProps) {
  const { project } = useProject();
  const record = project.publish;

  return (
    <div className="rounded-2xl border border-border bg-surface/60 p-5">
      <h2 className="font-[family-name:var(--font-atlas-display)] text-base font-semibold text-foreground">
        Publish
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        Deploy a mock live site with your current content, images, branding, and
        template. No real hosting yet.
      </p>

      {record ? (
        <div className="mt-4 rounded-xl border border-border bg-background/50 p-3">
          <p className="text-xs text-muted">Last published</p>
          <p className="mt-1 break-all font-mono text-xs text-accent">
            {record.url}
          </p>
          <Button
            href={buildPublishedSitePath(record.slug)}
            variant="ghost"
            className="mt-3 w-full px-3 py-2 text-xs"
          >
            Visit Website
          </Button>
        </div>
      ) : null}

      <Button type="button" className="mt-4 w-full" onClick={onPublish}>
        {record ? "Publish Again" : "Publish Website"}
      </Button>
    </div>
  );
}
