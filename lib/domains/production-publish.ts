import type { DomainMigrationState } from "@/lib/domains/types";
import { shouldUseLinkedVercelProject } from "@/lib/domains/provider";

export type DeployTarget = "preview" | "production";

/**
 * Typed confirmation for production cutover.
 * Accepts the custom domain hostname or the linked Vercel project name.
 */
export function matchesProductionPublishConfirmation(input: {
  confirmation: string;
  hostname: string | null | undefined;
  /** Optional alternate hostname form (e.g. normalized). */
  normalizedHostname?: string | null | undefined;
  linkedProjectName: string | null | undefined;
}): boolean {
  const typed = input.confirmation.trim().toLowerCase();
  if (!typed) return false;

  const candidates = [
    input.hostname,
    input.normalizedHostname,
    input.linkedProjectName,
  ]
    .map((value) => value?.trim().toLowerCase())
    .filter((value): value is string => Boolean(value));

  return candidates.includes(typed);
}

/** Linked production project exists and may receive an explicit cutover deploy. */
export function canPublishToLinkedProduction(
  migrationState: DomainMigrationState | string | null | undefined,
  linkedProjectId: string | null | undefined,
): boolean {
  return shouldUseLinkedVercelProject(migrationState, linkedProjectId);
}

/**
 * Normal Publish / Force Redeploy must never target a linked production project.
 */
export function isPreviewOnlyDeployTarget(
  target: DeployTarget | string | null | undefined,
): boolean {
  return target !== "production";
}
