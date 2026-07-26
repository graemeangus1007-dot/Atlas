import type { PublishArtifact } from "@/lib/publishing/types";

/** Lifecycle of a deployment through a hosting provider. */
export type DeploymentStatus =
  | "queued"
  | "uploading"
  | "deploying"
  | "ready"
  | "failed";

export type DeploymentErrorCode =
  | "duplicate_fingerprint"
  | "upload_failed"
  | "deploy_failed"
  | "invalid_artifact"
  | "provider_error";

export type DeploymentError = {
  code: DeploymentErrorCode;
  message: string;
  /** Whether the client should offer retry. */
  retryable: boolean;
};

/**
 * Slim record of a prior successful deployment (no HTML payloads).
 * Used for duplicate-fingerprint short-circuiting.
 */
export type PreviousDeploymentRef = {
  id: string;
  previewUrl: string;
  artifactFingerprint: string;
  /** Provider that produced the prior deploy (`vercel`, `supabase-preview`, …). */
  provider?: string;
  createdAt: string;
  readyAt: string | null;
  updatedAt: string;
};

/** Input to {@link DeploymentProvider.deploy}. */
export type DeploymentRequest = {
  /** Optional Atlas project id for provider metadata. */
  projectId?: string | null;
  /**
   * Server-resolved Vercel project id override.
   * Never accepted from the browser — set only by the deploy API.
   */
  vercelProjectId?: string | null;
  slug: string;
  artifact: PublishArtifact;
  /** Latest successful deployment — used to skip duplicate fingerprints. */
  previousDeployment?: PreviousDeploymentRef | null;
  /** When true, redeploy even if the fingerprint matches (always preview host). */
  force?: boolean;
  /** preview (default) or production cutover — server validates confirmation. */
  deployTarget?: "preview" | "production";
  /** Typed confirmation for production cutover. */
  productionConfirmation?: string | null;
};

/**
 * Persisted / returned deployment metadata.
 * Never includes generated HTML or CSS file bodies.
 */
export type DeploymentRecord = {
  id: string;
  status: DeploymentStatus;
  slug: string;
  /** Public preview URL returned by the provider. */
  previewUrl: string;
  artifactFingerprint: string;
  /** Provider id, e.g. `mock-local`. */
  provider: string;
  createdAt: string;
  updatedAt: string;
  readyAt: string | null;
  error: DeploymentError | null;
  /** True when an existing ready deployment was reused (duplicate fingerprint). */
  reused?: boolean;
};

export type DeploymentResult =
  | { ok: true; deployment: DeploymentRecord }
  | {
      ok: false;
      error: DeploymentError;
      deployment?: DeploymentRecord;
    };

/** Progress event while a provider simulates / runs deploy stages. */
export type DeploymentProgressEvent = {
  deploymentId: string;
  status: DeploymentStatus;
  label: string;
  /** Overall progress 0–100. */
  progress: number;
};

/** Ordered status stages for UI (excludes terminal `failed`). */
export const DEPLOYMENT_PROGRESS_STATUSES: DeploymentStatus[] = [
  "queued",
  "uploading",
  "deploying",
  "ready",
];

export const DEPLOYMENT_STATUS_LABELS: Record<DeploymentStatus, string> = {
  queued: "Queued for deployment...",
  uploading: "Uploading site files...",
  deploying: "Deploying website...",
  ready: "Deployment ready",
  failed: "Deployment failed",
};
