import type { BusinessProject } from "@/types/business-project";
import type { PublishSnapshot } from "@/types/publishing";
import type {
  PublishVersion,
  PublishVersionSummary,
} from "@/lib/publishing/publish-version-types";
import {
  getPublishVersion,
  type PublishVersionsGateway,
} from "@/lib/supabase/publish-versions";

export type RestorePublishVersionResult =
  | {
      ok: true;
      version: PublishVersion;
      restoredProject: BusinessProject;
    }
  | { ok: false; error: string };

/**
 * Current live version = highest version number (newest publish).
 * Restore is disabled for that row.
 */
export function isCurrentPublishVersion(
  version: Pick<PublishVersionSummary, "versionNumber">,
  latestVersionNumber: number | null,
): boolean {
  return (
    latestVersionNumber != null && version.versionNumber === latestVersionNumber
  );
}

/**
 * Merge a historical snapshot into the editor project.
 * Keeps live publish metadata + ownership context; marks unpublished changes.
 */
export function buildRestoredProject(
  current: BusinessProject,
  snapshot: PublishSnapshot,
): BusinessProject {
  const restored = structuredClone(snapshot);
  return {
    ...restored,
    // Live site stays on the last successful publish until they Publish again.
    publish: current.publish,
    // Not a publish — editor diverges from live; user must Publish again.
    status: "ready",
  };
}

/**
 * Load a version snapshot (lazy) and build the restored editor project.
 * Does not mutate history rows. Caller applies setProject + saveNow.
 */
export async function restorePublishVersion(input: {
  projectId: string;
  versionId: string;
  currentProject: BusinessProject;
  latestVersionNumber?: number | null;
  gateway?: PublishVersionsGateway;
}): Promise<RestorePublishVersionResult> {
  const {
    projectId,
    versionId,
    currentProject,
    latestVersionNumber = null,
    gateway,
  } = input;

  const fetched = await getPublishVersion(versionId, gateway);
  if (!fetched.ok) {
    return { ok: false, error: fetched.error };
  }
  if (!fetched.data) {
    return { ok: false, error: "That publish version could not be found." };
  }

  const version = fetched.data;
  if (version.projectId !== projectId) {
    return {
      ok: false,
      error: "You don't have permission to restore this publish version.",
    };
  }

  if (isCurrentPublishVersion(version, latestVersionNumber)) {
    return {
      ok: false,
      error: "This is already the current published version.",
    };
  }

  if (!version.projectSnapshot) {
    return {
      ok: false,
      error: "This version has no project snapshot to restore.",
    };
  }

  const restoredProject = buildRestoredProject(
    currentProject,
    version.projectSnapshot,
  );

  return { ok: true, version, restoredProject };
}
