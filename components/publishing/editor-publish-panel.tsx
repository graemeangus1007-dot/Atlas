"use client";

import { useCallback, useEffect, useState } from "react";
import Button from "@/components/ui/button";
import CustomDomainSection from "@/components/publishing/custom-domain-section";
import VersionHistoryModal from "@/components/publishing/version-history-modal";
import { useProject } from "@/context/project-context";

type EditorPublishPanelProps = {
  onPublish: () => void;
  onPublishToProduction?: () => void;
};

type LinkedDomainSummary = {
  hostname: string;
  linkedProjectName: string | null;
  status: string;
};

/**
 * Editor sidebar panel for publish — opens the shared PublishModal / Version History.
 */
export default function EditorPublishPanel({
  onPublish,
  onPublishToProduction,
}: EditorPublishPanelProps) {
  const { project, projectId } = useProject();
  const [historyOpen, setHistoryOpen] = useState(false);
  const [linked, setLinked] = useState<LinkedDomainSummary | null>(null);
  const record = project.publish;
  const atlasPreviewUrl = record?.deployment?.previewUrl || null;
  const productionUrl =
    linked?.status === "active" && linked.hostname
      ? `https://${linked.hostname}`
      : record?.url &&
          atlasPreviewUrl &&
          record.url !== atlasPreviewUrl &&
          !record.url.includes(".vercel.app")
        ? record.url
        : linked?.status === "active"
          ? `https://${linked.hostname}`
          : null;
  const hasUnpublishedRestore =
    project.status === "ready" && Boolean(record);

  const loadLinked = useCallback(async () => {
    if (!projectId) {
      setLinked(null);
      return;
    }
    try {
      const res = await fetch(
        `/api/domains?projectId=${encodeURIComponent(projectId)}`,
        { credentials: "same-origin", cache: "no-store" },
      );
      if (!res.ok) return;
      const data = (await res.json()) as {
        domains?: Array<{
          hostname?: string;
          status?: string;
          linkedProjectName?: string | null;
          migrationState?: string;
        }>;
      };
      const row = data.domains?.find(
        (d) =>
          d.migrationState === "linked" || d.migrationState === "migrated",
      );
      if (!row?.hostname) {
        setLinked(null);
        return;
      }
      setLinked({
        hostname: row.hostname,
        linkedProjectName: row.linkedProjectName ?? null,
        status: row.status || "",
      });
    } catch {
      // Best-effort URL display.
    }
  }, [projectId]);

  useEffect(() => {
    void loadLinked();
  }, [loadLinked]);

  return (
    <div className="rounded-2xl border border-border bg-surface/60 p-5">
      <h2 className="font-[family-name:var(--font-atlas-display)] text-base font-semibold text-foreground">
        Publish
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        Normal Publish deploys to Atlas preview hosting only. Your live custom
        domain is never overwritten unless you use Publish to Production.
      </p>

      {hasUnpublishedRestore ? (
        <p
          className="mt-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200"
          role="status"
        >
          Unpublished changes in the editor — Publish again to update the Atlas
          preview.
        </p>
      ) : null}

      {atlasPreviewUrl || productionUrl ? (
        <div className="mt-4 space-y-2">
          {atlasPreviewUrl ? (
            <div className="rounded-xl border border-border bg-background/50 p-3">
              <p className="text-xs text-muted">Atlas preview (.vercel.app)</p>
              <p className="mt-1 break-all font-mono text-xs text-accent">
                {atlasPreviewUrl}
              </p>
            </div>
          ) : null}
          {productionUrl ? (
            <div className="rounded-xl border border-accent/30 bg-accent-soft/30 p-3">
              <p className="text-xs text-muted">Production custom domain</p>
              <p className="mt-1 break-all font-mono text-xs text-foreground">
                {productionUrl}
              </p>
              <Button
                href={productionUrl}
                variant="ghost"
                className="mt-3 w-full px-3 py-2 text-xs"
              >
                Visit Production Site
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}

      <Button type="button" className="mt-4 w-full" onClick={onPublish}>
        {record ? "Publish Again" : "Publish Website"}
      </Button>

      {linked && onPublishToProduction ? (
        <Button
          type="button"
          variant="secondary"
          className="mt-2 w-full"
          onClick={onPublishToProduction}
        >
          Publish to Production
        </Button>
      ) : null}

      <Button
        type="button"
        variant="secondary"
        className="mt-2 w-full"
        onClick={() => setHistoryOpen(true)}
      >
        Version History
      </Button>

      <CustomDomainSection />

      <VersionHistoryModal
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
      />
    </div>
  );
}
