/**
 * Reject recommendations outside the owner's allowlist.
 */

import { ownerAllowsDomain } from "@/lib/scope/contracts";
import type {
  IntelligenceOwner,
  RecommendationDomain,
  ScopedRecommendationContract,
  ScopeValidationResult,
  ScopeViolation,
} from "@/lib/scope/types";

export function validateRecommendationScope(
  recommendation: ScopedRecommendationContract,
): ScopeViolation | null {
  if (ownerAllowsDomain(recommendation.owner, recommendation.domain)) {
    return null;
  }
  return {
    owner: recommendation.owner,
    requestedOperation: recommendation.title,
    violatedDomain: recommendation.domain,
    reason: `${recommendation.owner} is not allowed to recommend domain “${recommendation.domain}”.`,
  };
}

export function filterRecommendationsByScope(
  recommendations: ScopedRecommendationContract[],
): ScopeValidationResult {
  const allowed: ScopedRecommendationContract[] = [];
  const blocked: ScopedRecommendationContract[] = [];
  const violations: ScopeViolation[] = [];

  for (const rec of recommendations) {
    const violation = validateRecommendationScope(rec);
    if (violation) {
      blocked.push(rec);
      violations.push(violation);
    } else {
      allowed.push(rec);
    }
  }

  return {
    ok: violations.length === 0,
    allowed,
    blocked,
    violations,
  };
}

/** Infer domain from free-text (follow-up chips / titles) for enforcement. */
export function inferDomainFromText(
  text: string,
): RecommendationDomain | null {
  const t = text.trim().toLowerCase();
  if (/\b(animations?|motion|micro[- ]?interactions?)\b/.test(t)) return "motion";
  if (/\bfaq\b/.test(t)) return "faq";
  if (/\b(brand\s+colors?|palette|color\s+harmony)\b/.test(t)) {
    return "brand_colors";
  }
  if (/\b(font|typography\s+pairing|typeface)\b/.test(t) && !/\bhierarchy\b/.test(t)) {
    return "fonts";
  }
  if (/\b(testimonial|review\s+section)\b/.test(t)) return "testimonials";
  if (/\bgallery\b/.test(t)) return "gallery";
  if (/\b(section\s+order|reorder\s+sections)\b/.test(t)) return "section_order";
  if (/\b(pricing|price\s+list)\b/.test(t)) return "pricing";
  if (/\b(spacing|whitespace|airy)\b/.test(t)) return "spacing";
  if (/\b(hierarchy|heading)\b/.test(t)) return "typography_hierarchy";
  if (/\b(polish|consistent)\b/.test(t)) return "visual_polish";
  if (/\b(conversion|leads?|inquir)/.test(t)) return "lead_generation";
  if (/\b(hero\s+compos|prettier\s+hero|hero\s+image)\b/.test(t)) {
    return "hero_composition";
  }
  return null;
}

export function followUpAllowedForOwner(
  owner: IntelligenceOwner,
  followUp: string,
): boolean {
  const domain = inferDomainFromText(followUp);
  if (!domain) return true;
  return ownerAllowsDomain(owner, domain);
}

export function filterFollowUpsForOwner(
  owner: IntelligenceOwner,
  followUps: string[],
): { allowed: string[]; blocked: string[]; violations: ScopeViolation[] } {
  const allowed: string[] = [];
  const blocked: string[] = [];
  const violations: ScopeViolation[] = [];
  for (const chip of followUps) {
    if (followUpAllowedForOwner(owner, chip)) {
      allowed.push(chip);
    } else {
      blocked.push(chip);
      const domain = inferDomainFromText(chip) ?? "business_strategy";
      violations.push({
        owner,
        requestedOperation: chip,
        violatedDomain: domain,
        reason: `Follow-up “${chip}” is outside ${owner} ownership.`,
      });
    }
  }
  return { allowed, blocked, violations };
}

export function logScopeDiagnostics(input: {
  requestOwner: IntelligenceOwner | string;
  selectedDirector: string;
  scopeViolations: ScopeViolation[];
  blockedRecommendations: string[];
  conversionScore?: number | null;
  highestPriorityImprovement?: string | null;
  requestId?: string | null;
}): void {
  if (process.env.NODE_ENV !== "development") return;
  console.info("[atlas:scope]", {
    requestId: input.requestId ?? null,
    requestOwner: input.requestOwner,
    selectedDirector: input.selectedDirector,
    scopeViolations: input.scopeViolations,
    blockedRecommendations: input.blockedRecommendations,
    conversionScore: input.conversionScore ?? null,
    highestPriorityImprovement: input.highestPriorityImprovement ?? null,
  });
}
