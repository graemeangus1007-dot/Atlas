import type { DomainProvider } from "@/lib/domains/provider";
import {
  MockDomainProvider,
  type MockVerifyScenario,
} from "@/lib/domains/mock-provider";
import type {
  DomainDnsRecord,
  ProjectDomain,
  ProjectDomainRow,
  ProjectDomainStatus,
} from "@/lib/domains/types";
import { rowToProjectDomain } from "@/lib/domains/serialize";

// Re-export client-safe helpers for server callers.
export {
  DOMAIN_POLL_STATUSES,
  shouldPollDomainStatus,
  resolveActiveCustomDomainUrl,
  resolvePublishSiteUrl,
} from "@/lib/domains/status";

const MOCK_SCENARIOS = new Set<MockVerifyScenario>([
  "pending",
  "fail",
  "ssl_pending",
  "active",
]);

const DEFAULT_UNVERIFIED_REASON =
  "Domain ownership is not verified yet. Confirm the DNS records and try again.";

/**
 * Mock provider is in-memory — rehydrate from the DB row before verify/remove.
 * Scenario can be forced via MOCK_DOMAIN_VERIFY_SCENARIO for local testing.
 */
export function hydrateMockProviderFromRow(
  provider: DomainProvider,
  domain: ProjectDomainRow,
): void {
  if (!(provider instanceof MockDomainProvider)) return;
  if (!domain.provider_domain_id) return;

  const raw = process.env.MOCK_DOMAIN_VERIFY_SCENARIO?.trim().toLowerCase();
  const scenario: MockVerifyScenario =
    raw && MOCK_SCENARIOS.has(raw as MockVerifyScenario)
      ? (raw as MockVerifyScenario)
      : "pending";

  const records = Array.isArray(domain.verification_records)
    ? (domain.verification_records as DomainDnsRecord[])
    : [];

  provider.seedDomain({
    providerDomainId: domain.provider_domain_id,
    hostname: domain.normalized_hostname || domain.hostname,
    verificationToken: domain.verification_token,
    verificationRecords: records,
    scenario,
  });
}

export type VerifyDomainPersistence = {
  updateDomain(
    id: string,
    patch: {
      status: ProjectDomainStatus;
      verification_records?: ProjectDomainRow["verification_records"];
      last_checked_at: string;
      verified_at?: string | null;
      activated_at?: string | null;
      failure_reason?: string | null;
    },
  ): Promise<ProjectDomainRow>;
};

/**
 * After an explicit verify attempt, ownership must not remain soft "pending".
 * Unverified DNS → failed + friendly reason so the UI can leave Pending DNS.
 */
export function finalizeVerificationStatus(result: {
  ownershipVerified: boolean;
  suggestedStatus: ProjectDomainStatus;
  failureReason?: string | null;
}): {
  status: ProjectDomainStatus;
  failureReason: string | null;
} {
  if (result.ownershipVerified) {
    return {
      status: result.suggestedStatus,
      failureReason:
        result.suggestedStatus === "failed"
          ? result.failureReason ?? DEFAULT_UNVERIFIED_REASON
          : null,
    };
  }

  return {
    status: "failed",
    failureReason: result.failureReason?.trim() || DEFAULT_UNVERIFIED_REASON,
  };
}

/**
 * Run provider verification and map results onto a domain row patch.
 */
export async function runDomainVerification(input: {
  domain: ProjectDomainRow;
  provider: DomainProvider;
  now?: () => Date;
  persistence: VerifyDomainPersistence;
}): Promise<ProjectDomain> {
  const now = input.now ?? (() => new Date());
  const checkedAt = now().toISOString();
  const providerDomainId = input.domain.provider_domain_id;

  if (!providerDomainId) {
    const failed = await input.persistence.updateDomain(input.domain.id, {
      status: "failed",
      last_checked_at: checkedAt,
      failure_reason: "Domain is missing a provider reference.",
    });
    return rowToProjectDomain(failed);
  }

  // Mock is per-request in-memory; skip if already seeded (e.g. unit tests).
  hydrateMockProviderFromRow(input.provider, input.domain);

  // Mark verifying while the provider check runs.
  await input.persistence.updateDomain(input.domain.id, {
    status: "verifying",
    last_checked_at: checkedAt,
    failure_reason: null,
  });

  const result = await input.provider.verifyDomain(providerDomainId);
  const finalized = finalizeVerificationStatus(result);
  const status = finalized.status;

  const verifiedAt = result.ownershipVerified
    ? input.domain.verified_at ?? checkedAt
    : null;
  const activatedAt =
    status === "active"
      ? input.domain.activated_at ?? checkedAt
      : status === "failed" || status === "pending"
        ? null
        : input.domain.activated_at;

  // Redacted operational log — never includes tokens.
  console.info("[domains.verify]", {
    domainId: input.domain.id,
    hostname: input.domain.normalized_hostname || input.domain.hostname,
    provider: input.provider.id,
    ownershipVerified: result.ownershipVerified,
    sslReady: result.sslReady,
    serving: result.serving,
    suggestedStatus: result.suggestedStatus,
    finalStatus: status,
    failureReason: finalized.failureReason
      ? finalized.failureReason.slice(0, 200)
      : null,
  });

  const updated = await input.persistence.updateDomain(input.domain.id, {
    status,
    verification_records: result.verificationRecords,
    last_checked_at: checkedAt,
    verified_at: verifiedAt,
    activated_at: status === "active" ? activatedAt : null,
    failure_reason: status === "failed" ? finalized.failureReason : null,
  });

  return rowToProjectDomain(updated);
}
