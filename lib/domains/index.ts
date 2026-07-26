export type { DomainProvider } from "@/lib/domains/provider";
export {
  mapProviderSignalsToStatus,
  shouldUseLinkedVercelProject,
  shouldDetachDomainFromProvider,
} from "@/lib/domains/provider";
export { MockDomainProvider } from "@/lib/domains/mock-provider";
export {
  normalizeAndValidateHostname,
  classifyDomainType,
} from "@/lib/domains/hostname";
export {
  createDomainProvider,
  getDomainProviderId,
  resolveProviderForDomainRow,
  type DomainProviderId,
} from "@/lib/domains/create-provider";
export { checkDomainRateLimit } from "@/lib/domains/rate-limit";
export {
  rowToProjectDomain,
  toPublicProjectDomain,
  safeDomainErrorMessage,
} from "@/lib/domains/serialize";
export {
  DOMAIN_POLL_STATUSES,
  shouldPollDomainStatus,
  resolveActiveCustomDomainUrl,
  resolvePublishSiteUrl,
} from "@/lib/domains/status";
export {
  runDomainVerification,
  hydrateMockProviderFromRow,
  finalizeVerificationStatus,
} from "@/lib/domains/verify";
export { resolveVercelDeployProjectId } from "@/lib/domains/resolve-deploy-project";
export type { ResolveVercelDeployProjectResult } from "@/lib/domains/resolve-deploy-project";
export {
  matchesProductionPublishConfirmation,
  canPublishToLinkedProduction,
  isPreviewOnlyDeployTarget,
  type DeployTarget,
} from "@/lib/domains/production-publish";
export type {
  DomainDnsRecord,
  DomainType,
  DomainMigrationState,
  ProjectDomain,
  ProjectDomainStatus,
  ProjectDomainRow,
  DomainResult,
  ExistingVercelProjectInfo,
} from "@/lib/domains/types";
