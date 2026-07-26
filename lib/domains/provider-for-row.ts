import type { DomainProvider } from "@/lib/domains/provider";
import type { ProjectDomainRow } from "@/lib/domains/types";
import { shouldUseLinkedVercelProject } from "@/lib/domains/provider";
import { getVercelDeploymentConfig } from "@/lib/deployment/server-config";
import { VercelDomainProvider } from "@/lib/domains/vercel-provider";
import {
  createDomainProvider,
  resolveProviderForDomainRow,
} from "@/lib/domains/create-provider";

/**
 * Provider instance scoped to the Vercel project that owns the domain.
 * Linked domains verify/inspect against the linked project, not atlas-sites.
 */
export function createDomainProviderForRow(
  domain: ProjectDomainRow,
): DomainProvider {
  const resolved = resolveProviderForDomainRow(domain);
  if (!resolved.ok) {
    return createDomainProvider("mock");
  }

  if (
    resolved.providerId === "vercel" &&
    shouldUseLinkedVercelProject(
      domain.migration_state,
      domain.linked_project_id,
    )
  ) {
    const config = getVercelDeploymentConfig();
    return new VercelDomainProvider({
      token: config.token,
      projectId: domain.linked_project_id!.trim(),
      teamId: config.teamId,
    });
  }

  // Detected (not yet linked): inspect against the detected owner project.
  if (
    resolved.providerId === "vercel" &&
    domain.migration_state === "detected" &&
    domain.linked_project_id
  ) {
    const config = getVercelDeploymentConfig();
    return new VercelDomainProvider({
      token: config.token,
      projectId: domain.linked_project_id.trim(),
      teamId: config.teamId,
    });
  }

  return resolved.provider;
}
