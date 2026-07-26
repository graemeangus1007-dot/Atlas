import type { DeploymentRecord } from "@/lib/deployment/types";
import type { PublishResult } from "@/types/publishing";
import {
  createPublishVersion,
  getLatestPublishVersion,
  type PublishVersionsGateway,
} from "@/lib/supabase/publish-versions";
import type {
  PublishVersion,
  PublishVersionSummary,
} from "@/lib/publishing/publish-version-types";

export type RecordPublishVersionOutcome =
  | { status: "created"; version: PublishVersion }
  /** Dedupe reuse — loaded the latest existing history row for display. */
  | { status: "existing"; version: PublishVersionSummary }
  /** No new row and nothing to display (legacy reuse with empty history). */
  | { status: "skipped"; reason: "reused_deployment" | "missing_project_id" }
  | { status: "failed"; warning: string };

/**
 * Fingerprint dedupe (reused ready deploy) must not create a history row.
 * Force Redeploy and any real new ready deployment must.
 */
export function shouldCreatePublishVersion(
  deployment: DeploymentRecord,
): boolean {
  return deployment.status === "ready" && !deployment.reused;
}

/**
 * Persist an immutable publish version after a deployment reaches ready,
 * or resolve the latest existing version when the deploy was deduped.
 * Safe to call from the publish UI — never throws; returns a warning on failure.
 */
export async function recordPublishVersionAfterDeploy(input: {
  projectId: string | null | undefined;
  result: PublishResult;
  gateway?: PublishVersionsGateway;
}): Promise<RecordPublishVersionOutcome> {
  const { result, projectId, gateway } = input;
  const { deployment } = result;

  if (!projectId) {
    return { status: "skipped", reason: "missing_project_id" };
  }

  // Fingerprint unchanged — keep showing the latest saved version (if any).
  if (!shouldCreatePublishVersion(deployment)) {
    const latest = await getLatestPublishVersion(projectId, gateway);
    if (latest.ok && latest.data) {
      return { status: "existing", version: latest.data };
    }
    // Legacy reused deploy with no history — do not invent a version number.
    return { status: "skipped", reason: "reused_deployment" };
  }

  if (deployment.status !== "ready") {
    return {
      status: "failed",
      warning:
        "Publish history was not saved because the deployment is not ready.",
    };
  }

  const created = await createPublishVersion(
    {
      projectId,
      artifactFingerprint: deployment.artifactFingerprint,
      deploymentProvider: deployment.provider,
      deploymentId: deployment.id,
      previewUrl: deployment.previewUrl || result.url,
      deploymentStatus: deployment.status,
      projectSnapshot: result.snapshot,
    },
    gateway,
  );

  if (!created.ok) {
    return {
      status: "failed",
      warning:
        `Website deployed, but publish history could not be saved. ${created.error} ` +
        "You can publish again later to retry saving history.",
    };
  }

  return { status: "created", version: created.data };
}
