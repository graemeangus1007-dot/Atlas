import { buildDeploymentId } from "@/lib/deployment/ids";
import type { DeploymentProvider } from "@/lib/deployment/provider";
import {
  buildPreviewObjectPath,
  collectPreviewUploads,
  type PreviewStorageGateway,
} from "@/lib/deployment/preview-paths";
import { canReusePreviousPreviewUrl } from "@/lib/deployment/preview-url";
import { createSupabasePreviewGateway } from "@/lib/deployment/supabase-gateway";
import {
  isTransientDeploymentError,
  withRetry,
} from "@/lib/deployment/retry";
import {
  DEPLOYMENT_STATUS_LABELS,
  type DeploymentError,
  type DeploymentProgressEvent,
  type DeploymentRecord,
  type DeploymentRequest,
  type DeploymentResult,
  type DeploymentStatus,
} from "@/lib/deployment/types";
export type SupabasePreviewDeploymentProviderOptions = {
  gateway?: PreviewStorageGateway;
  /** Poll interval while waiting for the public URL to become ready. */
  pollIntervalMs?: number;
  /** Max time to wait for readiness after uploads. */
  pollTimeoutMs?: number;
  /** Upload retry count (re-attempts after the first failure). */
  uploadRetries?: number;
  /** Override clock for tests. */
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

function progressForStatus(status: DeploymentStatus, uploadRatio = 0): number {
  switch (status) {
    case "queued":
      return 8;
    case "uploading":
      return 15 + Math.round(uploadRatio * 50);
    case "deploying":
      return 75;
    case "ready":
      return 100;
    case "failed":
      return 100;
    default:
      return 0;
  }
}

/**
 * Real preview hosting via Supabase Storage (`site-previews` public bucket).
 * Uploads the static artifact, polls until the public URL is reachable, retries
 * transient upload failures. Does not configure custom domains.
 */
export class SupabasePreviewDeploymentProvider implements DeploymentProvider {
  readonly id = "supabase-preview";

  private readonly gateway: PreviewStorageGateway;
  private readonly pollIntervalMs: number;
  private readonly pollTimeoutMs: number;
  private readonly uploadRetries: number;
  private readonly now: () => Date;
  private readonly sleep?: (ms: number) => Promise<void>;

  constructor(options: SupabasePreviewDeploymentProviderOptions = {}) {
    this.gateway = options.gateway ?? createSupabasePreviewGateway();
    this.pollIntervalMs = options.pollIntervalMs ?? 700;
    this.pollTimeoutMs = options.pollTimeoutMs ?? 20_000;
    this.uploadRetries = options.uploadRetries ?? 3;
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

    // Only reuse when the prior URL is a real site-previews Storage URL.
    // Never reuse a mock https://{slug}.preview.atlas.site link.
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
    let record: DeploymentRecord = {
      id: deploymentId,
      status: "queued",
      slug,
      previewUrl: "",
      artifactFingerprint: fingerprint,
      provider: this.id,
      createdAt,
      updatedAt: createdAt,
      readyAt: null,
      error: null,
      reused: false,
    };

    const emit = (status: DeploymentStatus, label?: string, uploadRatio = 0) => {
      record = {
        ...record,
        status,
        updatedAt: this.now().toISOString(),
      };
      onProgress?.({
        deploymentId,
        status,
        label: label ?? DEPLOYMENT_STATUS_LABELS[status],
        progress: progressForStatus(status, uploadRatio),
      });
    };

    try {
      emit("queued");

      const userId = await this.gateway.getUserId();
      if (!userId) {
        return this.fail(record, {
          code: "provider_error",
          message: "Please sign in to publish a preview, then try again.",
          retryable: false,
        });
      }

      // Source of truth: public Storage object URL for index.html (never mock host).
      const indexObjectPath = buildPreviewObjectPath(
        userId,
        slug,
        "index.html",
      );
      const previewUrl = this.gateway.getPublicUrl(indexObjectPath);
      record = { ...record, previewUrl };

      emit("uploading", "Uploading site files...", 0);

      const uploads = await collectPreviewUploads(artifact, this.gateway);
      if (uploads.length === 0) {
        return this.fail(record, {
          code: "invalid_artifact",
          message: "No files found to upload for this preview.",
          retryable: false,
        });
      }

      for (let index = 0; index < uploads.length; index += 1) {
        const item = uploads[index];
        const objectPath = buildPreviewObjectPath(
          userId,
          slug,
          item.relativePath,
        );
        const ratio = (index + 1) / uploads.length;

        await withRetry(
          async () => {
            await this.gateway.uploadPreviewObject(
              objectPath,
              item.body,
              item.contentType,
            );
          },
          {
            retries: this.uploadRetries,
            baseDelayMs: 350,
            sleep: this.sleep,
            shouldRetry: isTransientDeploymentError,
          },
        );

        emit(
          "uploading",
          `Uploading site files (${index + 1}/${uploads.length})...`,
          ratio,
        );
      }

      // Write a tiny status marker the poller can also treat as readiness signal.
      const statusPath = buildPreviewObjectPath(userId, slug, "atlas-deploy.json");
      const statusBody = `${JSON.stringify(
        {
          id: deploymentId,
          status: "deploying",
          fingerprint,
          slug,
          updatedAt: this.now().toISOString(),
        },
        null,
        2,
      )}\n`;

      await withRetry(
        async () => {
          await this.gateway.uploadPreviewObject(
            statusPath,
            statusBody,
            "application/json",
          );
        },
        {
          retries: this.uploadRetries,
          baseDelayMs: 350,
          sleep: this.sleep,
        },
      );

      emit("deploying", "Verifying preview is live...");

      const ready = await this.pollUntilReady(previewUrl, (attempt) => {
        onProgress?.({
          deploymentId,
          status: "deploying",
          label: `Verifying preview is live… (${attempt})`,
          progress: Math.min(95, 75 + attempt * 3),
        });
      });

      if (!ready) {
        return this.fail(record, {
          code: "deploy_failed",
          message:
            "Preview uploaded but did not become reachable in time. Please try again.",
          retryable: true,
        });
      }

      // Finalize status marker as ready (best-effort).
      try {
        await this.gateway.uploadPreviewObject(
          statusPath,
          `${JSON.stringify(
            {
              id: deploymentId,
              status: "ready",
              fingerprint,
              slug,
              previewUrl,
              updatedAt: this.now().toISOString(),
            },
            null,
            2,
          )}\n`,
          "application/json",
        );
      } catch {
        // Non-fatal — index.html probe already succeeded.
      }

      const readyAt = this.now().toISOString();
      const readyRecord: DeploymentRecord = {
        ...record,
        status: "ready",
        previewUrl,
        updatedAt: readyAt,
        readyAt,
        error: null,
        reused: false,
      };

      onProgress?.({
        deploymentId,
        status: "ready",
        label: DEPLOYMENT_STATUS_LABELS.ready,
        progress: 100,
      });

      return { ok: true, deployment: readyRecord };
    } catch (error) {
      const transient = isTransientDeploymentError(error);
      return this.fail(record, {
        code: transient ? "upload_failed" : "provider_error",
        message:
          error instanceof Error
            ? error.message
            : "Preview deployment failed. Please try again.",
        retryable: transient,
      });
    }
  }

  /**
   * Poll the public preview URL until it responds OK or the timeout elapses.
   */
  private async pollUntilReady(
    previewUrl: string,
    onAttempt?: (attempt: number) => void,
  ): Promise<boolean> {
    const started = Date.now();
    let attempt = 0;

    while (Date.now() - started <= this.pollTimeoutMs) {
      attempt += 1;
      onAttempt?.(attempt);
      const ok = await this.gateway.probePublicUrl(previewUrl);
      if (ok) return true;
      await delay(this.pollIntervalMs, this.sleep);
    }

    return false;
  }

  private fail(
    base: DeploymentRecord,
    error: DeploymentError,
  ): DeploymentResult {
    const updatedAt = this.now().toISOString();
    const deployment: DeploymentRecord = {
      ...base,
      status: "failed",
      updatedAt,
      readyAt: null,
      error,
      reused: false,
    };
    return { ok: false, error, deployment };
  }
}
