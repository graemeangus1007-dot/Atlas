"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Button from "@/components/ui/button";
import { useProject } from "@/context/project-context";
import {
  fetchActiveDeploymentProvider,
  type ActiveDeploymentProviderInfo,
} from "@/lib/deployment/deploy-client";
import {
  isMockPreviewUrl,
  resolveVisitPreviewUrl,
} from "@/lib/deployment/preview-url";
import {
  buildPublishedSitePath,
  publisher,
  recordPublishVersionAfterDeploy,
} from "@/lib/publishing";
import { ensureProjectLeadForm } from "@/lib/leads/ensure-client";
import { getLatestPublishVersion } from "@/lib/supabase/publish-versions";
import {
  PUBLISH_STEPS,
  toPublishRecord,
  type PublishStepId,
} from "@/types/publishing";

type LinkedDomainInfo = {
  hostname: string;
  linkedProjectName: string | null;
  migrationState: string;
  status: string;
};

async function fetchLinkedDomainInfo(
  projectId: string | null,
): Promise<LinkedDomainInfo | null> {
  if (!projectId) return null;
  try {
    const res = await fetch(
      `/api/domains?projectId=${encodeURIComponent(projectId)}`,
      { credentials: "same-origin", cache: "no-store" },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      domains?: Array<{
        hostname?: string;
        status?: string;
        linkedProjectName?: string | null;
        migrationState?: string;
      }>;
    };
    const linked = data.domains?.find(
      (d) =>
        d.migrationState === "linked" || d.migrationState === "migrated",
    );
    if (!linked?.hostname) return null;
    return {
      hostname: linked.hostname.trim(),
      linkedProjectName: linked.linkedProjectName ?? null,
      migrationState: linked.migrationState || "linked",
      status: linked.status || "",
    };
  } catch {
    return null;
  }
}

async function fetchActiveCustomHostname(
  projectId: string | null,
): Promise<string | null> {
  if (!projectId) return null;
  try {
    const res = await fetch(
      `/api/domains?projectId=${encodeURIComponent(projectId)}`,
      { credentials: "same-origin", cache: "no-store" },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      domains?: Array<{ hostname?: string; status?: string }>;
    };
    const active = data.domains?.find((d) => d.status === "active");
    return active?.hostname?.trim() || null;
  } catch {
    return null;
  }
}

type PublishPhase =
  | "idle"
  | "confirm_production"
  | "publishing"
  | "success"
  | "error"
  | "unchanged";

type PublishModalProps = {
  open: boolean;
  onClose: () => void;
  /** preview = normal Publish; production = explicit cutover confirm first */
  intent?: "preview" | "production";
};

function labelForProviderRecordId(id: string | null | undefined): string {
  switch (id) {
    case "vercel":
      return "Vercel preview hosting";
    case "supabase-preview":
      return "Supabase preview hosting (legacy)";
    case "mock-local":
    default:
      return "mock provider (local)";
  }
}

/**
 * Publish flow — build static artifact, deploy through provider, persist slim record.
 * Normal Publish / Force Redeploy → atlas-sites only.
 * Publish to Production → linked Vercel project after typed confirmation.
 */
export default function PublishModal({
  open,
  onClose,
  intent = "preview",
}: PublishModalProps) {
  const { project, projectId, updateProject } = useProject();
  const [phase, setPhase] = useState<PublishPhase>("idle");
  const [progress, setProgress] = useState(0);
  const [activeStep, setActiveStep] = useState<PublishStepId | null>(null);
  const [completedSteps, setCompletedSteps] = useState<PublishStepId[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [atlasPreviewUrl, setAtlasPreviewUrl] = useState<string | null>(null);
  const [latestVersionPreviewUrl, setLatestVersionPreviewUrl] = useState<
    string | null
  >(null);
  const [productionUrl, setProductionUrl] = useState<string | null>(null);
  const [deploymentId, setDeploymentId] = useState<string | null>(null);
  const [reusedDeploy, setReusedDeploy] = useState(false);
  const [providerId, setProviderId] = useState<string | null>(null);
  const [versionNumber, setVersionNumber] = useState<number | null>(null);
  const [versionWarning, setVersionWarning] = useState<string | null>(null);
  const [activeProvider, setActiveProvider] =
    useState<ActiveDeploymentProviderInfo | null>(null);
  const [linkedInfo, setLinkedInfo] = useState<LinkedDomainInfo | null>(null);
  const [productionConfirmation, setProductionConfirmation] = useState("");
  const [lastDeployTarget, setLastDeployTarget] = useState<
    "preview" | "production"
  >("preview");
  const runIdRef = useRef(0);

  const publishedSlug = project.publish?.slug ?? null;
  const shownDeploymentId =
    deploymentId ?? project.publish?.deployment?.id ?? null;
  const shownProvider =
    providerId ??
    project.publish?.deployment?.provider ??
    activeProvider?.id ??
    "mock-local";
  const providerLabel =
    activeProvider?.label ?? labelForProviderRecordId(shownProvider);
  const atlasPreviewPath = publishedSlug
    ? buildPublishedSitePath(publishedSlug)
    : null;

  const productionHostname =
    linkedInfo?.status === "active" && linkedInfo.hostname
      ? linkedInfo.hostname
      : null;

  const displayPreviewUrl = useMemo(
    () =>
      resolveVisitPreviewUrl({
        deploymentPreviewUrl:
          atlasPreviewUrl ?? project.publish?.deployment?.previewUrl ?? null,
        latestVersionPreviewUrl,
        publishUrl: project.publish?.url ?? null,
        providerId: shownProvider,
        productionHostname,
      }),
    [
      atlasPreviewUrl,
      latestVersionPreviewUrl,
      productionHostname,
      project.publish?.deployment?.previewUrl,
      project.publish?.url,
      shownProvider,
    ],
  );

  const displayProductionUrl =
    productionUrl ??
    (productionHostname ? `https://${productionHostname}` : null);

  const legacyFakePreviewBlocked =
    !displayPreviewUrl &&
    isMockPreviewUrl(
      atlasPreviewUrl ?? project.publish?.deployment?.previewUrl ?? null,
    );

  useEffect(() => {
    if (!open) {
      runIdRef.current += 1;
      setPhase("idle");
      setProgress(0);
      setActiveStep(null);
      setCompletedSteps([]);
      setError(null);
      setCopied(false);
      setAtlasPreviewUrl(null);
      setLatestVersionPreviewUrl(null);
      setProductionUrl(null);
      setDeploymentId(null);
      setReusedDeploy(false);
      setProviderId(null);
      setVersionNumber(null);
      setVersionWarning(null);
      setActiveProvider(null);
      setLinkedInfo(null);
      setProductionConfirmation("");
      setLastDeployTarget("preview");
      return;
    }

    void (async () => {
      try {
        const info = await fetchActiveDeploymentProvider();
        setActiveProvider(info);
      } catch {
        setActiveProvider({
          provider: "mock",
          id: "mock-local",
          label: "mock provider (local)",
        });
      }

      const linked = await fetchLinkedDomainInfo(projectId);
      setLinkedInfo(linked);

      if (projectId) {
        const latest = await getLatestPublishVersion(projectId);
        if (latest.ok && latest.data?.previewUrl) {
          setLatestVersionPreviewUrl(latest.data.previewUrl);
        }
      }

      if (intent === "production") {
        setPhase("confirm_production");
        return;
      }

      void startPublish({ force: false, deployTarget: "preview" });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, intent]);

  async function startPublish(options: {
    force: boolean;
    deployTarget: "preview" | "production";
    productionConfirmation?: string;
  }) {
    const runId = ++runIdRef.current;
    const deployTarget = options.force ? "preview" : options.deployTarget;
    setLastDeployTarget(deployTarget);
    setPhase("publishing");
    setProgress(0);
    setActiveStep(null);
    setCompletedSteps([]);
    setError(null);
    setCopied(false);
    setAtlasPreviewUrl(null);
    setProductionUrl(null);
    setDeploymentId(null);
    setReusedDeploy(false);
    setProviderId(null);
    setVersionNumber(null);
    setVersionWarning(null);

    try {
      const formId = await ensureProjectLeadForm({
        projectId,
        successMessage:
          project.contact.successMessage ?? project.contact.formSuccessMessage,
        description: project.contact.description,
      });
      if (runId !== runIdRef.current) return;

      const projectForPublish = formId
        ? {
            ...project,
            contact: {
              ...project.contact,
              formId,
              formEnabled: project.contact.formEnabled !== false,
            },
          }
        : project;

      if (formId && project.contact.formId !== formId) {
        updateProject({
          contact: projectForPublish.contact,
        });
      }

      const activeCustomHostname = await fetchActiveCustomHostname(projectId);
      if (runId !== runIdRef.current) return;

      const result = await publisher.publish(
        projectForPublish,
        (event) => {
          if (runId !== runIdRef.current) return;

          const stepIndex = PUBLISH_STEPS.findIndex(
            (step) => step.id === event.step,
          );
          const stepCompleteProgress = Math.round(
            ((stepIndex + 1) / PUBLISH_STEPS.length) * 100,
          );

          setActiveStep(event.step);
          setProgress(event.progress);
          setCompletedSteps(
            PUBLISH_STEPS.slice(
              0,
              event.progress >= stepCompleteProgress
                ? stepIndex + 1
                : Math.max(stepIndex, 0),
            ).map((step) => step.id),
          );
        },
        {
          force: options.force,
          projectId,
          deployTarget,
          productionConfirmation:
            deployTarget === "production"
              ? options.productionConfirmation ?? null
              : null,
          activeCustomHostname,
          deploymentPreviewUrl:
            project.publish?.deployment?.previewUrl ?? null,
        },
      );

      if (runId !== runIdRef.current) return;

      const versionOutcome = await recordPublishVersionAfterDeploy({
        projectId,
        result,
      });
      if (runId !== runIdRef.current) return;

      if (
        versionOutcome.status === "created" ||
        versionOutcome.status === "existing"
      ) {
        setVersionNumber(versionOutcome.version.versionNumber);
        setVersionWarning(null);
      } else if (versionOutcome.status === "failed") {
        setVersionNumber(null);
        setVersionWarning(versionOutcome.warning);
      } else {
        setVersionNumber(null);
        setVersionWarning(null);
      }

      if (runId !== runIdRef.current) return;

      const publishRecord = toPublishRecord(result);
      const previewHostUrl = resolveVisitPreviewUrl({
        deploymentPreviewUrl: result.deployment.previewUrl || publishRecord.url,
        providerId: result.deployment.provider,
        productionHostname: activeCustomHostname,
      });
      const liveUrl = activeCustomHostname
        ? `https://${activeCustomHostname}`
        : null;

      // Persist canonical live URL when custom domain is active; keep provider
      // preview (.vercel.app) on deployment.previewUrl — never invent hosts.
      updateProject({
        status: "published",
        publish: {
          ...publishRecord,
          url: liveUrl || previewHostUrl || publishRecord.url,
          deployment: publishRecord.deployment
            ? {
                ...publishRecord.deployment,
                previewUrl:
                  previewHostUrl || publishRecord.deployment.previewUrl,
              }
            : publishRecord.deployment,
        },
      });
      setAtlasPreviewUrl(previewHostUrl);
      setLatestVersionPreviewUrl((prev) => previewHostUrl || prev);
      setProductionUrl(liveUrl);
      setDeploymentId(result.deployment.id);
      setProviderId(result.deployment.provider);
      setReusedDeploy(Boolean(result.deployment.reused));
      setProgress(100);
      setCompletedSteps(PUBLISH_STEPS.map((step) => step.id));
      setActiveStep(null);
      setPhase(result.deployment.reused ? "unchanged" : "success");
    } catch (err) {
      if (runId !== runIdRef.current) return;
      setError(
        err instanceof Error ? err.message : "Publish failed. Please try again.",
      );
      setPhase(
        intent === "production" && deployTarget === "production"
          ? "confirm_production"
          : "error",
      );
    }
  }

  async function handleCopy(url: string | null) {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      setCopied(false);
    }
  }

  if (!open) return null;

  const showSuccess = phase === "success" || phase === "unchanged";
  const confirmTokenHint =
    linkedInfo?.hostname ||
    linkedInfo?.linkedProjectName ||
    "your-domain.com";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-black/60"
        aria-label="Close publish dialog"
        onClick={onClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="publish-title"
        className="relative z-10 flex max-h-[min(90vh,40rem)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-[0_24px_80px_-24px_rgba(0,0,0,0.8)]"
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <h2
              id="publish-title"
              className="font-[family-name:var(--font-atlas-display)] text-base font-semibold text-foreground"
            >
              {intent === "production"
                ? "Publish to Production"
                : "Publish Website"}
            </h2>
            <p className="text-xs text-muted">
              {intent === "production"
                ? "Replace the live linked Vercel project"
                : `Build + deploy · ${providerLabel}`}
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

        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          {phase === "confirm_production" ? (
            <div className="space-y-4 text-left">
              <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                <p className="font-semibold">This replaces the live website</p>
                <p className="mt-2 text-xs leading-relaxed text-amber-100/90">
                  Publishing to production deploys into the linked Vercel
                  project
                  {linkedInfo?.linkedProjectName
                    ? ` (${linkedInfo.linkedProjectName})`
                    : ""}
                  {linkedInfo?.hostname
                    ? ` serving ${linkedInfo.hostname}`
                    : ""}
                  . The current live deployment will be replaced. Normal Publish
                  and Force Redeploy never do this — they only update Atlas
                  preview hosting.
                </p>
              </div>
              <label className="block text-xs text-muted">
                Type{" "}
                <span className="font-mono text-foreground">
                  {confirmTokenHint}
                </span>{" "}
                to confirm
                <input
                  type="text"
                  value={productionConfirmation}
                  onChange={(e) => setProductionConfirmation(e.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                  className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm text-foreground outline-none focus:border-accent"
                  placeholder={confirmTokenHint}
                />
              </label>
              {error ? (
                <p className="text-sm text-red-400" role="alert">
                  {error}
                </p>
              ) : null}
            </div>
          ) : null}

          {phase === "publishing" || phase === "idle" ? (
            <>
              {lastDeployTarget === "production" ? (
                <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                  Deploying to the linked production Vercel project…
                </p>
              ) : (
                <p className="text-xs text-muted">
                  Deploying to Atlas preview hosting (atlas-sites). Your live
                  custom domain is not overwritten.
                </p>
              )}
              <ul className="space-y-3" aria-live="polite">
                {PUBLISH_STEPS.map((step) => {
                  const done = completedSteps.includes(step.id);
                  const current = activeStep === step.id && !done;
                  return (
                    <li
                      key={step.id}
                      className={`flex items-center gap-3 text-sm transition-colors ${
                        done
                          ? "text-foreground"
                          : current
                            ? "text-accent"
                            : "text-muted"
                      }`}
                    >
                      <span
                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs ${
                          done
                            ? "border-accent bg-accent-soft text-accent"
                            : current
                              ? "border-accent"
                              : "border-border"
                        }`}
                        aria-hidden="true"
                      >
                        {done ? "✓" : current ? "…" : ""}
                      </span>
                      {step.label}
                    </li>
                  );
                })}
              </ul>

              <div>
                <div className="mb-2 flex items-center justify-between text-xs text-muted">
                  <span>Progress</span>
                  <span>{progress}%</span>
                </div>
                <div
                  className="h-2 overflow-hidden rounded-full bg-background"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={progress}
                >
                  <div
                    className="h-full rounded-full bg-accent transition-[width] duration-500 ease-out"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            </>
          ) : null}

          {showSuccess ? (
            <div className="space-y-4 text-center">
              <p className="text-lg font-semibold text-foreground">
                {reusedDeploy
                  ? "Already up to date"
                  : lastDeployTarget === "production"
                    ? "✅ Production Updated"
                    : "✅ Website Published Successfully"}
              </p>

              {displayPreviewUrl ? (
                <div className="rounded-xl border border-border bg-background/50 px-4 py-3 text-left">
                  <p className="text-xs text-muted">Atlas preview (.vercel.app)</p>
                  <p className="mt-1 break-all font-mono text-sm text-accent">
                    {displayPreviewUrl}
                  </p>
                </div>
              ) : legacyFakePreviewBlocked ? (
                <div
                  className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-left"
                  role="status"
                >
                  <p className="text-xs font-medium text-amber-100">
                    Preview URL unavailable
                  </p>
                  <p className="mt-1 text-xs text-amber-100/90">
                    This project still has a legacy placeholder preview host.
                    Publish again to get a real hosting URL (for example
                    *.vercel.app).
                  </p>
                </div>
              ) : null}

              {displayProductionUrl ? (
                <div className="rounded-xl border border-accent/30 bg-accent-soft/30 px-4 py-3 text-left">
                  <p className="text-xs text-muted">
                    Production custom domain
                  </p>
                  <p className="mt-1 break-all font-mono text-sm text-foreground">
                    {displayProductionUrl}
                  </p>
                  {lastDeployTarget === "preview" ? (
                    <p className="mt-2 text-[11px] text-muted">
                      Live production was not changed by this preview publish.
                    </p>
                  ) : null}
                </div>
              ) : null}

              {shownDeploymentId ? (
                <p className="text-xs text-muted">
                  Deployment ID:{" "}
                  <span className="font-mono">{shownDeploymentId}</span>
                  {shownProvider ? (
                    <>
                      {" "}
                      · Provider:{" "}
                      <span className="font-mono">{shownProvider}</span>
                    </>
                  ) : null}
                  {versionNumber != null ? (
                    <>
                      {" "}
                      · Version:{" "}
                      <span className="font-mono">v{versionNumber}</span>
                    </>
                  ) : null}
                </p>
              ) : null}
              {versionWarning ? (
                <p
                  className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-left text-xs text-amber-200"
                  role="status"
                >
                  {versionWarning}
                </p>
              ) : null}
            </div>
          ) : null}

          {phase === "error" ? (
            <p className="text-sm text-red-400" role="alert">
              {error}
            </p>
          ) : null}
        </div>

        <div className="space-y-2 border-t border-border p-4">
          {phase === "confirm_production" ? (
            <>
              <Button
                type="button"
                className="w-full"
                disabled={!productionConfirmation.trim()}
                onClick={() =>
                  void startPublish({
                    force: false,
                    deployTarget: "production",
                    productionConfirmation,
                  })
                }
              >
                Publish to Production
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={onClose}
              >
                Cancel — keep live site
              </Button>
            </>
          ) : null}

          {showSuccess ? (
            <>
              {displayProductionUrl ? (
                <Button href={displayProductionUrl} className="w-full">
                  Visit Production Site
                </Button>
              ) : displayPreviewUrl ? (
                <Button href={displayPreviewUrl} className="w-full">
                  Visit Preview
                </Button>
              ) : null}
              {displayPreviewUrl && displayProductionUrl ? (
                <Button
                  href={displayPreviewUrl}
                  variant="secondary"
                  className="w-full"
                >
                  Visit Preview
                </Button>
              ) : null}
              {atlasPreviewPath ? (
                <Button
                  href={atlasPreviewPath}
                  variant="secondary"
                  className="w-full"
                >
                  Open Atlas Snapshot
                </Button>
              ) : null}
              <Button
                type="button"
                variant="secondary"
                className="w-full"
                onClick={() =>
                  void handleCopy(displayProductionUrl || displayPreviewUrl)
                }
              >
                {copied ? "Copied!" : "Copy URL"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() =>
                  void startPublish({ force: true, deployTarget: "preview" })
                }
              >
                {reusedDeploy ? "Force Redeploy" : "Publish Again"}
              </Button>
            </>
          ) : null}

          {phase === "error" ? (
            <Button
              type="button"
              className="w-full"
              onClick={() =>
                void startPublish({ force: false, deployTarget: "preview" })
              }
            >
              Try Again
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
