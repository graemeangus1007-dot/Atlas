"use client";

import { useCallback, useEffect, useState } from "react";
import Button from "@/components/ui/button";
import { useProject } from "@/context/project-context";
import {
  isCurrentPublishVersion,
  restorePublishVersion,
} from "@/lib/publishing/restore-publish-version";
import {
  PUBLISH_VERSION_PAGE_SIZE,
  type PublishVersionSummary,
} from "@/lib/publishing/publish-version-types";
import { listPublishVersionPage } from "@/lib/supabase/publish-versions";

type VersionHistoryModalProps = {
  open: boolean;
  onClose: () => void;
};

function formatPublishedAt(iso: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function providerLabel(provider: string): string {
  switch (provider) {
    case "vercel":
      return "Vercel";
    case "supabase-preview":
      return "Supabase";
    case "mock-local":
      return "Mock (local)";
    default:
      return provider;
  }
}

/**
 * Version History — newest-first list, paginated, restore with confirmation.
 * Restore loads the snapshot lazily and is not a publish.
 */
export default function VersionHistoryModal({
  open,
  onClose,
}: VersionHistoryModalProps) {
  const { project, projectId, setProject, saveNow } = useProject();
  const [items, setItems] = useState<PublishVersionSummary[]>([]);
  const [latestVersionNumber, setLatestVersionNumber] = useState<number | null>(
    null,
  );
  const [nextOffset, setNextOffset] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmVersion, setConfirmVersion] =
    useState<PublishVersionSummary | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [restoreMessage, setRestoreMessage] = useState<string | null>(null);

  const loadPage = useCallback(
    async (offset: number, append: boolean) => {
      if (!projectId) return;
      if (append) setLoadingMore(true);
      else setLoading(true);
      setError(null);

      const result = await listPublishVersionPage(projectId, {
        limit: PUBLISH_VERSION_PAGE_SIZE,
        offset,
      });

      if (!result.ok) {
        setError(result.error);
        if (!append) setItems([]);
        setLoading(false);
        setLoadingMore(false);
        return;
      }

      setLatestVersionNumber(result.data.latestVersionNumber);
      setNextOffset(result.data.nextOffset);
      setItems((current) =>
        append ? [...current, ...result.data.items] : result.data.items,
      );
      setLoading(false);
      setLoadingMore(false);
    },
    [projectId],
  );

  useEffect(() => {
    if (!open) {
      setItems([]);
      setNextOffset(null);
      setLatestVersionNumber(null);
      setError(null);
      setConfirmVersion(null);
      setRestoring(false);
      setRestoreMessage(null);
      return;
    }
    if (!projectId) {
      setError("Open a saved project to view publish history.");
      return;
    }
    void loadPage(0, false);
  }, [open, projectId, loadPage]);

  async function handleConfirmRestore() {
    if (!projectId || !confirmVersion) return;
    setRestoring(true);
    setError(null);

    const result = await restorePublishVersion({
      projectId,
      versionId: confirmVersion.id,
      currentProject: project,
      latestVersionNumber,
    });

    if (!result.ok) {
      setError(result.error);
      setRestoring(false);
      return;
    }

    setProject(result.restoredProject);
    await saveNow();
    setRestoreMessage(
      `Restored v${result.version.versionNumber} into the editor. Publish again to update the live site.`,
    );
    setConfirmVersion(null);
    setRestoring(false);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-black/60"
        aria-label="Close version history"
        onClick={onClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="version-history-title"
        className="relative z-10 flex max-h-[min(90vh,40rem)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-[0_24px_80px_-24px_rgba(0,0,0,0.8)]"
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <h2
              id="version-history-title"
              className="font-[family-name:var(--font-atlas-display)] text-base font-semibold text-foreground"
            >
              Version History
            </h2>
            <p className="text-xs text-muted">
              Newest first · Restore loads editor state (not a publish)
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border px-2.5 py-1.5 text-xs text-muted transition-colors hover:text-foreground"
          >
            Close
          </button>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto p-5">
          {loading ? (
            <p className="text-sm text-muted">Loading versions…</p>
          ) : null}

          {error ? (
            <p className="text-sm text-red-400" role="alert">
              {error}
            </p>
          ) : null}

          {restoreMessage ? (
            <p
              className="rounded-lg border border-accent/40 bg-accent-soft px-3 py-2 text-xs text-accent"
              role="status"
            >
              {restoreMessage}
            </p>
          ) : null}

          {!loading && !error && items.length === 0 ? (
            <p className="text-sm text-muted">
              No publish versions yet. Publish your site to create the first
              version.
            </p>
          ) : null}

          <ul className="space-y-3">
            {items.map((version) => {
              const isCurrent = isCurrentPublishVersion(
                version,
                latestVersionNumber,
              );
              return (
                <li
                  key={version.id}
                  className="rounded-xl border border-border bg-background/40 p-4"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-foreground">
                      Version v{version.versionNumber}
                    </p>
                    {isCurrent ? (
                      <span className="rounded-md border border-accent/40 bg-accent-soft px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-accent">
                        Current
                      </span>
                    ) : null}
                  </div>
                  <dl className="mt-3 space-y-1 text-xs text-muted">
                    <div className="flex gap-2">
                      <dt className="w-20 shrink-0">Published</dt>
                      <dd className="text-foreground/90">
                        {formatPublishedAt(version.createdAt)}
                      </dd>
                    </div>
                    <div className="flex gap-2">
                      <dt className="w-20 shrink-0">Provider</dt>
                      <dd className="text-foreground/90">
                        {providerLabel(version.deploymentProvider)}
                      </dd>
                    </div>
                    <div className="flex gap-2">
                      <dt className="w-20 shrink-0">Status</dt>
                      <dd className="font-mono text-foreground/90">
                        {version.deploymentStatus}
                      </dd>
                    </div>
                    <div className="flex gap-2">
                      <dt className="w-20 shrink-0">Preview</dt>
                      <dd className="min-w-0 break-all font-mono text-accent">
                        {version.previewUrl.startsWith("http") &&
                        !version.previewUrl.includes("preview.atlas.site") ? (
                          <a
                            href={version.previewUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:underline"
                          >
                            {version.previewUrl}
                          </a>
                        ) : (
                          <span className="text-muted">
                            {version.previewUrl.includes("preview.atlas.site")
                              ? "Legacy placeholder URL (publish again)"
                              : version.previewUrl}
                          </span>
                        )}
                      </dd>
                    </div>
                  </dl>
                  <div className="mt-3">
                    <Button
                      type="button"
                      variant="secondary"
                      className="w-full px-3 py-2 text-xs"
                      disabled={isCurrent || restoring}
                      onClick={() => {
                        setRestoreMessage(null);
                        setConfirmVersion(version);
                      }}
                    >
                      {isCurrent ? "Current version" : "Restore this version"}
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>

          {nextOffset != null ? (
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              disabled={loadingMore}
              onClick={() => void loadPage(nextOffset, true)}
            >
              {loadingMore ? "Loading…" : "Load older versions"}
            </Button>
          ) : null}
        </div>
      </div>

      {confirmVersion ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/70"
            aria-label="Cancel restore"
            disabled={restoring}
            onClick={() => {
              if (!restoring) setConfirmVersion(null);
            }}
          />
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="restore-confirm-title"
            aria-describedby="restore-confirm-desc"
            className="relative z-10 w-full max-w-md rounded-2xl border border-border bg-surface p-5 shadow-xl"
          >
            <h3
              id="restore-confirm-title"
              className="font-[family-name:var(--font-atlas-display)] text-base font-semibold text-foreground"
            >
              Restore v{confirmVersion.versionNumber}?
            </h3>
            <p id="restore-confirm-desc" className="mt-2 text-sm text-muted">
              This replaces your current editor content with the saved snapshot.
              It does not change the live website. You will need to Publish again
              to update the live site. History stays immutable.
            </p>
            <div className="mt-5 flex flex-col gap-2 sm:flex-row-reverse">
              <Button
                type="button"
                className="w-full sm:w-auto"
                disabled={restoring}
                onClick={() => void handleConfirmRestore()}
              >
                {restoring ? "Restoring…" : "Restore this version"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="w-full sm:w-auto"
                disabled={restoring}
                onClick={() => setConfirmVersion(null)}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
