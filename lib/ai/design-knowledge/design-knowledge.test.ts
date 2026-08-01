import { describe, expect, it } from "vitest";
import {
  buildDesignCritiqueContext,
  buildMockDesignCritique,
  formatDesignCritiqueExplanation,
} from "@/lib/ai/design-critique";
import {
  buildDesignCritiqueUserPrompt,
  selectPrinciplesForCritiquePrompt,
} from "@/lib/ai/design-critique-prompts";
import { critiqueToRecommendations } from "@/lib/ai/critique-to-operations";
import {
  DESIGN_KNOWLEDGE_CATEGORIES,
  DESIGN_KNOWLEDGE_REGISTRY,
  MAX_PROMPT_DESIGN_PRINCIPLES,
  countDesignPrinciplesByCategory,
  designKnowledgeContextFromParts,
  explainFromDesignKnowledge,
  formatDesignPrinciplesForPrompt,
  getDesignPrincipleById,
  getDesignPrinciplesByCategory,
  listAllDesignPrinciples,
  rankDesignPrinciples,
  selectRelevantDesignPrinciples,
  textExposesDesignPrincipleIds,
  validateDesignPrincipleRegistry,
} from "@/lib/ai/design-knowledge";
import { buildDesignStrategy, runDesignStrategyPass } from "@/lib/ai/design-strategy";
import { MOCK_BUSINESS_PROJECT } from "@/data/mock-project";
import type { BusinessProject } from "@/types/business-project";

function landscapingProject(): BusinessProject {
  return {
    ...MOCK_BUSINESS_PROJECT,
    businessName: "Green Ridge Landscaping",
    businessType: "Local landscaping company",
    description: "Lawn care and outdoor living for homeowners.",
    heroHeadline: "Outdoor spaces that feel finished",
    heroSubheadline: "Local landscaping for curb appeal and backyard living.",
    primaryCta: "Request a quote",
    secondaryCta: "See services",
    mediaLibrary: [],
    heroImageId: null,
    galleryImageIds: ["", "", "", ""],
    designSections: undefined,
    creativePolish: { spacing: "default", visualHierarchy: false },
  };
}

describe("Design Knowledge registry", () => {
  it("has stable unique IDs and valid related references", () => {
    expect(validateDesignPrincipleRegistry([...DESIGN_KNOWLEDGE_REGISTRY])).toEqual(
      [],
    );
    const ids = DESIGN_KNOWLEDGE_REGISTRY.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const p of DESIGN_KNOWLEDGE_REGISTRY) {
      expect(p.id).toMatch(/^[a-z]+\.[a-z0-9_]+$/);
      expect(p.title.trim()).toBeTruthy();
      expect(p.principle.trim()).toBeTruthy();
      expect(p.reasoning.trim()).toBeTruthy();
      expect(p.signals.length).toBeGreaterThan(0);
      expect(p.recommendedActions.length).toBeGreaterThan(0);
      expect(DESIGN_KNOWLEDGE_CATEGORIES).toContain(p.category);
      for (const related of p.relatedPrincipleIds) {
        expect(getDesignPrincipleById(related)).toBeTruthy();
      }
    }
  });

  it("rejects duplicate IDs", () => {
    const clone = [...DESIGN_KNOWLEDGE_REGISTRY];
    const dup = { ...clone[0]!, id: clone[1]!.id };
    expect(validateDesignPrincipleRegistry([...clone, dup]).length).toBeGreaterThan(
      0,
    );
  });

  it("retrieves by category with expected counts", () => {
    const counts = countDesignPrinciplesByCategory();
    for (const category of DESIGN_KNOWLEDGE_CATEGORIES) {
      const list = getDesignPrinciplesByCategory(category);
      expect(list.length).toBe(counts[category]);
      expect(list.length).toBeGreaterThanOrEqual(6);
      expect(list.length).toBeLessThanOrEqual(12);
      expect(list.every((p) => p.category === category)).toBe(true);
    }
    expect(listAllDesignPrinciples().length).toBe(DESIGN_KNOWLEDGE_REGISTRY.length);
  });
});

describe("Design Knowledge selectors", () => {
  it("selects deterministically for the same context", () => {
    const ctx = designKnowledgeContextFromParts({
      industry: "Local landscaping company",
      primaryGoal: "Generate quote requests",
      hasHeroImage: false,
      hasTestimonials: false,
      galleryFilledSlots: 0,
      libraryCount: 0,
      visualHierarchy: false,
      spacing: "default",
    });
    const a = selectRelevantDesignPrinciples(ctx).map((p) => p.id);
    const b = selectRelevantDesignPrinciples(ctx).map((p) => p.id);
    expect(a).toEqual(b);
    expect(a.length).toBeGreaterThan(0);
    expect(a.length).toBeLessThan(DESIGN_KNOWLEDGE_REGISTRY.length);
  });

  it("ranks by relevance and impact (foundational before decorative)", () => {
    const ctx = designKnowledgeContextFromParts({
      industry: "Landscaping",
      hasHeroImage: false,
      hasTestimonials: false,
      weakCtaHierarchy: true,
      primaryGoal: "Request a quote",
    });
    const ranked = rankDesignPrinciples(listAllDesignPrinciples(), ctx);
    expect(ranked[0]!.score).toBeGreaterThanOrEqual(ranked[1]!.score);
    const ids = ranked.slice(0, 8).map((r) => r.principle.id);
    expect(
      ids.some((id) =>
        /imagery|hero|trust|cta|proof|homepage/.test(id),
      ),
    ).toBe(true);
  });

  it("landscaping regression: imagery, dominant CTA, proof, authentic photos", () => {
    const ctx = designKnowledgeContextFromParts({
      industry: "Local landscaping company",
      businessType: "Local landscaping company",
      primaryGoal: "Request a quote",
      hasHeroImage: false,
      hasTestimonials: false,
      galleryFilledSlots: 0,
      libraryCount: 0,
      visualHierarchy: false,
      weakCtaHierarchy: true,
      secondaryCta: "See services",
    });
    const ids = selectRelevantDesignPrinciples(ctx, { limit: 12 }).map((p) => p.id);
    expect(ids).toEqual(expect.arrayContaining([
      "homepage.purposeful_hero_imagery",
    ]));
    expect(ids.some((id) => id.includes("one_dominant_cta") || id.includes("cta_prominence"))).toBe(
      true,
    );
    expect(
      ids.some((id) =>
        id.includes("proof_before") || id.includes("trust_near") || id.includes("sequence_before"),
      ),
    ).toBe(true);
    expect(
      ids.some((id) =>
        id.includes("authentic") || id.includes("real_project") || id.includes("gallery"),
      ),
    ).toBe(true);
  });

  it("professional service regression: contrast, paragraph width, heading hierarchy, scannable emphasis", () => {
    const ctx = designKnowledgeContextFromParts({
      industry: "Professional consulting",
      businessType: "Professional consulting",
      hasHeroImage: true,
      hasTestimonials: true,
      lowContrast: true,
      longParagraphs: true,
      weakHeadingScale: true,
      visualHierarchy: false,
      primaryGoal: "Book consultations",
    });
    const ids = selectRelevantDesignPrinciples(ctx, { limit: 12 }).map((p) => p.id);
    expect(
      ids.some((id) =>
        id.includes("contrast") || id.includes("accessible_controls"),
      ),
    ).toBe(true);
    expect(ids).toEqual(
      expect.arrayContaining(["typography.controlled_paragraph_width"]),
    );
    expect(ids).toEqual(
      expect.arrayContaining(["typography.clear_heading_hierarchy"]),
    );
    expect(ids).toEqual(expect.arrayContaining(["typography.scannable_emphasis"]));
  });

  it("mobile context boosts mobile-applicable principles", () => {
    const base = designKnowledgeContextFromParts({
      industry: "Salon",
      hasHeroImage: true,
      hasTestimonials: true,
      mobile: false,
    });
    const mobile = { ...base, mobile: true };
    const baseIds = new Set(selectRelevantDesignPrinciples(base).map((p) => p.id));
    const mobileSelected = selectRelevantDesignPrinciples(mobile);
    const mobileBoosted = mobileSelected.filter((p) => p.appliesTo.includes("mobile"));
    expect(mobileBoosted.length).toBeGreaterThan(0);
    // Deterministic and not identical full registry
    expect(mobileSelected.length).toBeLessThan(listAllDesignPrinciples().length);
    expect(baseIds.size).toBeGreaterThan(0);
  });

  it("does not format the entire registry into prompts", () => {
    const principles = selectRelevantDesignPrinciples(
      designKnowledgeContextFromParts({
        industry: "Bakery",
        hasHeroImage: false,
      }),
      { limit: MAX_PROMPT_DESIGN_PRINCIPLES },
    );
    const prompt = formatDesignPrinciplesForPrompt(principles);
    expect(prompt).not.toMatch(/homepage\.one_clear_promise/);
    expect(prompt.split("\n").length).toBeLessThanOrEqual(
      MAX_PROMPT_DESIGN_PRINCIPLES + 2,
    );
    expect(listAllDesignPrinciples().length).toBeGreaterThan(
      MAX_PROMPT_DESIGN_PRINCIPLES,
    );
    for (const p of listAllDesignPrinciples()) {
      // Full principle dump would include nearly every title — ensure most are absent.
      const titleHits = listAllDesignPrinciples().filter((x) =>
        prompt.includes(x.title),
      ).length;
      expect(titleHits).toBeLessThanOrEqual(MAX_PROMPT_DESIGN_PRINCIPLES);
      void p;
      break;
    }
  });
});

describe("Design Knowledge integration", () => {
  it("Design Strategy receives selected principles and evidence", () => {
    const strategy = buildDesignStrategy({
      businessName: "Green Ridge Landscaping",
      industry: "Local landscaping company",
      businessDescription: "Lawn care",
      targetAudience: "Homeowners",
      primaryGoal: "Request a quote",
      heroTitle: "Outdoor spaces",
      heroDescription: "Local landscaping",
      primaryCta: "Request a quote",
      sectionOrder: ["hero", "services", "contact"],
      enabledSections: ["hero", "services", "contact"],
      hasHeroImage: false,
      hasTestimonials: false,
      hasFaq: false,
      galleryFilledSlots: 0,
      libraryCount: 0,
      spacing: "default",
      visualHierarchy: false,
      maturityLevel: "Draft",
      overallCompleteness: 40,
      designLanguage: "Approachable",
      businessTone: "friendly local",
    });
    expect(strategy.principleIds.length).toBeGreaterThan(0);
    expect(strategy.evidence.length).toBeGreaterThan(0);
    expect(strategy.evidence.every((e) => e.principleId.includes("."))).toBe(true);
    expect(textExposesDesignPrincipleIds(strategy.biggestProblem)).toBe(false);
  });

  it("critique prompts include concise principle guidance without IDs", () => {
    const context = buildDesignCritiqueContext(landscapingProject());
    const principles = selectPrinciplesForCritiquePrompt(
      context,
      "Complete my website",
    );
    expect(principles.length).toBeLessThanOrEqual(MAX_PROMPT_DESIGN_PRINCIPLES);
    const user = buildDesignCritiqueUserPrompt({
      request: "Review my website",
      mode: "critique",
      context,
      principles,
    });
    expect(user).toMatch(/Applicable design judgment/i);
    expect(user).not.toMatch(/homepage\.purposeful_hero_imagery/);
    expect(user).not.toMatch(/according to principle/i);
    // Must not include every registry title
    const titleHits = DESIGN_KNOWLEDGE_REGISTRY.filter((p) =>
      user.includes(p.title),
    ).length;
    expect(titleHits).toBeLessThanOrEqual(MAX_PROMPT_DESIGN_PRINCIPLES);
  });

  it("runDesignStrategyPass wires principles into strategy", () => {
    const project = landscapingProject();
    const context = buildDesignCritiqueContext(project);
    const critique = buildMockDesignCritique(context, "Complete my website");
    const { strategy, principles } = runDesignStrategyPass({
      context,
      critique,
      request: "Complete my website",
    });
    expect(principles.length).toBeGreaterThan(0);
    expect(strategy.principleIds).toEqual(principles.map((p) => p.id));
  });

  it("recommendations retain internal evidence without exposing IDs", () => {
    const project = landscapingProject();
    const context = buildDesignCritiqueContext(project);
    const critique = buildMockDesignCritique(context, "Complete my website");
    const { strategy, critique: next } = runDesignStrategyPass({
      context,
      critique,
      request: "Complete my website",
    });
    const { recommendations } = critiqueToRecommendations(next, project, {
      principleIds: strategy.principleIds,
    });
    const withEvidence = recommendations.filter(
      (r) => (r.knowledgeEvidence?.length ?? 0) > 0,
    );
    expect(withEvidence.length).toBeGreaterThan(0);
    for (const rec of recommendations) {
      expect(textExposesDesignPrincipleIds(rec.explanation)).toBe(false);
      expect(rec.explanation).not.toMatch(/according to principle/i);
    }
    const explanation = formatDesignCritiqueExplanation({
      critique: next,
      mode: "critique",
      strategy,
    });
    expect(textExposesDesignPrincipleIds(explanation)).toBe(false);
  });

  it("principle use does not create duplicate recommendation titles", () => {
    const project = landscapingProject();
    const context = buildDesignCritiqueContext(project);
    const critique = buildMockDesignCritique(context, "Complete my website");
    const { critique: next } = runDesignStrategyPass({
      context,
      critique,
      request: "Complete my website",
    });
    const titles = next.prioritizedImprovements.map((i) =>
      i.title.trim().toLowerCase(),
    );
    expect(new Set(titles).size).toBe(titles.length);
  });

  it("explanations translate principles into natural language", () => {
    const text = explainFromDesignKnowledge({
      principleId: "trust.proof_before_high_commitment",
      observedSignal: "no testimonials",
    });
    expect(text).toMatch(/proof|trust|testimonial/i);
    expect(textExposesDesignPrincipleIds(text)).toBe(false);
  });

  it("same project state yields the same selected principle set", () => {
    const project = landscapingProject();
    const context = buildDesignCritiqueContext(project);
    const a = selectPrinciplesForCritiquePrompt(context, "Complete my website").map(
      (p) => p.id,
    );
    const b = selectPrinciplesForCritiquePrompt(context, "Complete my website").map(
      (p) => p.id,
    );
    expect(a).toEqual(b);
  });
});
