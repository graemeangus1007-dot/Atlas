export {
  SCOPE_ENFORCEMENT_VERSION,
  type IntelligenceOwner,
  type RecommendationDomain,
  type ScopeViolation,
  type ScopedRecommendationContract,
  type ScopeValidationResult,
} from "@/lib/scope/types";

export {
  TASTE_ALLOWED_DOMAINS,
  TASTE_FORBIDDEN_DOMAINS,
  CREATIVE_DIRECTOR_ALLOWED_DOMAINS,
  CREATIVE_DIRECTOR_FORBIDDEN_DOMAINS,
  CONVERSION_DIRECTOR_ALLOWED_DOMAINS,
  CONVERSION_DIRECTOR_FORBIDDEN_DOMAINS,
  ownerAllowsDomain,
  domainsForOwner,
} from "@/lib/scope/contracts";

export {
  validateRecommendationScope,
  filterRecommendationsByScope,
  inferDomainFromText,
  followUpAllowedForOwner,
  filterFollowUpsForOwner,
  logScopeDiagnostics,
} from "@/lib/scope/validator";
