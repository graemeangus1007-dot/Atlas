import {
  buildDeploymentId,
  buildDeploymentPreviewUrl,
} from "@/lib/deployment/ids";
import type { DeploymentProvider } from "@/lib/deployment/provider";
import { canReusePreviousPreviewUrl } from "@/lib/deployment/preview-url";
import {
  DEPLOYMENT_STATUS_LABELS,
  type DeploymentProgressEvent,
  type DeploymentRecord,
  type DeploymentRequest,
  type DeploymentResult,
  type DeploymentStatus,
} from "@/lib/deployment/types";

export type MockDeploymentFailStage = "uploading" | "deploying";

export type MockDeploymentProviderOptions = {
  /** Delay between status transitions (0 in tests). */
  stepDelayMs?: number;
  /** Inject a failure at a specific stage. */
  failAt?: MockDeploymentFailStage | null;
  /** Override clock for deterministic timestamps in tests. */
  now?: () => Date;
};

const STAGE_ORDER: Array<Exclude<DeploymentStatus, "failed">> = [
  "queued",
  "uploading",
  "deploying",
  "ready",
];

function delay(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function progressForStatus(status: DeploymentStatus): number {
  switch (status) {
    case "queued":
      return 10;
    case "uploading":
      return 40;
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
 * Local mock hosting provider.
 * Accepts a `buildStaticSite` artifact, simulates upload/deploy,
 * returns a stable deployment id + preview URL. Does not call real hosts.
 */
export class MockDeploymentProvider implements DeploymentProvider {
  readonly id = "mock-local";

  private readonly stepDelayMs: number;
  private readonly failAt: MockDeploymentFailStage | null;
  private readonly now: () => Date;

  constructor(options: MockDeploymentProviderOptions = {}) {
    this.stepDelayMs = options.stepDelayMs ?? 400;
    this.failAt = options.failAt ?? null;
    this.now = options.now ?? (() => new Date());
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
    const previewUrl = buildDeploymentPreviewUrl(slug);

    // Skip re-upload when the latest successful deploy already matches.
    if (
      !force &&
      previousDeployment &&
      previousDeployment.artifactFingerprint === fingerprint &&
      previousDeployment.id &&
      canReusePreviousPreviewUrl(
        this.id,
        previousDeployment.previewUrl || previewUrl,
        previousDeployment.provider,
      )
    ) {
      const reused: DeploymentRecord = {
        id: previousDeployment.id,
        status: "ready",
        slug,
        previewUrl: previousDeployment.previewUrl || previewUrl,
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
      previewUrl,
      artifactFingerprint: fingerprint,
      provider: this.id,
      createdAt,
      updatedAt,
      readyAt: null,
      error: null,
      reused: false,
    };

    for (const status of STAGE_ORDER) {
      updatedAt = this.now().toISOString();
      base.status = status;
      base.updatedAt = updatedAt;

      onProgress?.({
        deploymentId,
        status,
        label: DEPLOYMENT_STATUS_LABELS[status],
        progress: progressForStatus(status),
      });

      if (status === "uploading" && this.failAt === "uploading") {
        return this.fail(base, {
          code: "upload_failed",
          message: "Mock upload failed while transferring site files.",
          retryable: true,
        });
      }

      if (status === "deploying" && this.failAt === "deploying") {
        return this.fail(base, {
          code: "deploy_failed",
          message: "Mock provider failed while activating the deployment.",
          retryable: true,
        });
      }

      if (status !== "ready") {
        await delay(this.stepDelayMs);
      }
    }

    updatedAt = this.now().toISOString();
    const ready: DeploymentRecord = {
      ...base,
      status: "ready",
      updatedAt,
      readyAt: updatedAt,
      error: null,
      reused: false,
    };

    return { ok: true, deployment: ready };
  }

  private fail(
    base: DeploymentRecord,
    error: NonNullable<DeploymentRecord["error"]>,
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
