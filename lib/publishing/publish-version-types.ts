import type { PublishSnapshot } from "@/types/publishing";
import type { DeploymentStatus } from "@/lib/deployment/types";

/** Row shape for public.publish_versions (matches the SQL migration). */
export type PublishVersionRow = {
  id: string;
  project_id: string;
  owner_id: string;
  version_number: number;
  artifact_fingerprint: string;
  deployment_provider: string;
  deployment_id: string;
  preview_url: string;
  deployment_status: string;
  project_snapshot: PublishSnapshot;
  created_at: string;
};

/** List/history row without the heavy snapshot payload. */
export type PublishVersionSummaryRow = Omit<PublishVersionRow, "project_snapshot">;

/** Fields accepted when inserting a publish version row. */
export type PublishVersionInsert = {
  id?: string;
  project_id: string;
  owner_id: string;
  /** Optional — DB trigger assigns next per-project number when omitted/0. */
  version_number?: number;
  artifact_fingerprint: string;
  deployment_provider: string;
  deployment_id: string;
  preview_url: string;
  deployment_status: DeploymentStatus | string;
  project_snapshot: PublishSnapshot;
  created_at?: string;
};

/** History list item (no snapshot — lazy-loaded on restore). */
export type PublishVersionSummary = {
  id: string;
  projectId: string;
  ownerId: string;
  versionNumber: number;
  artifactFingerprint: string;
  deploymentProvider: string;
  deploymentId: string;
  previewUrl: string;
  deploymentStatus: DeploymentStatus | string;
  createdAt: string;
};

/** Full version including snapshot (restore / create response). */
export type PublishVersion = PublishVersionSummary & {
  projectSnapshot: PublishSnapshot;
};

/** Input for creating a version after a ready deployment. */
export type CreatePublishVersionInput = {
  projectId: string;
  artifactFingerprint: string;
  deploymentProvider: string;
  deploymentId: string;
  previewUrl: string;
  deploymentStatus: DeploymentStatus | string;
  projectSnapshot: PublishSnapshot;
};

export type PublishVersionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export type PublishVersionPage = {
  items: PublishVersionSummary[];
  /** Next offset for pagination, or null when exhausted. */
  nextOffset: number | null;
  /** Highest version number for the project (current live badge). */
  latestVersionNumber: number | null;
};

/** Default page size for Version History UI. */
export const PUBLISH_VERSION_PAGE_SIZE = 25;
