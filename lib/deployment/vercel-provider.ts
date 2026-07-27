import { buildDeploymentId } from "@/lib/deployment/ids";
import {
  DEPLOYMENT_POLL_INTERVAL_MS,
  DEPLOYMENT_POLL_TIMEOUT_MS,
} from "@/lib/deployment/limits";
import type { DeploymentProvider } from "@/lib/deployment/provider";
import { canReusePreviousPreviewUrl } from "@/lib/deployment/preview-url";
import {
  redactSecrets,
  type VercelDeploymentConfig,
} from "@/lib/deployment/server-config";
import {
  artifactToVercelPreparedFiles,
  toVercelFileReference,
  type ArtifactAssetResolver,
  type VercelPreparedFile,
} from "@/lib/deployment/vercel-files";
import {
  createVercelApiClient,
  isTerminalVercelState,
  toHttpsDeploymentUrl,
  type VercelApiClient,
} from "@/lib/deployment/vercel-api";
import { buildStaticSiteCreateDeploymentBody } from "@/lib/deployment/vercel-static-deployment";
import {
  DEPLOYMENT_STATUS_LABELS,
  type DeploymentError,
  type DeploymentProgressEvent,
  type DeploymentRecord,
  type DeploymentRequest,
  type DeploymentResult,
  type DeploymentStatus,
} from "@/lib/deployment/types";

export type VercelDeploymentProviderOptions = {
  config: VercelDeploymentConfig;
  api?: VercelApiClient;
  assetResolver: ArtifactAssetResolver;
  /** Poll interval while waiting for READY / ERROR. */
  pollIntervalMs?: number;
  /** Max time to wait after create. */
  pollTimeoutMs?: number;
  now?: () => Date;
  sleep?: (ms: number) => Promise<void>;
};

function delay(ms: number, sleep?: (ms: number) => Promise<void>): Promise<void> {
  if (sleep) return sleep(ms);
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function progressForStatus(status: DeploymentStatus, ratio = 0): number {
  switch (status) {
    case "queued":
      return 8;
    case "uploading":
      return 20 + Math.round(ratio * 35);
    case "deploying":
      return 65 + Math.round(ratio * 25);
    case "ready":
      return 100;
    case "failed":
      return 100;
    default:
      return 0;
  }
}

/**
 * Upload unique file digests to Vercel, reusing identical SHAs within the batch.
 * Returns the number of network uploads performed (duplicates skipped).
 */
export async function uploadPreparedFilesBySha(
  api: VercelApiClient,
  files: VercelPreparedFile[],
  onFileUploaded?: (done: number, uniqueTotal: number) => void,
): Promise<number> {
  const uniqueBySha = new Map<string, VercelPreparedFile>();
  for (const file of files) {
    if (!uniqueBySha.has(file.sha)) {
      uniqueBySha.set(file.sha, file);
    }
  }

  const unique = [...uniqueBySha.values()];
  let done = 0;
  for (const file of unique) {
    await api.uploadFile({
      sha: file.sha,
      size: file.size,
      bytes: file.bytes,
    });
    done += 1;
    onFileUploaded?.(done, unique.length);
  }
  return done;
}

/**
 * Real preview hosting via the Vercel Deployments API.
 * Flow: prepare bytes → SHA → POST /v2/files → create deployment with { file, sha, size }.
 * Server-only — never import from client components.
 */
export class VercelDeploymentProvider implements DeploymentProvider {
  readonly id = "vercel";

  private readonly config: VercelDeploymentConfig;
  private readonly api: VercelApiClient;
  private readonly assetResolver: ArtifactAssetResolver;
  private readonly pollIntervalMs: number;
  private readonly pollTimeoutMs: number;
  private readonly now: () => Date;
  private readonly sleep?: (ms: number) => Promise<void>;

  constructor(options: VercelDeploymentProviderOptions) {
    this.config = options.config;
    this.api =
      options.api ??
      createVercelApiClient({
        token: options.config.token,
        teamId: options.config.teamId,
      });
    this.assetResolver = options.assetResolver;
    this.pollIntervalMs =
      options.pollIntervalMs ?? DEPLOYMENT_POLL_INTERVAL_MS;
    this.pollTimeoutMs = options.pollTimeoutMs ?? DEPLOYMENT_POLL_TIMEOUT_MS;
    this.now = options.now ?? (() => new Date());
    this.sleep = options.sleep;
  }

  async deploy(
    request: DeploymentRequest,
    onProgress?: (event: DeploymentProgressEvent) => void,
  ): Promise<DeploymentResult> {
    const { artifact, slug, force = false, previousDeployment } = request;

    if (
      !artifact?.fingerprint ||
      !Array.isArray(artifact.files) ||
      artifact.files.length === 0
    ) {
      return {
        ok: false,
        error: {
          code: "invalid_artifact",
          message: "Deployment artifact is missing or invalid.",
          retryable: false,
        },
      };
    }

    const fingerprint = artifact.fingerprint;
    const deploymentId = buildDeploymentId(slug, fingerprint);
    const token = this.config.token;

    // Only reuse when prior deploy was Vercel and still has a valid *.vercel.app URL.
    // Force Redeploy always bypasses fingerprint reuse.
    if (
      !force &&
      previousDeployment &&
      previousDeployment.artifactFingerprint === fingerprint &&
      previousDeployment.id &&
      canReusePreviousPreviewUrl(
        this.id,
        previousDeployment.previewUrl,
        previousDeployment.provider,
      )
    ) {
      const reused: DeploymentRecord = {
        id: previousDeployment.id,
        status: "ready",
        slug,
        previewUrl: previousDeployment.previewUrl,
        artifactFingerprint: fingerprint,
        provider: this.id,
        createdAt: previousDeployment.createdAt,
        updatedAt: previousDeployment.updatedAt,
        readyAt: previousDeployment.readyAt ?? previousDeployment.updatedAt,
        error: null,
        reused: true,
      };

      onProgress?.({
        deploymentId: reused.id,
        status: "ready",
        label: "Already deployed — no changes to publish",
        progress: 100,
      });

      return { ok: true, deployment: reused };
    }

    const createdAt = this.now().toISOString();
    let updatedAt = createdAt;

    const base: DeploymentRecord = {
      id: deploymentId,
      status: "queued",
      slug,
      previewUrl: "",
      artifactFingerprint: fingerprint,
      provider: this.id,
      createdAt,
      updatedAt,
      readyAt: null,
      error: null,
      reused: false,
    };

    const emit = (status: DeploymentStatus, label?: string, ratio = 0) => {
      updatedAt = this.now().toISOString();
      base.status = status;
      base.updatedAt = updatedAt;
      onProgress?.({
        deploymentId,
        status,
        label: label ?? DEPLOYMENT_STATUS_LABELS[status],
        progress: progressForStatus(status, ratio),
      });
    };

    const fail = (error: DeploymentError): DeploymentResult => {
      base.status = "failed";
      base.error = {
        ...error,
        message: redactSecrets(error.message, token),
      };
      base.updatedAt = this.now().toISOString();
      onProgress?.({
        deploymentId,
        status: "failed",
        label: base.error.message,
        progress: 100,
      });
      return { ok: false, error: base.error, deployment: { ...base } };
    };

    try {
      emit("queued");

      emit("uploading", "Preparing site files for Vercel...", 0.05);
      const prepared = await artifactToVercelPreparedFiles(
        artifact,
        this.assetResolver,
      );
      if (!prepared.some((f) => f.file === "index.html")) {
        return fail({
          code: "invalid_artifact",
          message: "Deployment artifact is missing index.html.",
          retryable: false,
        });
      }

      // Upload each unique digest to /v2/files (raw bytes, not in create body).
      await uploadPreparedFilesBySha(this.api, prepared, (done, total) => {
        emit(
          "uploading",
          `Uploading site files to Vercel (${done}/${total})...`,
          total === 0 ? 1 : done / total,
        );
      });

      const fileRefs = prepared.map(toVercelFileReference);
      emit("deploying", "Creating Vercel deployment...", 0.1);

      // Project id is chosen server-side (preview atlas-sites vs confirmed production).
      const targetProjectId =
        request.vercelProjectId?.trim() || this.config.projectId;

      console.info("[deployment.vercel] target project", {
        source: request.vercelProjectId?.trim()
          ? "server_resolved"
          : "env_default",
        deployTarget: request.deployTarget ?? "preview",
        vercelProjectIdTail:
          targetProjectId.length > 6
            ? `…${targetProjectId.slice(-6)}`
            : targetProjectId,
      });

      // Static customer site only — never inherit Atlas Next.js project builds.
      const created = await this.api.createDeployment(
        buildStaticSiteCreateDeploymentBody({
          slug,
          projectId: targetProjectId,
          files: fileRefs,
        }),
      );

      const vercelId = created.id;
      if (!vercelId) {
        return fail({
          code: "deploy_failed",
          message: "Vercel did not return a deployment id.",
          retryable: true,
        });
      }

      let state = (created.readyState ?? "QUEUED").toUpperCase();
      let urlHost = created.url ?? "";
      const deadline = this.now().getTime() + this.pollTimeoutMs;
      let poll = 0;

      while (!isTerminalVercelState(state)) {
        if (this.now().getTime() > deadline) {
          return fail({
            code: "deploy_failed",
            message: "Timed out waiting for the Vercel deployment to become ready.",
            retryable: true,
          });
        }

        poll += 1;
        emit(
          "deploying",
          `Deploying on Vercel (${state.toLowerCase()})...`,
          Math.min(0.95, 0.2 + poll * 0.08),
        );
        await delay(this.pollIntervalMs, this.sleep);

        const current = await this.api.getDeployment(vercelId);
        state = (current.readyState ?? state).toUpperCase();
        if (current.url) urlHost = current.url;

        if (state === "ERROR" || state === "CANCELED" || state === "DELETED") {
          const reason =
            current.readyStateReason ||
            current.error?.message ||
            `Vercel deployment ended with state ${state}.`;
          return fail({
            code: "deploy_failed",
            message: redactSecrets(reason, token),
            retryable: state === "ERROR",
          });
        }
      }

      if (state !== "READY") {
        return fail({
          code: "deploy_failed",
          message: `Vercel deployment ended with state ${state}.`,
          retryable: true,
        });
      }

      const previewUrl = toHttpsDeploymentUrl(urlHost);
      if (!previewUrl) {
        return fail({
          code: "deploy_failed",
          message: "Vercel deployment ready but no URL was returned.",
          retryable: true,
        });
      }

      const readyAt = this.now().toISOString();
      base.status = "ready";
      base.previewUrl = previewUrl;
      base.readyAt = readyAt;
      base.updatedAt = readyAt;
      base.error = null;

      onProgress?.({
        deploymentId,
        status: "ready",
        label: DEPLOYMENT_STATUS_LABELS.ready,
        progress: 100,
      });

      return { ok: true, deployment: { ...base } };
    } catch (err) {
      const message = redactSecrets(
        err instanceof Error ? err.message : "Vercel deployment failed.",
        token,
      );
      const isSizeError = /too large|exceeds the|MB/i.test(message);
      return fail({
        code: isSizeError ? "upload_failed" : "provider_error",
        message,
        retryable: !isSizeError,
      });
    }
  }
}
