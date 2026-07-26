import { redactSecrets } from "@/lib/deployment/server-config";
import type {
  DomainDnsRecord,
  DomainMigrationState,
  ProjectDomain,
  ProjectDomainRow,
} from "@/lib/domains/types";

function migrationStateOf(
  value: string | null | undefined,
): DomainMigrationState {
  switch (value) {
    case "detected":
    case "linked":
    case "migrated":
      return value;
    default:
      return "none";
  }
}

export function rowToProjectDomain(row: ProjectDomainRow): ProjectDomain {
  const records = Array.isArray(row.verification_records)
    ? (row.verification_records as DomainDnsRecord[])
    : [];

  return {
    id: row.id,
    projectId: row.project_id,
    ownerId: row.owner_id,
    hostname: row.hostname,
    normalizedHostname: row.normalized_hostname,
    domainType: row.domain_type,
    status: row.status,
    verificationToken: row.verification_token,
    verificationMethod: row.verification_method,
    verificationRecords: records,
    provider: row.provider,
    providerDomainId: row.provider_domain_id,
    lastCheckedAt: row.last_checked_at,
    verifiedAt: row.verified_at,
    activatedAt: row.activated_at,
    failureReason: row.failure_reason,
    linkedProjectId: row.linked_project_id ?? null,
    linkedProjectName: row.linked_project_name ?? null,
    migrationState: migrationStateOf(row.migration_state),
    linkedAt: row.linked_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Public JSON shape — never includes secrets. */
export function toPublicProjectDomain(domain: ProjectDomain) {
  return {
    id: domain.id,
    projectId: domain.projectId,
    hostname: domain.hostname,
    normalizedHostname: domain.normalizedHostname,
    domainType: domain.domainType,
    status: domain.status,
    verificationMethod: domain.verificationMethod,
    verificationRecords: domain.verificationRecords,
    provider: domain.provider,
    lastCheckedAt: domain.lastCheckedAt,
    verifiedAt: domain.verifiedAt,
    activatedAt: domain.activatedAt,
    failureReason: domain.failureReason,
    linkedProjectId: domain.linkedProjectId,
    linkedProjectName: domain.linkedProjectName,
    migrationState: domain.migrationState,
    linkedAt: domain.linkedAt,
    createdAt: domain.createdAt,
    updatedAt: domain.updatedAt,
    // Intentionally omit verificationToken + providerDomainId from broad clients.
  };
}

export function safeDomainErrorMessage(error: unknown): string {
  const token = process.env.VERCEL_TOKEN;
  const raw =
    error instanceof Error ? error.message : "Domain request failed.";
  const redacted = redactSecrets(raw, token);
  const lower = redacted.toLowerCase();

  if (lower.includes("duplicate") || lower.includes("unique")) {
    return "That domain is already connected to a project.";
  }
  if (lower.includes("row-level security") || lower.includes("42501")) {
    return "You don't have permission to manage domains for this project.";
  }
  if (lower.includes("not authenticated") || lower.includes("jwt")) {
    return "Please sign in and try again.";
  }
  if (lower.includes("already in use") || lower.includes("domain_already_in_use")) {
    return "That domain is already in use on another Vercel project.";
  }

  return redacted.slice(0, 280);
}
