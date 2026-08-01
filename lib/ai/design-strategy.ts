/**
 * Atlas Design Intelligence Engine (v1.1+).
 * Builds a holistic Design Strategy before edit planning / ops conversion.
 * v1.2 — Design Knowledge Base guides judgment and prioritization.
 * No new edit operations — only better judgment and prioritization.
 */

import type {
  CritiqueImprovement,
  DesignCritique,
  DesignCritiqueContext,
} from "@/lib/ai/design-critique-types";
import {
  buildDesignKnowledgeEvidence,
  designKnowledgeContextFromParts,
  explainFromDesignKnowledge,
  getDesignPrincipleById,
  matchPrinciplesToText,
  MAX_STRATEGY_DESIGN_PRINCIPLES,
  sanitizeDesignKnowledgeUserText,
  scoreActionAgainstPrinciples,
  selectRelevantDesignPrinciples,
} from "@/lib/ai/design-knowledge";
import type { DesignPrinciple } from "@/lib/ai/design-knowledge/types";
import type {
  DesignAgencyTone,
  DesignFocusArea,
  DesignStrategy,
  DesignStrategyInput,
} from "@/lib/ai/design-strategy-types";
import { DESIGN_AGENCIES_TONES } from "@/lib/ai/design-strategy-types";

const STRATEGY_VERSION = "1.2.0";

export { STRATEGY_VERSION };

/** Map critique context → strategy input. */
export function designStrategyInputFromContext(
  context: DesignCritiqueContext,
  request?: string,
): DesignStrategyInput {
  return {
    businessName: context.businessName,
    industry: context.industry,
    businessDescription: context.businessDescription,
    targetAudience: context.targetAudience,
    primaryGoal: context.primaryGoal,
    heroTitle: context.homepageCopy.heroTitle,
    heroDescription: context.homepageCopy.heroDescription,
    primaryCta: context.homepageCopy.primaryCta,
    sectionOrder: context.sectionOrder,
    enabledSections: context.enabledSections,
    hasHeroImage: context.imagery.hasHeroImage,
    hasTestimonials: context.enabledSections.includes("testimonials"),
    hasFaq: context.enabledSections.includes("faq"),
    galleryFilledSlots: context.imagery.galleryFilledSlots,
    libraryCount: context.imagery.libraryCount,
    spacing: context.creativePolish.spacing || context.spacing,
    visualHierarchy: context.creativePolish.visualHierarchy,
    maturityLevel: context.maturity.maturityLevel,
    overallCompleteness: context.maturity.overallCompleteness,
    designLanguage: context.designSystem.language || context.designSystem.label,
    businessTone: context.atlasMemory.businessTone || "",
    request,
  };
}

function inferAgencyTones(input: DesignStrategyInput): DesignAgencyTone[] {
  const blob = [
    input.industry,
    input.businessDescription,
    input.businessTone,
    input.designLanguage,
    input.request ?? "",
  ]
    .join(" ")
    .toLowerCase();

  const tones: DesignAgencyTone[] = [];
  const push = (tone: DesignAgencyTone) => {
    if (!tones.includes(tone)) tones.push(tone);
  };

  if (/luxur|estate|jewel|spa|boutique|fine\s+dining|coastal|craft/.test(blob)) {
    push("luxury");
    push("premium");
  }
  if (/handcraft|artisan|bakery|wood|custom\s+build|made\s+to\s+order/.test(blob)) {
    push("handcrafted");
  }
  if (/playful|kids|fun|colorful|party|game/.test(blob)) {
    push("playful");
  }
  if (/editorial|magazine|studio|photographer|writer|publish/.test(blob)) {
    push("editorial");
  }
  if (/minimal|clean|simple|scandinavian/.test(blob)) {
    push("minimalist");
  }
  if (/clinic|medical|legal|financ|insur|account/.test(blob)) {
    push("trustworthy");
  }
  if (/cafe|coffee|salon|local|family|friendly|neighbor/.test(blob)) {
    push("approachable");
  }
  if (/modern|tech|software|digital/.test(blob)) {
    push("modern");
  }
  if (/heritage|classic|timeless|traditional/.test(blob)) {
    push("timeless");
  }

  if (tones.length === 0) {
    push("premium");
    push("modern");
    push("trustworthy");
  }

  return tones.slice(0, 3).filter((t) =>
    (DESIGN_AGENCIES_TONES as readonly string[]).includes(t),
  ) as DesignAgencyTone[];
}

function selectionContextFromStrategyInput(input: DesignStrategyInput) {
  return designKnowledgeContextFromParts({
    industry: input.industry,
    businessType: input.industry,
    audience: input.targetAudience,
    primaryGoal: input.primaryGoal,
    designLanguage: input.designLanguage,
    businessTone: input.businessTone,
    enabledSections: input.enabledSections,
    sectionOrder: input.sectionOrder,
    hasHeroImage: input.hasHeroImage,
    hasTestimonials: input.hasTestimonials,
    hasFaq: input.hasFaq,
    galleryFilledSlots: input.galleryFilledSlots,
    libraryCount: input.libraryCount,
    spacing: input.spacing,
    visualHierarchy: input.visualHierarchy,
    maturityLevel: input.maturityLevel,
    overallCompleteness: input.overallCompleteness,
    request: input.request,
    heroTitle: input.heroTitle,
    heroDescription: input.heroDescription,
  });
}

function biggestProblemFor(
  input: DesignStrategyInput,
  principles: DesignPrinciple[],
): {
  problem: string;
  focus: DesignFocusArea[];
  primarySection: string;
} {
  const topId = principles[0]?.id;
  const grounded = (fallback: string, principleId?: string, signal?: string) =>
    principleId
      ? sanitizeDesignKnowledgeUserText(
          explainFromDesignKnowledge({
            principleId,
            observedSignal: signal ?? principles[0]?.signals[0] ?? "homepage",
            siteDetail: fallback,
          }),
        )
      : fallback;

  if (!input.hasHeroImage && input.libraryCount === 0) {
    return {
      problem: grounded(
        "Visitors never see visual proof of the work — the hero still feels unfinished, so trust never forms before the ask.",
        topId?.includes("imagery") || topId?.includes("hero")
          ? topId
          : "homepage.purposeful_hero_imagery",
        "no hero image",
      ),
      focus: ["imagery", "hero", "trust"],
      primarySection: "hero",
    };
  }
  if (!input.hasTestimonials) {
    return {
      problem: grounded(
        "Visitors don’t see enough proof of the work before being asked to take action — trust is asked for, not earned.",
        "trust.proof_before_high_commitment",
        "no testimonials",
      ),
      focus: ["proof", "trust", "conversion"],
      primarySection: "testimonials",
    };
  }
  if (!input.hasHeroImage) {
    return {
      problem: grounded(
        "The first viewport lacks emotional imagery, so the homepage explains the offer without making visitors feel it.",
        "homepage.purposeful_hero_imagery",
        "missing imagery",
      ),
      focus: ["imagery", "hero", "hierarchy"],
      primarySection: "hero",
    };
  }
  if (!input.visualHierarchy || input.spacing === "default") {
    return {
      problem: grounded(
        "The page feels evenly weighted — nothing leads the eye, so the primary action competes with secondary content.",
        "homepage.one_dominant_cta",
        "weak cta hierarchy",
      ),
      focus: ["hierarchy", "whitespace", "hero"],
      primarySection: "hero",
    };
  }
  if (input.overallCompleteness < 55) {
    return {
      problem:
        "The homepage still reads as incomplete for launch — key sections and polish that build confidence are missing.",
      focus: ["trust", "messaging", "conversion"],
      primarySection: "hero",
    };
  }
  return {
    problem:
      "The conversion path is soft — the offer is understandable, but the page doesn’t create urgency or a single obvious next step.",
    focus: ["conversion", "messaging", "hero"],
    primarySection: "contact",
  };
}

/** Map knowledge categories → strategy focus areas. */
function focusFromPrinciples(principles: DesignPrinciple[]): DesignFocusArea[] {
  const focus: DesignFocusArea[] = [];
  const push = (f: DesignFocusArea) => {
    if (!focus.includes(f)) focus.push(f);
  };
  for (const p of principles.slice(0, 6)) {
    if (p.category === "homepage") push("hero");
    if (p.category === "trust") {
      push("trust");
      push("proof");
    }
    if (p.category === "imagery") push("imagery");
    if (p.category === "hierarchy" || p.category === "typography") {
      push("hierarchy");
    }
    if (p.category === "spacing") push("whitespace");
    if (p.category === "conversion") push("conversion");
    if (p.category === "accessibility" || p.category === "color") {
      push("messaging");
    }
  }
  return focus.slice(0, 4);
}

function directionLabel(
  tones: DesignAgencyTone[],
  industry: string,
  name: string,
): string {
  const lead = tones[0] ?? "premium";
  const craft =
    lead === "handcrafted"
      ? "handcrafted quality"
      : lead === "luxury" || lead === "premium"
        ? "premium craftsmanship"
        : lead === "editorial"
          ? "editorial clarity"
          : lead === "minimalist"
            ? "calm minimalism"
            : lead === "playful"
              ? "approachable energy"
              : lead === "trustworthy"
                ? "quiet authority"
                : "modern confidence";
  const niche = industry.trim() || "service";
  return `${craft.charAt(0).toUpperCase()}${craft.slice(1)} for ${name || `a ${niche}`}`;
}

/**
 * Deterministic Design Strategy from website state (+ request hints).
 * Runs before improvements are ranked into edit operations.
 */
export function buildDesignStrategy(input: DesignStrategyInput): DesignStrategy {
  const name = input.businessName.trim() || "this business";
  const industry = input.industry.trim() || "service business";
  const tones = inferAgencyTones(input);
  const knowledgeContext = selectionContextFromStrategyInput(input);
  const principles = selectRelevantDesignPrinciples(knowledgeContext, {
    limit: MAX_STRATEGY_DESIGN_PRINCIPLES,
  });
  const evidence = buildDesignKnowledgeEvidence(principles, knowledgeContext);
  const principleIds = principles.map((p) => p.id);

  const base = biggestProblemFor(input, principles);
  const knowledgeFocus = focusFromPrinciples(principles);
  const focus =
    knowledgeFocus.length > 0
      ? [...knowledgeFocus, ...base.focus].filter(
          (f, i, arr) => arr.indexOf(f) === i,
        ).slice(0, 4)
      : base.focus;
  const { problem, primarySection } = base;

  const customer =
    input.targetAudience.trim() ||
    `People looking for a trusted ${industry} they can feel confident hiring.`;
  const desiredEmotion =
    tones.includes("luxury") || tones.includes("premium")
      ? "Calm confidence — they found the specialist who takes the work seriously."
      : tones.includes("playful")
        ? "Warm energy — the brand feels inviting and easy to approach."
        : tones.includes("trustworthy")
          ? "Steady reassurance — this is a safe, capable choice."
          : "Clear confidence — the offer and next step feel obvious.";

  const heroLen =
    (input.heroTitle?.length ?? 0) + (input.heroDescription?.length ?? 0);
  const messageOverload = heroLen > 220 || input.enabledSections.length > 8;

  const missingTrust: string[] = [];
  if (!input.hasTestimonials) missingTrust.push("Customer testimonials near the CTA");
  if (!input.hasFaq) missingTrust.push("FAQ that answers first objections");
  if (!input.hasHeroImage) missingTrust.push("Real photography in the hero");
  if (input.galleryFilledSlots === 0) {
    missingTrust.push("A visible portfolio or project gallery");
  }

  const designGoals = [
    "Increase trust before the ask.",
    "Reduce cognitive load in the first viewport.",
    "Create a clearer visual hierarchy.",
    focus.includes("proof") || focus.includes("imagery")
      ? "Put proof and craftsmanship where visitors look first."
      : "Make the primary call-to-action unmistakable.",
    "Raise perceived quality to match a professional agency site.",
  ].slice(0, 5);

  const executionPlan: string[] = [];
  if (focus.includes("hero") || primarySection === "hero") {
    executionPlan.push("Rebuild the hero for one clear promise and a stronger first impression.");
  }
  if (!input.hasTestimonials) {
    executionPlan.push("Place testimonials directly below the hero so trust lands early.");
  }
  if (input.galleryFilledSlots === 0 && input.libraryCount > 0) {
    executionPlan.push("Surface project imagery above long service lists.");
  } else if (!input.hasHeroImage && input.libraryCount > 0) {
    executionPlan.push("Set a real hero image from the media library.");
  }
  if (!input.visualHierarchy || input.spacing === "default") {
    executionPlan.push("Increase whitespace and strengthen type hierarchy.");
  }
  if (messageOverload) {
    executionPlan.push("Reduce hero copy so the page communicates one idea at a time.");
  }
  executionPlan.push("Strengthen the primary CTA so the next step is obvious.");
  if (executionPlan.length < 3) {
    executionPlan.push("Tighten messaging around the customer outcome.");
  }

  // Knowledge-informed execution priorities (natural language, no IDs).
  for (const p of principles.slice(0, 3)) {
    if (
      p.category === "accessibility" &&
      !executionPlan.some((s) => /contrast/i.test(s))
    ) {
      executionPlan.unshift("Fix contrast on text and controls before decorative polish.");
    }
  }

  const currentImpression = !input.hasHeroImage
    ? `Informative but unfinished — ${name} explains the offer without showing the craft.`
    : !input.hasTestimonials
      ? `Capable but unproven — visitors understand the service before they trust it.`
      : input.spacing === "default"
        ? `Busy and even — the page works hard but doesn’t feel premium yet.`
        : `Clear enough to scan, but not yet decisive about hierarchy or conversion.`;

  const hierarchyPrinciple = principles.find((p) => p.category === "hierarchy");
  const visualHierarchy = hierarchyPrinciple
    ? "One dominant element per region, then proof, then services, then a single contact action — never equal weight across the fold."
    : "One dominant hero message, then proof, then services, then a single contact action — never equal weight across the fold.";

  return {
    overallDirection: directionLabel(tones, industry, name),
    biggestProblem: sanitizeDesignKnowledgeUserText(problem),
    currentImpression,
    desiredEmotion,
    customer,
    conversionBlocker: sanitizeDesignKnowledgeUserText(problem),
    primaryFocusSection: primarySection,
    visualHierarchy,
    missingTrustSignals: missingTrust.slice(0, 4),
    messageOverload,
    agencyTones: tones,
    designGoals,
    executionPlan: executionPlan.slice(0, 6),
    priorityFocus: focus,
    confidence: 0.88,
    principleIds,
    evidence,
  };
}

/** Score an improvement against strategy focus (higher = earlier). */
export function scoreImprovementAgainstStrategy(
  improvement: CritiqueImprovement,
  strategy: DesignStrategy,
): number {
  const hay = [
    improvement.title,
    improvement.observation,
    improvement.rationale,
    ...improvement.affectedAreas,
    ...improvement.proposedChanges.map((c) => c.kind),
  ]
    .join(" ")
    .toLowerCase();

  let score = improvement.impact === "high" ? 30 : improvement.impact === "medium" ? 18 : 8;

  const weights: Record<DesignFocusArea, number> = {
    hero: 24,
    trust: 22,
    proof: 22,
    hierarchy: 18,
    whitespace: 14,
    conversion: 20,
    imagery: 20,
    messaging: 16,
    navigation: 8,
    mobile: 10,
  };

  for (const focus of strategy.priorityFocus) {
    const w = weights[focus] ?? 10;
    if (focus === "proof" && /testimonial|proof|social/.test(hay)) score += w;
    if (focus === "trust" && /trust|testimonial|faq|proof/.test(hay)) score += w;
    if (focus === "hero" && /hero|first\s+impression|headline/.test(hay)) score += w;
    if (focus === "imagery" && /image|imagery|photo|gallery|hero\s+image/.test(hay)) {
      score += w;
    }
    if (focus === "hierarchy" && /hierarch|typography|spacing|whitespace/.test(hay)) {
      score += w;
    }
    if (focus === "whitespace" && /spacing|whitespace|breath/.test(hay)) score += w;
    if (focus === "conversion" && /cta|contact|conversion|lead/.test(hay)) score += w;
    if (focus === "messaging" && /copy|message|headline|seo|wording/.test(hay)) {
      score += w;
    }
    if (focus === "navigation" && /nav|menu/.test(hay)) score += w;
    if (focus === "mobile" && /mobile|tap/.test(hay)) score += w;
  }

  if (
    strategy.primaryFocusSection &&
    hay.includes(strategy.primaryFocusSection.toLowerCase())
  ) {
    score += 12;
  }

  // Prefer coordinated polish early when hierarchy/spacing is a focus.
  if (
    strategy.priorityFocus.includes("hierarchy") &&
    /setcreativepolish|settypography|spacing/.test(hay)
  ) {
    score += 8;
  }

  // v1.2 — knowledge relevance (foundational problems before decorative polish).
  if (strategy.principleIds?.length) {
    const principles = strategy.principleIds
      .map((id) => getDesignPrincipleById(id))
      .filter((p): p is DesignPrinciple => Boolean(p));
    score += scoreActionAgainstPrinciples(hay, principles);
  }

  // Demote decorative motion when foundational gaps remain.
  if (
    /motion|hover|animat|subtle animation/.test(hay) &&
    (strategy.priorityFocus.includes("trust") ||
      strategy.priorityFocus.includes("imagery") ||
      strategy.priorityFocus.includes("hero"))
  ) {
    score -= 25;
  }

  return score;
}

export function prioritizeImprovementsByStrategy(
  improvements: CritiqueImprovement[],
  strategy: DesignStrategy,
): CritiqueImprovement[] {
  return [...improvements].sort(
    (a, b) =>
      scoreImprovementAgainstStrategy(b, strategy) -
      scoreImprovementAgainstStrategy(a, strategy),
  );
}

/**
 * Rewrite improvement observation/rationale to reference strategy when thin.
 */
export function strategizeImprovementCopy(
  improvement: CritiqueImprovement,
  strategy: DesignStrategy,
): CritiqueImprovement {
  const mentionsProof = /testimonial|proof|social/i.test(improvement.title);
  if (mentionsProof && !/below the hero|early|before/i.test(improvement.rationale)) {
    const rationale = sanitizeDesignKnowledgeUserText(
      explainFromDesignKnowledge({
        principleId: "trust.proof_before_high_commitment",
        observedSignal: "no testimonials",
        siteDetail:
          "I’d place proof directly below the hero so trust is established before visitors evaluate services.",
      }),
    );
    return {
      ...improvement,
      observation: strategy.biggestProblem,
      rationale,
    };
  }
  return improvement;
}

/** Attach internal knowledge evidence onto improvements (not user-facing). */
export function attachKnowledgeEvidenceToImprovements(
  improvements: CritiqueImprovement[],
  strategy: DesignStrategy,
): CritiqueImprovement[] {
  return improvements.map((item) => {
    const evidence = matchPrinciplesToText(
      `${item.title} ${item.observation} ${item.rationale} ${item.affectedAreas.join(" ")}`,
      strategy.principleIds ?? [],
      3,
    );
    if (evidence.length === 0) return item;
    return {
      ...item,
      // Keep rationale free of IDs; evidence is parallel metadata via strategy.
      rationale: sanitizeDesignKnowledgeUserText(item.rationale),
    };
  });
}

/** Apply strategy: reorder + enrich improvements on a critique. */
export function applyDesignStrategyToCritique(
  critique: DesignCritique,
  strategy: DesignStrategy,
): DesignCritique {
  const ordered = attachKnowledgeEvidenceToImprovements(
    prioritizeImprovementsByStrategy(
      critique.prioritizedImprovements,
      strategy,
    ).map((item) => strategizeImprovementCopy(item, strategy)),
    strategy,
  );

  // Dedupe near-identical titles after knowledge reordering.
  const seen = new Set<string>();
  const deduped = ordered.filter((item) => {
    const key = item.title.trim().toLowerCase().replace(/\s+/g, " ");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return {
    ...critique,
    designDirection: {
      name: strategy.overallDirection,
      rationale: strategy.biggestProblem,
      emotionalGoal: strategy.desiredEmotion,
      visualPrinciples: [
        ...strategy.agencyTones.map((t) => `Compose for a ${t} feel`),
        strategy.visualHierarchy,
        ...strategy.designGoals.slice(0, 2),
      ].slice(0, 5),
    },
    prioritizedImprovements: deduped.slice(0, 5),
    summary: sanitizeDesignKnowledgeUserText(
      critique.summary.trim() ||
        `${strategy.currentImpression} ${strategy.biggestProblem}`,
    ),
  };
}

/** User-facing strategy block for Atlas conversation. */
export function formatDesignStrategySection(strategy: DesignStrategy): string {
  const tones = strategy.agencyTones.join(" · ");
  const goals = strategy.designGoals.map((g) => `• ${g}`).join("\n");
  const plan = strategy.executionPlan.map((step, i) => `${i + 1}. ${step}`).join("\n");
  const trust =
    strategy.missingTrustSignals.length > 0
      ? strategy.missingTrustSignals.map((t) => `• ${t}`).join("\n")
      : "• Core trust signals are present — strengthen placement and hierarchy.";

  return [
    "Overall direction",
    `${strategy.overallDirection}${tones ? ` (${tones})` : ""}`,
    "",
    "Biggest problem",
    strategy.biggestProblem,
    "",
    "Current impression",
    strategy.currentImpression,
    "",
    "Customer",
    strategy.customer,
    "",
    "Desired emotion",
    strategy.desiredEmotion,
    "",
    "Design goals",
    goals,
    "",
    "Missing trust signals",
    trust,
    "",
    "Execution plan",
    plan,
  ].join("\n");
}

/**
 * Full pipeline helper: context → strategy → strategy-aware critique.
 */
export function runDesignStrategyPass(input: {
  context: DesignCritiqueContext;
  critique: DesignCritique;
  request?: string;
  /** Optional preselected principles — defaults to deterministic selection. */
  principles?: DesignPrinciple[];
}): {
  strategy: DesignStrategy;
  critique: DesignCritique;
  principles: DesignPrinciple[];
} {
  const strategyInput = designStrategyInputFromContext(
    input.context,
    input.request,
  );
  const knowledgeContext = selectionContextFromStrategyInput(strategyInput);
  const principles =
    input.principles ??
    selectRelevantDesignPrinciples(knowledgeContext, {
      limit: MAX_STRATEGY_DESIGN_PRINCIPLES,
    });
  const strategy = buildDesignStrategy(strategyInput);
  // Preserve caller-selected principle set when provided (still deterministic build).
  if (input.principles) {
    strategy.principleIds = principles.map((p) => p.id);
    strategy.evidence = buildDesignKnowledgeEvidence(
      principles,
      knowledgeContext,
    );
  }
  return {
    strategy,
    critique: applyDesignStrategyToCritique(input.critique, strategy),
    principles,
  };
}
