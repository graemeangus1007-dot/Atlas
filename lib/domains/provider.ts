import type {
  DomainDnsRecord,
  DomainMigrationState,
  ProjectDomainStatus,
} from "@/lib/domains/types";

/**
 * Provider-agnostic custom domain contract.
 * All implementations that call external APIs must stay server-only.
 */
export type DomainProviderCreatedResult = {
  kind: "created";
  providerDomainId: string;
  verificationToken: string;
  verificationMethod: string;
  verificationRecords: DomainDnsRecord[];
};

/**
 * Domain already attached to another project in the same Vercel account/team.
 * Atlas must not remove it — offer zero-downtime linking instead.
 */
export type DomainProviderExistingProjectResult = {
  kind: "existing_project";
  hostname: string;
  linkedProjectId: string;
  linkedProjectName: string;
  providerDomainId: string;
  verificationToken: string;
  verificationMethod: string;
  verificationRecords: DomainDnsRecord[];
  ownershipVerified: boolean;
  sslReady: boolean;
  serving: boolean;
};

export type DomainProviderAddResult =
  | DomainProviderCreatedResult
  | DomainProviderExistingProjectResult;

export type DomainProviderInspectResult = {
  providerDomainId: string;
  hostname: string;
  /** Ownership / project verification challenge completed. */
  ownershipVerified: boolean;
  /** Certificate / config ready (not the same as ownership). */
  sslReady: boolean;
  /** Provider reports the domain is correctly configured / serving. */
  serving: boolean;
  verificationRecords: DomainDnsRecord[];
  rawStatus?: string;
  misconfigured?: boolean;
};

export type DomainProviderVerifyResult = {
  ownershipVerified: boolean;
  sslReady: boolean;
  serving: boolean;
  verificationRecords: DomainDnsRecord[];
  failureReason?: string | null;
  /** Suggested Atlas status after this check. */
  suggestedStatus: ProjectDomainStatus;
};

export type DomainProviderProjectMeta = {
  projectId: string;
  projectName: string;
  /** True when GET project succeeded with the configured token/team. */
  accessible: boolean;
};

export interface DomainProvider {
  readonly id: string;

  addDomain(hostname: string): Promise<DomainProviderAddResult>;

  /** Alias for {@link inspectDomain} (official naming). */
  getDomain(providerDomainId: string): Promise<DomainProviderInspectResult>;

  inspectDomain(providerDomainId: string): Promise<DomainProviderInspectResult>;

  getVerificationRecords(
    providerDomainId: string,
  ): Promise<DomainDnsRecord[]>;

  /**
   * Trigger provider verification and inspect SSL/serving readiness.
   * Ownership verified ≠ SSL ready ≠ Active.
   */
  verifyDomain(providerDomainId: string): Promise<DomainProviderVerifyResult>;

  removeDomain(providerDomainId: string): Promise<void>;

  /**
   * Fetch project metadata if it belongs to the configured Vercel account/team.
   * Returns accessible:false when outside the account (never throws secrets).
   */
  getProject?(projectId: string): Promise<DomainProviderProjectMeta>;

  /**
   * Confirm a hostname is still attached to a same-account project.
   * Used during Link Project — never trusts the browser for ownership.
   */
  confirmDomainOnProject?(input: {
    projectId: string;
    hostname: string;
  }): Promise<DomainProviderInspectResult | null>;
}

/** Map provider signals → Atlas domain status. */
export function mapProviderSignalsToStatus(signals: {
  ownershipVerified: boolean;
  sslReady: boolean;
  serving: boolean;
  hardFailure?: boolean;
  failureReason?: string | null;
}): ProjectDomainStatus {
  if (signals.hardFailure) return "failed";
  if (signals.ownershipVerified && signals.sslReady && signals.serving) {
    return "active";
  }
  if (signals.ownershipVerified) {
    return "ssl_provisioning";
  }
  if (signals.failureReason) return "failed";
  return "pending";
}

/**
 * Whether a domain row is linked to an existing Vercel project (domain ops).
 * Does NOT mean normal Publish should deploy there — use explicit production
 * cutover via {@link resolveVercelDeployProjectId} with target=production.
 */
export function shouldUseLinkedVercelProject(
  migrationState: DomainMigrationState | string | null | undefined,
  linkedProjectId: string | null | undefined,
): boolean {
  if (!linkedProjectId?.trim()) return false;
  return migrationState === "linked" || migrationState === "migrated";
}

/** Never detach a production domain from Vercel when Atlas only linked it. */
export function shouldDetachDomainFromProvider(
  migrationState: DomainMigrationState | string | null | undefined,
): boolean {
  return (
    migrationState !== "detected" &&
    migrationState !== "linked" &&
    migrationState !== "migrated"
  );
}
