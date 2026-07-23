import type { BusinessProject } from "@/types/business-project";
import type { PublishSnapshot } from "@/types/publishing";

/**
 * Freeze the current project for the published (read-only) site.
 * Edits after publish do not affect the live preview until Publish Again.
 */
export function createPublishSnapshot(
  project: BusinessProject,
): PublishSnapshot {
  return structuredClone({
    ...project,
    publish: null,
  });
}
