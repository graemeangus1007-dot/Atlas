/**
 * Strategic Director Phase 1 — orchestration, conflicts, routing, verification.
 */

import { describe, expect, it } from "vitest";
import { MOCK_BUSINESS_PROJECT } from "@/data/mock-project";
import { runAtlasBrain } from "@/lib/ai/atlas-brain";
import { decideWithAtlasBrainEngine } from "@/lib/ai/atlas-brain-decision-engine";
import {
  applyConflictResolutions,
  assessStrategicPriorities,
  detectStrategicConflicts,
  gatherStrategicInputs,
  isStrategicAdvisoryRequest,
  isStrategicDirectorRequest,
  rankOpportunities,
  verifyStrategicAssessment,
  type StrategicGatheredInputs,
  type StrategicOpportunity,
} from "@/lib/strategy";
import type { BusinessProject } from "@/types/business-project";
import type { MediaAsset } from "@/types/media";

function asset(id: string): MediaAsset {
  return {
    id,
    name: `${id}.jpg`,
    filename: `${id}.jpg`,
    url: `https://cdn.example.com/${id}.jpg`,
    storagePath: `user/proj/${id}.jpg`,
    mimeType: "image/jpeg",
    size: 1200,
    sizeLabel: "1 KB",
    createdAt: Date.now(),
    title: id,
    description: id,
    alt: id,
    width: 1600,
    height: 900,
  } as MediaAsset;
}

function weakSite(): BusinessProject {
  return {
    ...MOCK_BUSINESS_PROJECT,
    businessName: "Harbor Services",
    businessType: "Landscaping",
    heroHeadline: "Welcome",
    heroSubheadline: "We do things.",
    primaryCta: "Click here",
    heroImageId: "hero-1",
    mediaLibrary: [asset("hero-1")],
    galleryImageIds: [],
    designSections: { enabled: [] },
    heroOverlay: 78,
    heroTreatment: {
      textScrim: { enabled: true, opacity: 0.5, blur: 14 },
      gradient: { direction: "bottom", strength: 0.8, coverage: 0.7 },
    },
    contact: {
      ...MOCK_BUSINESS_PROJECT.contact,
      phone: "",
      email: "",
      formEnabled: false,
    },
    creativePolish: {
      spacing: "default",
      visualHierarchy: false,
      serviceIcons: false,
      motion: true,
      hoverEffects: true,
    },
    sectionOrder: ["hero", "about", "services", "contact", "footer"],
  };
}

function excellentSite(): BusinessProject {
  return {
    ...MOCK_BUSINESS_PROJECT,
    businessName: "Harborview Landscaping",
    businessType: "Landscaping",
    heroHeadline: "Outdoor spaces that feel finished",
    heroSubheadline:
      "Design, build, and care for yards that look intentional year-round.",
    primaryCta: "Get a quote",
    secondaryCta: "View projects",
    heroImageId: "hero-1",
    mediaLibrary: [asset("hero-1"), asset("g1"), asset("g2"), asset("g3")],
    galleryImageIds: ["g1", "g2", "g3"],
    heroOverlay: 28,
    creativePolish: {
      spacing: "airy",
      visualHierarchy: true,
      serviceIcons: true,
      motion: false,
      hoverEffects: false,
      sectionReveal: false,
    },
    designSections: {
      enabled: ["testimonials", "faq"],
      testimonials: [
        {
          id: "t1",
          quote: "They transformed our backyard into something we use every week.",
          name: "Alex R.",
          role: "Homeowner",
        },
        {
          id: "t2",
          quote: "Clear communication and beautiful finished work.",
          name: "Jordan M.",
          role: "Homeowner",
        },
      ],
      faq: [
        {
          id: "f1",
          question: "Do you offer maintenance?",
          answer: "Yes — seasonal care plans are available.",
        },
      ],
    },
    contact: {
      ...MOCK_BUSINESS_PROJECT.contact,
      phone: "555-0100",
      email: "hello@harborview.example",
      formEnabled: true,
      location: "Harbor City",
    },
    sectionOrder: [
      "hero",
      "about",
      "services",
      "gallery",
      "testimonials",
      "faq",
      "contact",
      "footer",
    ],
  };
}

function blockedProofSite(): BusinessProject {
  return {
    ...weakSite(),
    primaryCta: "Request a quote",
    heroHeadline: "Premium landscaping for busy homeowners",
    heroSubheadline: "Full-service design and install.",
    contact: {
      ...MOCK_BUSINESS_PROJECT.contact,
      phone: "555-0100",
      email: "hello@example.com",
      formEnabled: true,
    },
    designSections: { enabled: [] },
    galleryImageIds: [],
  };
}

describe("Strategic Director request detection", () => {
  it("recognizes prioritization phrases", () => {
    for (const phrase of [
      "What's the biggest weakness?",
      "What should I fix first?",
      "Where should I spend another hour?",
      "What matters most?",
      "What would improve this site the most?",
      "Complete my website.",
    ]) {
      expect(isStrategicDirectorRequest(phrase)).toBe(true);
    }
  });

  it("keeps Complete my website out of advisory-only routing", () => {
    expect(isStrategicAdvisoryRequest("Complete my website.")).toBe(false);
    expect(isStrategicAdvisoryRequest("What should I fix first?")).toBe(true);
  });

  it("does not steal specialist lanes", () => {
    expect(isStrategicDirectorRequest("Polish the website.")).toBe(false);
    expect(isStrategicDirectorRequest("How do we improve conversion?")).toBe(
      false,
    );
    expect(isStrategicDirectorRequest("Make the hero prettier.")).toBe(false);
    expect(isStrategicDirectorRequest("Review my website.")).toBe(false);
  });
});

describe("Strategic assessment", () => {
  it("ranks a weak site with a real leader", () => {
    const assessment = assessStrategicPriorities({ project: weakSite() });
    expect(assessment.recommendedLeader).not.toBe("none");
    expect(assessment.highestPriorityOpportunity).not.toBeNull();
    expect(assessment.executionSequence.length).toBeGreaterThan(0);
    const verified = verifyStrategicAssessment(assessment);
    expect(verified.ok).toBe(true);
  });

  it("handles an already excellent site", () => {
    const assessment = assessStrategicPriorities({ project: excellentSite() });
    expect(["excellent", "developing"]).toContain(assessment.websiteState);
    expect(assessment.summary.length).toBeGreaterThan(20);
    expect(verifyStrategicAssessment(assessment).ok).toBe(true);
  });

  it("keeps blocked work blocked on proof-starved sites", () => {
    const assessment = assessStrategicPriorities({
      project: blockedProofSite(),
    });
    const blocked = assessment.blockedWork;
    expect(blocked.length).toBeGreaterThan(0);
    for (const item of blocked) {
      expect(item.blocked).toBe(true);
    }
    if (assessment.opportunities.some((o) => !o.blocked)) {
      expect(assessment.highestPriorityOpportunity?.blocked).not.toBe(true);
    }
  });

  it("is deterministic across repeated runs", () => {
    const a = assessStrategicPriorities({ project: weakSite() });
    const b = assessStrategicPriorities({ project: weakSite() });
    expect(a.recommendedLeader).toBe(b.recommendedLeader);
    expect(a.priorityRanking.map((r) => r.id)).toEqual(
      b.priorityRanking.map((r) => r.id),
    );
    expect(a.executionSequence.map((s) => s.opportunityId)).toEqual(
      b.executionSequence.map((s) => s.opportunityId),
    );
  });

  it("does not duplicate recommendations", () => {
    const assessment = assessStrategicPriorities({ project: weakSite() });
    const titles = assessment.opportunities.map((o) => o.title);
    const ids = assessment.opportunities.map((o) => o.id);
    expect(new Set(titles).size).toBe(titles.length);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("respects dependency order in the execution sequence", () => {
    const assessment = assessStrategicPriorities({ project: weakSite() });
    expect(verifyStrategicAssessment(assessment).failures).not.toContain(
      "dependency_order_violated",
    );
    const pos = new Map(
      assessment.executionSequence.map((s) => [s.opportunityId, s.order]),
    );
    const spacing = pos.get("spacing_polish");
    const hero = pos.get("hero_composition");
    if (spacing != null && hero != null) {
      expect(hero).toBeLessThan(spacing);
    }
  });
});

describe("Conflict resolution", () => {
  it("detects Creative vs Taste conflict", () => {
    const gathered = gatherStrategicInputs({ project: weakSite() });
    const forced: StrategicGatheredInputs = {
      ...gathered,
      creativeDirector: {
        ...gathered.creativeDirector,
        dimensions: {
          ...gathered.creativeDirector.dimensions,
          firstImpression: 55,
        },
        recommendations: [
          {
            title: "Make a taller hero",
            creativeDirectorExplanation: "A taller hero height would feel more dramatic.",
            priority: "high",
            theme: "hierarchy",
            relatedSections: ["hero"],
            estimatedImpact: 20,
          },
          ...gathered.creativeDirector.recommendations,
        ],
      },
      taste: gathered.taste
        ? {
            ...gathered.taste,
            restraint: 55,
            spacingHarmony: 60,
            recommendations: [
              {
                owner: "taste",
                domain: "restraint",
                title: "Reduce competing effects",
                explanation: "A quieter, shorter treatment would feel more restrained.",
                improves: ["restraint", "polish"],
                priority: "high",
                estimatedImpact: 18,
                theme: "messaging",
              },
            ],
          }
        : null,
    };
    const opportunities: StrategicOpportunity[] = [
      {
        id: "hero_composition",
        title: "Improve hero composition",
        leader: "visual_composition",
        owner: "visual_composition",
        domain: "hero_composition",
        sourceScore: 60,
        businessImpact: 80,
        expectedImprovement: 18,
        implementationConfidence: 85,
        verificationConfidence: 80,
        blocked: false,
        dependsOn: [],
        explanation: "Hero needs work.",
      },
      {
        id: "spacing_polish",
        title: "Refine spacing",
        leader: "taste",
        owner: "taste",
        domain: "spacing",
        sourceScore: 60,
        businessImpact: 55,
        expectedImprovement: 12,
        implementationConfidence: 88,
        verificationConfidence: 86,
        blocked: false,
        dependsOn: ["hero_composition"],
        explanation: "Spacing polish.",
      },
    ];
    const conflicts = detectStrategicConflicts({
      gathered: forced,
      opportunities,
    });
    expect(
      conflicts.some(
        (c) =>
          c.ownerA === "creative_director" && c.ownerB === "taste",
      ),
    ).toBe(true);
  });

  it("detects Conversion vs Taste conflict", () => {
    const gathered = gatherStrategicInputs({ project: weakSite() });
    const forced: StrategicGatheredInputs = {
      ...gathered,
      conversionDirector: gathered.conversionDirector
        ? {
            ...gathered.conversionDirector,
            proof: 50,
            trust: 55,
            recommendations: [
              {
                owner: "conversion_director",
                domain: "proof",
                title: "Put proof before the ask",
                explanation: "Proof first.",
                priority: "high",
                estimatedImpact: 20,
                requiresBusinessInput: true,
                improves: ["proof", "trust"],
              },
            ],
          }
        : null,
      taste: gathered.taste
        ? {
            ...gathered.taste,
            eligibleToJudge: true,
            spacingHarmony: 60,
            polish: 62,
          }
        : null,
    };
    const conflicts = detectStrategicConflicts({
      gathered: forced,
      opportunities: [
        {
          id: "trust",
          title: "Strengthen trust",
          leader: "conversion_director",
          owner: "conversion_director",
          domain: "trust",
          sourceScore: 55,
          businessImpact: 90,
          expectedImprovement: 20,
          implementationConfidence: 80,
          verificationConfidence: 80,
          blocked: false,
          dependsOn: [],
          explanation: "Trust gap.",
        },
        {
          id: "spacing_polish",
          title: "Refine spacing",
          leader: "taste",
          owner: "taste",
          domain: "spacing",
          sourceScore: 60,
          businessImpact: 55,
          expectedImprovement: 12,
          implementationConfidence: 88,
          verificationConfidence: 86,
          blocked: false,
          dependsOn: ["cta"],
          explanation: "Polish.",
        },
      ],
    });
    expect(
      conflicts.some(
        (c) =>
          c.ownerA === "conversion_director" && c.ownerB === "taste",
      ),
    ).toBe(true);
    const resolved = applyConflictResolutions(
      [
        {
          id: "spacing_polish",
          title: "Refine spacing",
          leader: "taste",
          owner: "taste",
          domain: "spacing",
          sourceScore: 60,
          businessImpact: 55,
          expectedImprovement: 12,
          implementationConfidence: 88,
          verificationConfidence: 86,
          blocked: false,
          dependsOn: [],
          explanation: "Polish.",
        },
        {
          id: "trust",
          title: "Strengthen trust",
          leader: "conversion_director",
          owner: "conversion_director",
          domain: "trust",
          sourceScore: 55,
          businessImpact: 90,
          expectedImprovement: 20,
          implementationConfidence: 80,
          verificationConfidence: 80,
          blocked: false,
          dependsOn: [],
          explanation: "Trust.",
        },
      ],
      conflicts,
    );
    const taste = resolved.find((o) => o.leader === "taste");
    expect(taste && taste.businessImpact < 55).toBe(true);
  });

  it("detects Visual Composition vs Creative conflict", () => {
    const gathered = gatherStrategicInputs({ project: weakSite() });
    const forced: StrategicGatheredInputs = {
      ...gathered,
      visualComposition: gathered.visualComposition
        ? {
            ...gathered.visualComposition,
            overall: 58,
            negativeSpaceUse: 55,
            photographyPreservation: {
              ...gathered.visualComposition.photographyPreservation,
              overall: 52,
            },
          }
        : null,
      creativeDirector: {
        ...gathered.creativeDirector,
        recommendations: [
          {
            title: "Redesign the hero narrative",
            creativeDirectorExplanation: "Hero section needs a stronger story.",
            priority: "high",
            theme: "hierarchy",
            relatedSections: ["hero"],
            estimatedImpact: 22,
          },
        ],
      },
    };
    const conflicts = detectStrategicConflicts({
      gathered: forced,
      opportunities: [
        {
          id: "hero_composition",
          title: "Improve hero composition",
          leader: "visual_composition",
          owner: "visual_composition",
          domain: "hero_composition",
          sourceScore: 58,
          businessImpact: 85,
          expectedImprovement: 18,
          implementationConfidence: 86,
          verificationConfidence: 84,
          blocked: false,
          dependsOn: [],
          explanation: "Composition.",
        },
      ],
    });
    expect(
      conflicts.some(
        (c) =>
          c.ownerA === "visual_composition" &&
          c.ownerB === "creative_director",
      ),
    ).toBe(true);
  });
});

describe("Priority ranking", () => {
  it("does not simply pick the lowest source score", () => {
    const ranked = rankOpportunities([
      {
        id: "spacing_polish",
        title: "Refine spacing",
        leader: "taste",
        owner: "taste",
        domain: "spacing",
        sourceScore: 40,
        businessImpact: 40,
        expectedImprovement: 8,
        implementationConfidence: 90,
        verificationConfidence: 90,
        blocked: false,
        dependsOn: ["hero_composition", "cta"],
        explanation: "Low score polish.",
      },
      {
        id: "trust",
        title: "Strengthen trust",
        leader: "conversion_director",
        owner: "conversion_director",
        domain: "trust",
        sourceScore: 62,
        businessImpact: 92,
        expectedImprovement: 22,
        implementationConfidence: 82,
        verificationConfidence: 80,
        blocked: false,
        dependsOn: [],
        explanation: "Higher impact trust.",
      },
    ]);
    expect(ranked[0]?.id).toBe("trust");
  });
});

describe("Strategic Director routing", () => {
  it("routes What should I fix first? to Strategic Director", () => {
    const decided = decideWithAtlasBrainEngine({
      project: weakSite(),
      request: "What should I fix first?",
    });
    expect(decided.commandKind).toBe("strategic_director");
    expect(decided.stage).toBe("strategic_director");
    expect(decided.decision.shouldExecuteEdits).toBe(false);
  });

  it("Complete my website uses Strategic Director then Transformation", async () => {
    const result = await runAtlasBrain({
      project: weakSite(),
      request: "Complete my website.",
    });
    expect(result.decision?.commandKind).toBe("strategic_director");
    expect(result.decision?.matchedSignals).toEqual(
      expect.arrayContaining(["execute_completion", "transformationHandoff"]),
    );
    expect(result.explanation).toMatch(/Highest priority|already in a strong/i);
    expect(result.explanation).not.toMatch(/Say Apply all when you’re ready/i);
  });

  it("advisory strategic asks stay analysis-only", async () => {
    const result = await runAtlasBrain({
      project: weakSite(),
      request: "What should I fix first?",
    });
    expect(result.decision?.commandKind).toBe("strategic_director");
    expect(result.applyStatus).toBe("no_changes");
    expect(result.operations).toEqual([]);
    expect(result.followUpSuggestions.join(" ")).not.toMatch(/Apply All/i);
  });

  it("surfaces capability gaps without executing them as polish", () => {
    const assessment = assessStrategicPriorities({
      project: blockedProofSite(),
    });
    const gaps = assessment.blockedWork.filter(
      (o) => o.leader === "capability_gap" || o.blocked,
    );
    expect(gaps.length).toBeGreaterThan(0);
    expect(assessment.summary).toMatch(/./);
  });
});
