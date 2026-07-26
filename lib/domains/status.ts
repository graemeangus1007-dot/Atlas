import type { ProjectDomainStatus } from "@/lib/domains/types";

/** Statuses that should keep polling while the Publish panel is open. */
export const DOMAIN_POLL_STATUSES: ProjectDomainStatus[] = [
  "pending",
  "verifying",
  "ssl_provisioning",
  // Legacy synonym kept for rows not yet backfilled to ssl_provisioning.
  "verified",
];

export function shouldPollDomainStatus(
  status: ProjectDomainStatus | string,
  migrationState?: string | null,
): boolean {
  // Wait for Link Project confirmation — do not spam verify.
  if (migrationState === "detected") return false;
  return DOMAIN_POLL_STATUSES.includes(status as ProjectDomainStatus);
}

/**
 * Public site URL for an active custom domain.
 * Preview deployments continue to use the provider preview URL separately.
 */
export function resolveActiveCustomDomainUrl(
  hostname: string | null | undefined,
): string | null {
  if (!hostname?.trim()) return null;
  const host = hostname.trim().toLowerCase().replace(/\.+$/, "");
  if (!host) return null;
  return `https://${host}`;
}

/**
 * Prefer the active custom domain for the published site URL.
 * Keep deployment.previewUrl as the hosting preview (.vercel.app).
 */
export function resolvePublishSiteUrl(input: {
  deploymentPreviewUrl: string;
  activeCustomHostname?: string | null;
}): string {
  return (
    resolveActiveCustomDomainUrl(input.activeCustomHostname) ||
    input.deploymentPreviewUrl
  );
}
