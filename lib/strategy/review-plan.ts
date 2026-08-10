/**
 * Review ↔ Strategic consistency — one strategic truth, two authorization modes.
 * Review presents the plan; Complete / Apply All execute it.
 */

import type { CreativeDirectorRecommendation } from "@/lib/ai/creative-director-types";
import type { AtlasStoredRecommendation } from "@/lib/ai/atlas-action-memory";
import type { EditOperation } from "@/lib/ai/edit-operations";
import type { ImageOperation } from "@/lib/ai/image-operations";
import type {
  StrategicAssessment,
  StrategicOpportunity,
  StrategicOpportunityId,
} from "@/lib/strategy/types";
import type { BusinessProject } from "@/types/business-project";

export type RecommendationDisposition =
  | "applyable"
  | "applied"
  | "already_satisfied"
  | "blocked_missing_input"
  | "blocked_unsupported"
  | "blocked_conflict"
  | "deferred_dependency"
  | "failed_verification"
  | "blocked_post_completion_churn"
  | "stale_reassess_required";

export type ReviewPlanSnapshot = {
  reviewPlanId: string;
  projectRevision: string;
  createdAt: string;
  strategicAssessmentId: string;
  highestPriorityOpportunityId: StrategicOpportunityId | null;
  highestPriorityTitle: string | null;
  recommendedLeader: StrategicAssessment["recommendedLeader"];
  dependencyOrder: string[];
  recommendationIds: string[];
  /** Compact strategic summary for stale checks / diagnostics. */
  websiteState: StrategicAssessment["websiteState"];
  postCompletionEvidence: boolean;
};

export type EnrichedReviewRecommendation = CreativeDirectorRecommendation & {
  owner: string;
  domain: string;
  objective: string;
  strategicRank: number;
  deferred: boolean;
  deferredReason?: string;
};

export type RecommendationExecutionTrace = {
  recommendationId: string;
  title: string;
  owner: string;
  domain: string;
  objective: string;
  disposition: RecommendationDisposition;
  mappedOperations: string[];
  expectedDimensions: string[];
  actualMutationDomains: string[];
  verificationResult: string;
  reason?: string;
};

/** Deterministic project revision for stale-plan detection. */
export function projectRevisionFromFingerprint(fingerprint: string): string {
  return `rev-${fingerprint.slice(0, 24)}`;
}

export function strategicAssessmentId(assessment: StrategicAssessment): string {
  const top = assessment.highestPriorityOpportunity?.id ?? "none";
  return `sa-${assessment.assessedAt.replace(/[:.]/g, "").slice(0, 18)}-${top}`;
}

export function reviewPlanId(snapshotParts: {
  projectRevision: string;
  createdAt: string;
}): string {
  return `rp-${snapshotParts.createdAt.replace(/[:.]/g, "").slice(0, 18)}-${snapshotParts.projectRevision.slice(0, 12)}`;
}

/** Infer strategic domain from recommendation title/kind/explanation. */
export function inferRecommendationDomain(rec: {
  title: string;
  kind: string;
  explanation?: string;
}): string {
  const title = rec.title.toLowerCase();
  const explanation = (rec.explanation ?? "").toLowerCase();
  const kind = (rec.kind ?? "").toLowerCase();
  // Title-first: explanations often say "trust the brand" / "previews" and must not
  // steal domain from the recommendation's actual objective.
  if (
    /landscape-led|premium\s+direction|visual direction|design direction|narrative/.test(
      title,
    )
  ) {
    return "narrative";
  }
  if (/\bseo\b|metadata|meta description|search & preview/.test(title)) {
    return "seo";
  }
  if (
    /cta|call to action|primary action|unmistakable|next step/.test(title)
  ) {
    return "cta";
  }
  if (/\b(trust|testimonial|proof)\b/.test(title)) return "trust";
  if (/contact|form|phone|lead/.test(title)) return "contact_flow";
  if (/hero message|hero copy|headline|messaging/.test(title)) {
    return "copy_strategy";
  }
  if (/hero|composition|photograph|image height|blur/.test(title)) {
    return "hero_composition";
  }
  if (/spacing|whitespace|airy|rhythm/.test(title)) return "spacing";
  if (/polish|restraint|finishing|consistent/.test(title)) {
    return "visual_polish";
  }
  if (/motion|animation|micro/.test(title)) return "motion";
  if (/font|typography|typeface/.test(title)) return "typography_hierarchy";
  if (/color|palette|brand/.test(title)) return "brand_colors";
  if (/layout|section order|structure|move proof/.test(title)) return "layout";

  // Explanation fallback — word boundaries so "previews" ≠ "review".
  const hay = `${explanation} ${kind}`;
  if (/cta|call to action|primary action|next step/.test(hay)) return "cta";
  if (/\b(trust|testimonial|reviews?|proof|credib)/.test(hay)) return "trust";
  if (/contact|form|phone|lead/.test(hay)) return "contact_flow";
  if (/narrative|story|landscape-led|premium\s+direction/.test(hay)) {
    return "narrative";
  }
  if (/\bseo\b|metadata/.test(hay)) return "seo";
  if (/layout|section order|structure/.test(hay)) return "layout";
  if (rec.kind === "conversion") return "cta";
  if (rec.kind === "motion") return "motion";
  if (rec.kind === "brand") return "brand_colors";
  if (rec.kind === "content") return "copy_strategy";
  return "visual_direction";
}

export function inferRecommendationOwner(domain: string): string {
  switch (domain) {
    case "cta":
    case "trust":
    case "proof":
    case "contact_flow":
    case "lead_generation":
    case "offer":
    case "friction":
    case "urgency":
    case "objections":
      return "conversion_director";
    case "spacing":
    case "visual_polish":
    case "typography_hierarchy":
    case "restraint":
    case "cta_proportion":
      return "taste";
    case "hero_composition":
      return "visual_composition";
    case "motion":
      return "creative_director";
    case "narrative":
    case "layout":
    case "visual_direction":
    case "section_sequencing":
      return "creative_director";
    case "brand_colors":
    case "palette":
      return "creative_director";
    default:
      return "creative_director";
  }
}

/** Mutation domains touched by edit/image operations. */
export function mutationDomainsFromOperations(
  operations: Array<EditOperation | ImageOperation>,
): string[] {
  const domains = new Set<string>();
  for (const op of operations) {
    const kind = String(op.operation);
    const record = op as Record<string, unknown>;
    if (kind === "updateSeo") {
      domains.add("seo");
    } else if (kind === "replaceText") {
      const target = String(record.target ?? "");
      if (/cta|Cta/i.test(target)) domains.add("cta");
      else if (/title|headline|subheadline|about|service/i.test(target)) {
        domains.add("copy_strategy");
      } else {
        domains.add("copy_strategy");
      }
    } else if (kind === "insertSection" || kind === "moveSection") {
      const section = String(
        record.sectionType ?? record.section ?? "",
      ).toLowerCase();
      if (/testimonial|proof|review/.test(section)) domains.add("trust");
      domains.add("layout");
    } else if (/cta|Cta|contact|Contact|booking|Booking|formEnabled/i.test(kind)) {
      domains.add("cta");
      domains.add("contact_flow");
    } else if (kind === "setCreativePolish") {
      const polish = op as {
        spacing?: string;
        visualHierarchy?: boolean;
        motion?: boolean;
        hoverEffects?: boolean;
        sectionReveal?: boolean;
        motionPreset?: string;
        contactFormEnabled?: boolean;
      };
      if (polish.contactFormEnabled) {
        domains.add("cta");
        domains.add("contact_flow");
      }
      if (polish.spacing) domains.add("spacing");
      if (polish.visualHierarchy) {
        domains.add("typography_hierarchy");
        domains.add("visual_polish");
      }
      if (
        polish.motion != null ||
        polish.hoverEffects != null ||
        polish.sectionReveal != null ||
        polish.motionPreset
      ) {
        domains.add("motion");
      }
      if (
        !polish.spacing &&
        !polish.visualHierarchy &&
        polish.motion == null &&
        !polish.motionPreset &&
        !polish.contactFormEnabled
      ) {
        domains.add("visual_polish");
      }
    } else if (
      kind === "setTypography" ||
      kind === "setButtonStyle" ||
      /Font|font/.test(kind)
    ) {
      domains.add("typography_hierarchy");
    } else if (/Color|color|Theme|theme/.test(kind)) {
      domains.add("brand_colors");
    } else if (
      kind === "setHeroOverlay" ||
      kind === "setHeroTreatment" ||
      kind === "setHeroImagePresentation" ||
      /HeroComposition|heroComposition/.test(kind)
    ) {
      domains.add("hero_composition");
    } else if (/[Tt]estimonial|[Pp]roof/.test(kind)) {
      domains.add("trust");
    } else if (/[Gg]allery|[Ii]mage|assignSection|replaceHero/.test(kind)) {
      domains.add("imagery");
    } else {
      domains.add("visual_direction");
    }
  }
  return [...domains];
}

export function domainsAlignWithObjective(
  expectedDomain: string,
  actualDomains: string[],
): boolean {
  if (actualDomains.length === 0) return false;
  if (actualDomains.includes(expectedDomain)) return true;
  const aliases: Record<string, string[]> = {
    cta: [
      "cta",
      "contact_flow",
      "lead_generation",
      "typography_hierarchy",
      "visual_polish",
      "copy_strategy",
    ],
    trust: ["trust", "proof", "testimonials", "layout"],
    contact_flow: ["contact_flow", "cta"],
    visual_polish: [
      "visual_polish",
      "spacing",
      "typography_hierarchy",
      "restraint",
    ],
    spacing: ["spacing", "visual_polish"],
    // Narrative/direction must not be satisfied by motion+typography alone —
    // that case is handled by isVagueDirectionWithCosmeticOps.
    narrative: ["narrative", "visual_direction", "layout", "imagery", "hero_composition"],
    hero_composition: ["hero_composition", "imagery"],
    typography_hierarchy: ["typography_hierarchy", "visual_polish"],
    motion: ["motion"],
    copy_strategy: ["copy_strategy", "cta"],
    layout: ["layout", "trust"],
    seo: ["seo"],
  };
  const allowed = aliases[expectedDomain] ?? [expectedDomain];
  return actualDomains.some((d) => allowed.includes(d));
}

/** Cosmic/direction recs that only touch motion/typography are ineffective for that objective. */
export function isVagueDirectionWithCosmeticOps(
  rec: { title: string; explanation?: string; kind: string },
  operations: Array<EditOperation | ImageOperation>,
): boolean {
  const domain = inferRecommendationDomain(rec);
  if (domain !== "narrative" && domain !== "visual_direction") return false;
  const actual = mutationDomainsFromOperations(operations);
  if (actual.length === 0) return true;
  const cosmeticOnly = actual.every((d) =>
    ["motion", "typography_hierarchy", "visual_polish", "spacing"].includes(d),
  );
  return cosmeticOnly;
}

function strategicMatchScore(
  rec: CreativeDirectorRecommendation,
  opportunity: StrategicOpportunity,
): number {
  const domain = inferRecommendationDomain(rec);
  let score = 0;
  if (domain === opportunity.domain) score += 40;
  if (opportunity.leader === inferRecommendationOwner(domain)) score += 15;
  const title = rec.title.toLowerCase();
  const opTitle = opportunity.title.toLowerCase();
  if (title.includes(opTitle.slice(0, 12)) || opTitle.includes(title.slice(0, 12))) {
    score += 25;
  }
  if (
    (opportunity.id === "cta" || opportunity.id === "contact_flow") &&
    (domain === "cta" || rec.kind === "conversion")
  ) {
    score += 30;
  }
  if (
    (opportunity.id === "spacing_polish" || opportunity.id === "visual_polish") &&
    (domain === "spacing" || domain === "visual_polish")
  ) {
    score += 20;
  }
  if (
    opportunity.id === "narrative" &&
    (domain === "narrative" || domain === "visual_direction")
  ) {
    score += 10;
  }
  return score;
}

/**
 * Arbitrate critique recommendations against Strategic Director priorities.
 * Same project truth → same highest priority as Complete.
 */
export function arbitrateReviewRecommendations(input: {
  assessment: StrategicAssessment;
  recommendations: CreativeDirectorRecommendation[];
}): EnrichedReviewRecommendation[] {
  const { assessment, recommendations } = input;
  const top = assessment.highestPriorityOpportunity;
  const rankedOps = assessment.opportunities;

  const enriched: EnrichedReviewRecommendation[] = recommendations.map(
    (rec, index) => {
      const domain = inferRecommendationDomain(rec);
      const owner = inferRecommendationOwner(domain);
      let bestScore = -1;
      let bestRank = 100 + index;
      for (let i = 0; i < rankedOps.length; i++) {
        const s = strategicMatchScore(rec, rankedOps[i]!);
        if (s > bestScore) {
          bestScore = s;
          bestRank = i;
        }
      }

      // Vague direction with only cosmetic ops — demote hard when CTA/trust leads.
      let deferred = false;
      let deferredReason: string | undefined;
      if (
        top &&
        (top.id === "cta" ||
          top.id === "trust" ||
          top.id === "proof" ||
          top.id === "contact_flow") &&
        isVagueDirectionWithCosmeticOps(rec, rec.operations)
      ) {
        deferred = true;
        deferredReason = `Deferred behind ${top.title} — direction-only polish must not outrank conversion priorities.`;
        bestRank = 80 + index;
      }

      // Lower-confidence motion/typography when conversion leads.
      if (
        top &&
        (top.domain === "cta" || top.domain === "trust") &&
        (domain === "motion" || domain === "typography_hierarchy") &&
        !rec.title.toLowerCase().includes("cta")
      ) {
        deferred = true;
        deferredReason = `Deferred behind ${top.title}.`;
        bestRank = 70 + index;
      }

      if (!rec.applyable || rec.operations.length === 0) {
        // Keep but mark via applyable flag; rank after applyable strategic matches.
        bestRank = Math.max(bestRank, 50);
      }

      return {
        ...rec,
        owner,
        domain,
        objective: rec.title,
        strategicRank: bestRank,
        deferred,
        deferredReason,
        // Deferred items stay in the plan but are not Apply-All applyable until re-ranked.
        applyable: deferred ? false : rec.applyable,
        blockedReason: deferred
          ? deferredReason
          : rec.blockedReason,
        supportStatus: deferred ? "coming_soon" : rec.supportStatus,
      };
    },
  );

  return enriched.sort((a, b) => {
    if (a.deferred !== b.deferred) return a.deferred ? 1 : -1;
    if (a.strategicRank !== b.strategicRank) {
      return a.strategicRank - b.strategicRank;
    }
    if (a.applyable !== b.applyable) return a.applyable ? -1 : 1;
    return b.impactScore - a.impactScore || a.title.localeCompare(b.title);
  });
}

export function buildReviewPlanSnapshot(input: {
  assessment: StrategicAssessment;
  projectRevision: string;
  recommendations: EnrichedReviewRecommendation[];
  postCompletionEvidence: boolean;
}): ReviewPlanSnapshot {
  const createdAt = new Date().toISOString();
  const assessmentId = strategicAssessmentId(input.assessment);
  return {
    reviewPlanId: reviewPlanId({
      projectRevision: input.projectRevision,
      createdAt,
    }),
    projectRevision: input.projectRevision,
    createdAt,
    strategicAssessmentId: assessmentId,
    highestPriorityOpportunityId:
      input.assessment.highestPriorityOpportunity?.id ?? null,
    highestPriorityTitle:
      input.assessment.highestPriorityOpportunity?.title ?? null,
    recommendedLeader: input.assessment.recommendedLeader,
    dependencyOrder: input.recommendations.map((r) => r.id),
    recommendationIds: input.recommendations.map((r) => r.id),
    websiteState: input.assessment.websiteState,
    postCompletionEvidence: input.postCompletionEvidence,
  };
}

export function isReviewPlanStale(input: {
  snapshot: ReviewPlanSnapshot | null | undefined;
  currentRevision: string;
}): boolean {
  if (!input.snapshot) return false;
  return input.snapshot.projectRevision !== input.currentRevision;
}

export function hasRecentNoGainCompletion(input: {
  lastAttempt:
    | {
        overallDelta: number;
        at: string;
      }
    | null
    | undefined;
  maxAgeMs?: number;
}): boolean {
  const attempt = input.lastAttempt;
  if (!attempt) return false;
  const age = Date.now() - new Date(attempt.at).getTime();
  if (age < 0 || age > (input.maxAgeMs ?? 2 * 60 * 60 * 1000)) return false;
  return Math.abs(attempt.overallDelta) <= 2;
}

/** Block lower-priority cosmetic churn after a no-gain Complete. */
export function shouldBlockAsPostCompletionChurn(input: {
  postCompletionEvidence: boolean;
  recommendation: EnrichedReviewRecommendation | AtlasStoredRecommendation & {
    domain?: string;
    deferred?: boolean;
  };
  highestPriorityDomain: string | null;
}): boolean {
  if (!input.postCompletionEvidence) return false;
  const domain =
    "domain" in input.recommendation && input.recommendation.domain
      ? input.recommendation.domain
      : inferRecommendationDomain({
          title: input.recommendation.title,
          kind: input.recommendation.kind,
          explanation: input.recommendation.explanation ?? "",
        });
  const top = input.highestPriorityDomain;
  if (top && domain === top) return false;
  return (
    domain === "motion" ||
    domain === "typography_hierarchy" ||
    domain === "visual_polish" ||
    domain === "spacing" ||
    domain === "narrative" ||
    domain === "visual_direction" ||
    Boolean(
      "deferred" in input.recommendation && input.recommendation.deferred,
    )
  );
}

export function formatStrategicallyPrioritizedReview(input: {
  assessment: StrategicAssessment;
  recommendations: EnrichedReviewRecommendation[];
  critiqueExplanation: string;
}): string {
  const top = input.assessment.highestPriorityOpportunity;
  const lines: string[] = [
    top
      ? `Strategic priority: ${top.title}. ${inferRecommendationOwner(top.domain) === "conversion_director" ? "Conversion Director" : "The leading specialist"} should lead.`
      : "Strategic priority: refine the highest-impact remaining gaps.",
    "",
    "Prioritized improvements",
  ];

  for (let i = 0; i < input.recommendations.length; i++) {
    const r = input.recommendations[i]!;
    const flag = r.deferred
      ? " — deferred until higher priorities land"
      : !r.applyable
        ? " — needs input or unsupported"
        : "";
    lines.push(`${i + 1}. ${r.title}${flag}`);
    if (r.explanation) {
      lines.push(`   ${r.explanation.slice(0, 160)}`);
    }
  }

  lines.push(
    "",
    "Say Apply all when you’re ready, or pick any single improvement.",
  );

  // Keep a short slice of critique strengths if present.
  const strengthBlock = input.critiqueExplanation
    .split(/\n{2,}/)
    .find((b) => /strength/i.test(b.slice(0, 40)));
  if (strengthBlock && strengthBlock.length < 400) {
    lines.unshift(strengthBlock, "");
  }

  return lines.join("\n");
}

export function formatApplyAllDispositionReport(
  traces: RecommendationExecutionTrace[],
): string {
  const applied = traces.filter((t) => t.disposition === "applied");
  const satisfied = traces.filter((t) => t.disposition === "already_satisfied");
  const blocked = traces.filter((t) =>
    [
      "blocked_missing_input",
      "blocked_unsupported",
      "blocked_conflict",
      "blocked_post_completion_churn",
      "stale_reassess_required",
    ].includes(t.disposition),
  );
  const failed = traces.filter((t) => t.disposition === "failed_verification");
  const deferred = traces.filter((t) => t.disposition === "deferred_dependency");

  const lines: string[] = [
    `I evaluated all ${traces.length} approved improvement${traces.length === 1 ? "" : "s"}.`,
  ];

  if (applied.length) {
    lines.push(
      `• ${applied.length} improved the site and ${applied.length === 1 ? "was" : "were"} kept.`,
    );
  }
  if (satisfied.length) {
    lines.push(
      `• ${satisfied.length} ${satisfied.length === 1 ? "was" : "were"} already satisfied.`,
    );
  }
  if (failed.length) {
    lines.push(
      `• ${failed.length} ${failed.length === 1 ? "was" : "were"} not applied because ${failed.length === 1 ? "it" : "they"} did not improve the verified result.`,
    );
  }
  if (deferred.length) {
    lines.push(
      `• ${deferred.length} deferred behind higher-priority work.`,
    );
  }
  if (blocked.length) {
    lines.push(
      `• ${blocked.length} blocked (missing input, unsupported, conflict, or post-completion protection).`,
    );
  }

  if (applied.length) {
    lines.push("", "Kept");
    for (const t of applied.slice(0, 4)) {
      lines.push(`• ${t.title}`);
    }
  }

  const notable = [...failed, ...blocked, ...deferred].slice(0, 4);
  if (notable.length) {
    lines.push("", "Not applied");
    for (const t of notable) {
      lines.push(`• ${t.title} — ${t.reason || t.disposition.replace(/_/g, " ")}`);
    }
  }

  return lines.join("\n");
}

export function logReviewPlanDiagnostics(input: {
  snapshot: ReviewPlanSnapshot;
  dispositions?: RecommendationExecutionTrace[];
  stalePlanDetected?: boolean;
  requestId?: string | null;
}): void {
  if (process.env.NODE_ENV !== "development") return;
  console.info("[atlas:strategic-director:review-plan]", {
    requestId: input.requestId ?? null,
    projectRevision: input.snapshot.projectRevision,
    reviewPlanId: input.snapshot.reviewPlanId,
    strategicAssessmentId: input.snapshot.strategicAssessmentId,
    highestPriorityOpportunity: input.snapshot.highestPriorityTitle,
    recommendationCount: input.snapshot.recommendationIds.length,
    recommendationDispositions: (input.dispositions ?? []).map((d) => ({
      id: d.recommendationId,
      disposition: d.disposition,
    })),
    recommendationOwners: (input.dispositions ?? []).map((d) => d.owner),
    mappedOperations: (input.dispositions ?? []).flatMap((d) => d.mappedOperations),
    actualMutationDomains: (input.dispositions ?? []).flatMap(
      (d) => d.actualMutationDomains,
    ),
    verificationByRecommendation: (input.dispositions ?? []).map((d) => ({
      id: d.recommendationId,
      result: d.verificationResult,
    })),
    stalePlanDetected: input.stalePlanDetected ?? false,
    postCompletionEvidence: input.snapshot.postCompletionEvidence,
  });
}

/** Same project truth → same highest strategic priority (invariant helper). */
export function assertSameHighestPriority(
  a: StrategicAssessment,
  b: StrategicAssessment,
): boolean {
  return (
    (a.highestPriorityOpportunity?.id ?? null) ===
    (b.highestPriorityOpportunity?.id ?? null)
  );
}

export function enrichStoredRecommendation(
  rec: EnrichedReviewRecommendation,
): AtlasStoredRecommendation {
  return {
    id: rec.id,
    source: "design_critique",
    title: rec.title,
    kind: rec.kind,
    applyable: rec.applyable,
    operations: rec.operations,
    explanation: rec.explanation,
    owner: rec.owner,
    domain: rec.domain,
    objective: rec.objective,
    blockedReason: rec.blockedReason,
    supportStatus: rec.supportStatus,
    deferred: rec.deferred,
  };
}

/**
 * Pre-apply disposition for an approved review recommendation.
 * Returns null when the recommendation may be executed.
 */
export function preApplyDisposition(input: {
  recommendation: AtlasStoredRecommendation;
  postCompletionEvidence: boolean;
  highestPriorityDomain: string | null;
}): Pick<
  RecommendationExecutionTrace,
  "disposition" | "reason" | "verificationResult"
> | null {
  const rec = input.recommendation;
  const domain =
    rec.domain ??
    inferRecommendationDomain({
      title: rec.title,
      kind: rec.kind,
      explanation: rec.explanation ?? "",
    });
  const owner = rec.owner ?? inferRecommendationOwner(domain);

  if (rec.deferred) {
    return {
      disposition: "deferred_dependency",
      reason: rec.blockedReason ?? "Deferred behind higher-priority work.",
      verificationResult: "deferred",
    };
  }

  if (
    shouldBlockAsPostCompletionChurn({
      postCompletionEvidence: input.postCompletionEvidence,
      recommendation: { ...rec, domain, deferred: rec.deferred },
      highestPriorityDomain: input.highestPriorityDomain,
    })
  ) {
    return {
      disposition: "blocked_post_completion_churn",
      reason:
        "Recent completion verification found no gain — skipping unverified lower-priority polish.",
      verificationResult: "blocked_churn",
    };
  }

  if (isVagueDirectionWithCosmeticOps(rec, rec.operations)) {
    return {
      disposition: "blocked_unsupported",
      reason:
        "Mapped operations (motion/typography polish) do not satisfy this direction objective.",
      verificationResult: "domain_mismatch",
    };
  }

  if (!rec.applyable || rec.operations.length === 0) {
    const missingInput =
      rec.supportStatus === "needs_images" ||
      /image|testimonial|photo|upload|customer/i.test(
        rec.blockedReason ?? rec.explanation ?? "",
      );
    return {
      disposition: missingInput
        ? "blocked_missing_input"
        : "blocked_unsupported",
      reason:
        rec.blockedReason ??
        (missingInput
          ? "Needs additional input before this can be applied safely."
          : "Not automatically applyable."),
      verificationResult: "not_applyable",
    };
  }

  const mappedDomains = mutationDomainsFromOperations(rec.operations);
  if (
    domain !== "visual_direction" &&
    domain !== "visual_polish" &&
    !domainsAlignWithObjective(domain, mappedDomains)
  ) {
    return {
      disposition: "blocked_unsupported",
      reason: `Operations touch ${mappedDomains.join(", ") || "nothing"} but objective domain is ${domain}.`,
      verificationResult: "domain_mismatch",
    };
  }

  void owner;
  return null;
}

export function buildExecutionTraceBase(
  rec: AtlasStoredRecommendation,
): Omit<
  RecommendationExecutionTrace,
  "disposition" | "verificationResult" | "actualMutationDomains" | "reason"
> {
  const domain =
    rec.domain ??
    inferRecommendationDomain({
      title: rec.title,
      kind: rec.kind,
      explanation: rec.explanation ?? "",
    });
  return {
    recommendationId: rec.id,
    title: rec.title,
    owner: rec.owner ?? inferRecommendationOwner(domain),
    domain,
    objective: rec.objective ?? rec.title,
    mappedOperations: rec.operations.map((op) => String(op.operation)),
    expectedDimensions: [domain],
  };
}

export type { BusinessProject };
