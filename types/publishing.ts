import type { BusinessProject } from "@/types/business-project";
import type { PublishArtifact } from "@/lib/publishing/types";
import type { TemplateId } from "@/lib/templates/types";
import type {
  DeploymentRecord,
  DeploymentStatus,
} from "@/lib/deployment/types";

/**
 * Frozen project state captured at publish time.
 * Stored with `publish: null` to avoid recursive publish records.
 */
export type PublishSnapshot = BusinessProject;

/** High-level publish pipeline stages shown in the publish modal. */
export type PublishStepId =
  | "preparing"
  | "building"
  | "queued"
  | "uploading"
  | "deploying"
  | "ready";

export type PublishStep = {
  id: PublishStepId;
  label: string;
};

/** Progress event emitted while building + deploying. */
export type PublishProgressEvent = {
  step: PublishStepId;
  label: string;
  /** Overall progress 0–100. */
  progress: number;
  deploymentStatus?: DeploymentStatus;
  deploymentId?: string;
};

/**
 * Result of a successful publish (in-memory).
 * Includes the full static artifact for the deploy step only — not persisted.
 */
export type PublishResult = {
  slug: string;
  url: string;
  publishedAt: string;
  snapshot: PublishSnapshot;
  /** Static site files — used for deploy, never stored on the project. */
  artifact: PublishArtifact;
  /** Provider deployment metadata (no HTML payloads). */
  deployment: DeploymentRecord;
};

/**
 * Persisted publish metadata on BusinessProject.
 * Omits full HTML/CSS payloads (too large for project jsonb).
 */
export type PublishRecord = {
  slug: string;
  url: string;
  publishedAt: string;
  snapshot: PublishSnapshot;
  /** Deterministic fingerprint from the last static build. */
  artifactFingerprint?: string;
  templateId?: TemplateId;
  /**
   * Slim deployment record from the hosting provider.
   * Never includes generated file bodies.
   */
  deployment?: PersistedDeploymentRecord;
};

/** Deployment fields safe to persist on the project (no artifact files). */
export type PersistedDeploymentRecord = {
  id: string;
  status: DeploymentStatus;
  previewUrl: string;
  artifactFingerprint: string;
  provider: string;
  createdAt: string;
  updatedAt: string;
  readyAt: string | null;
};

/** Ordered publish pipeline steps (build + deploy). */
export const PUBLISH_STEPS: PublishStep[] = [
  { id: "preparing", label: "Preparing website..." },
  { id: "building", label: "Building static site..." },
  { id: "queued", label: "Queued for deployment..." },
  { id: "uploading", label: "Uploading site files..." },
  { id: "deploying", label: "Deploying website..." },
  { id: "ready", label: "Deployment ready" },
];

export function toPersistedDeployment(
  deployment: DeploymentRecord,
): PersistedDeploymentRecord {
  return {
    id: deployment.id,
    status: deployment.status,
    previewUrl: deployment.previewUrl,
    artifactFingerprint: deployment.artifactFingerprint,
    provider: deployment.provider,
    createdAt: deployment.createdAt,
    updatedAt: deployment.updatedAt,
    readyAt: deployment.readyAt,
  };
}

/** Strip bulky artifact files before persisting on the project. */
export function toPublishRecord(result: PublishResult): PublishRecord {
  const previewUrl = result.deployment.previewUrl || result.url;
  return {
    slug: result.slug,
    // Top-level url mirrors the provider preview URL (never invent a host).
    url: previewUrl,
    publishedAt: result.publishedAt,
    snapshot: result.snapshot,
    artifactFingerprint: result.artifact.fingerprint,
    templateId: result.artifact.templateId,
    deployment: toPersistedDeployment(result.deployment),
  };
}
