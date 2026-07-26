/** DNS record the user must configure for domain verification. */
export type DomainDnsRecord = {
  type: "TXT" | "CNAME" | "A" | "AAAA";
  name: string;
  value: string;
  ttl?: number;
};

export type DomainType = "apex" | "subdomain";

export type ProjectDomainStatus =
  | "pending"
  | "verifying"
  | "ssl_provisioning"
  | "verified"
  | "active"
  | "failed";

/** Zero-downtime adoption of a domain already on another Vercel project. */
export type DomainMigrationState =
  | "none"
  | "detected"
  | "linked"
  | "migrated";

/** Row shape for public.project_domains. */
export type ProjectDomainRow = {
  id: string;
  project_id: string;
  owner_id: string;
  hostname: string;
  normalized_hostname: string;
  domain_type: DomainType;
  status: ProjectDomainStatus;
  verification_token: string;
  verification_method: string;
  verification_records: DomainDnsRecord[];
  provider: string;
  provider_domain_id: string | null;
  last_checked_at: string | null;
  verified_at: string | null;
  activated_at: string | null;
  failure_reason: string | null;
  linked_project_id: string | null;
  linked_project_name: string | null;
  migration_state: DomainMigrationState;
  linked_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ProjectDomainInsert = {
  id?: string;
  project_id: string;
  owner_id: string;
  hostname: string;
  normalized_hostname: string;
  domain_type: DomainType;
  status?: ProjectDomainStatus;
  verification_token: string;
  verification_method?: string;
  verification_records?: DomainDnsRecord[];
  provider?: string;
  provider_domain_id?: string | null;
  last_checked_at?: string | null;
  verified_at?: string | null;
  activated_at?: string | null;
  failure_reason?: string | null;
  linked_project_id?: string | null;
  linked_project_name?: string | null;
  migration_state?: DomainMigrationState;
  linked_at?: string | null;
};

export type ProjectDomainUpdate = {
  status?: ProjectDomainStatus;
  verification_records?: DomainDnsRecord[];
  provider?: string;
  provider_domain_id?: string | null;
  last_checked_at?: string | null;
  verified_at?: string | null;
  activated_at?: string | null;
  failure_reason?: string | null;
  linked_project_id?: string | null;
  linked_project_name?: string | null;
  migration_state?: DomainMigrationState;
  linked_at?: string | null;
};

/** App-facing domain record (camelCase). */
export type ProjectDomain = {
  id: string;
  projectId: string;
  ownerId: string;
  hostname: string;
  normalizedHostname: string;
  domainType: DomainType;
  status: ProjectDomainStatus;
  verificationToken: string;
  verificationMethod: string;
  verificationRecords: DomainDnsRecord[];
  provider: string;
  providerDomainId: string | null;
  lastCheckedAt: string | null;
  verifiedAt: string | null;
  activatedAt: string | null;
  failureReason: string | null;
  linkedProjectId: string | null;
  linkedProjectName: string | null;
  migrationState: DomainMigrationState;
  linkedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type DomainResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

/** Public existing-project detection payload (never includes tokens). */
export type ExistingVercelProjectInfo = {
  projectId: string;
  projectName: string;
  hostname: string;
  sameAccount: true;
};
