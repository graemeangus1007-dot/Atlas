"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Button from "@/components/ui/button";
import CustomDomainSection from "@/components/publishing/custom-domain-section";
import VersionHistoryModal from "@/components/publishing/version-history-modal";
import { useProject } from "@/context/project-context";
import {
  isMockPreviewUrl,
  resolveVisitPreviewUrl,
} from "@/lib/deployment/preview-url";
import { getLatestPublishVersion } from "@/lib/supabase/publish-versions";

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
  const { project, projectId, updateProject } = useProject();
  const [historyOpen, setHistoryOpen] = useState(false);
  const [linked, setLinked] = useState<LinkedDomainSummary | null>(null);
  const [latestVersionPreviewUrl, setLatestVersionPreviewUrl] = useState<
    string | null
  >(null);
  const record = project.publish;
  const productionHostname =
    linked?.status === "active" && linked.hostname ? linked.hostname : null;

  const atlasPreviewUrl = useMemo(
    () =>
      resolveVisitPreviewUrl({
        deploymentPreviewUrl: record?.deployment?.previewUrl ?? null,
        latestVersionPreviewUrl,
        publishUrl: record?.url ?? null,
        providerId: record?.deployment?.provider ?? null,
        productionHostname,
      }),
    [
      latestVersionPreviewUrl,
      productionHostname,
      record?.deployment?.previewUrl,
      record?.deployment?.provider,
      record?.url,
    ],
  );

  const productionUrl = productionHostname
    ? `https://${productionHostname}`
    : record?.url &&
        atlasPreviewUrl &&
        record.url !== atlasPreviewUrl &&
        !record.url.includes(".vercel.app") &&
        !isMockPreviewUrl(record.url)
      ? record.url
      : null;

  const legacyFakePreviewBlocked =
    !atlasPreviewUrl &&
    isMockPreviewUrl(record?.deployment?.previewUrl ?? record?.url ?? null);

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

  useEffect(() => {
    if (!projectId) {
      setLatestVersionPreviewUrl(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      const latest = await getLatestPublishVersion(projectId);
      if (cancelled) return;
      if (latest.ok && latest.data?.previewUrl) {
        setLatestVersionPreviewUrl(latest.data.previewUrl);
      } else {
        setLatestVersionPreviewUrl(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId, record?.deployment?.previewUrl, record?.publishedAt]);

  // Heal persisted fake preview URLs when a real version URL is available.
  useEffect(() => {
    if (!record?.deployment || !atlasPreviewUrl) return;
    if (!isMockPreviewUrl(record.deployment.previewUrl)) return;
    if (record.deployment.previewUrl === atlasPreviewUrl) return;
    updateProject({
      publish: {
        ...record,
        deployment: {
          ...record.deployment,
          previewUrl: atlasPreviewUrl,
        },
        url:
          productionUrl && !isMockPreviewUrl(record.url)
            ? record.url
            : atlasPreviewUrl,
      },
    });
    // Intentionally omit `record` / `updateProject` churn — heal once per resolved URL.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [atlasPreviewUrl, productionUrl, record?.deployment?.previewUrl, record?.url]);

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

      {legacyFakePreviewBlocked ? (
        <p
          className="mt-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200"
          role="status"
        >
          Legacy placeholder preview URL detected. Publish again to get a real
          hosting URL (*.vercel.app). Visit Preview is disabled until then.
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
              <Button
                href={atlasPreviewUrl}
                variant="ghost"
                className="mt-3 w-full px-3 py-2 text-xs"
              >
                Visit Preview
              </Button>
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
