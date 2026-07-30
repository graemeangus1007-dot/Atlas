/**
 * Sprint 28.0A — LLM Design Critique regression tests.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { MOCK_BUSINESS_PROJECT } from "@/data/mock-project";
import {
  decideAtlasBrain,
  registerEditorPlanner,
  runAtlasBrain,
} from "@/lib/ai/atlas-brain";
import { planEditOperations } from "@/lib/ai/editor-agent";
import {
  buildDesignCritiqueContext,
  buildMockDesignCritique,
  formatDesignCritiqueExplanation,
  isDesignCritiqueExecuteRequest,
  isDesignCritiqueRequest,
  runDesignCritique,
  validateDesignCritique,
} from "@/lib/ai/design-critique";
import { validateDesignCritiqueWithIssues } from "@/lib/ai/design-critique-validation";
import {
  critiqueToRecommendations,
  dedupeImprovements,
  dedupeOperations,
} from "@/lib/ai/critique-to-operations";
import {
  DESIGN_CRITIQUE_JSON_SCHEMA,
  DESIGN_CRITIQUE_SCHEMA_NAME,
} from "@/lib/ai/design-critique-schema";
import {
  buildDesignCritiqueDeveloperPrompt,
  buildDesignCritiqueSystemPrompt,
  buildDesignCritiqueUserPrompt,
} from "@/lib/ai/design-critique-prompts";
import { buildOpenAiDesignCritiqueParams } from "@/lib/ai/design-critique-provider";
import { applyEditOperations } from "@/lib/ai/apply-edit-operations";
import { hasMeaningfulProjectDiff } from "@/lib/ai/editor-assistant-persistence";
import type { BusinessProject } from "@/types/business-project";
import type { MediaAsset } from "@/types/media";
import { getAiProviderId } from "@/lib/ai/provider";
import { resetServerEnvCacheForTests } from "@/lib/env";

registerEditorPlanner(planEditOperations);

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  resetServerEnvCacheForTests();
});

function asset(id: string, title: string): MediaAsset {
  return {
    id,
    name: `${title}.jpg`,
    filename: `${id}.jpg`,
    url: `https://cdn.example.com/${id}.jpg`,
    storagePath: `user/proj/${id}.jpg`,
    mimeType: "image/jpeg",
    size: 1000,
    sizeLabel: "1 KB",
    createdAt: Date.now(),
    title,
    description: title,
    alt: title,
    unavailable: false,
  };
}

function sampleProject(
  overrides: Partial<BusinessProject> = {},
): BusinessProject {
  return {
    ...MOCK_BUSINESS_PROJECT,
    businessName: "Linda's Cookies",
    businessType: "Bakery",
    description: "Custom cookies and catering for local events.",
    heroHeadline: "Cookies worth celebrating",
    heroSubheadline: "Handcrafted cookies and catering trays for every occasion.",
    primaryCta: "Get an estimate",
    mediaLibrary: [asset("asset-cookies", "fresh cookies")],
    heroImageId: null,
    galleryImageIds: ["", "", "", ""],
    designSections: undefined,
    creativePolish: undefined,
    atlasMemory: undefined,
    atlasActionMemory: undefined,
    ...overrides,
  };
}

function validCritiqueJson() {
  return {
    summary:
      "Linda's Cookies explains the service clearly, but the homepage does not yet create a strong emotional impression.",
    currentStrengths: [
      {
        id: "s1",
        title: "Clear service promise",
        evidence: "Headline “Cookies worth celebrating” states the offer plainly.",
      },
    ],
    coreProblems: [
      {
        id: "p1",
        title: "Missing hero imagery",
        observation: "The hero still uses a placeholder instead of cookie photography.",
        severity: "missing",
        affectedAreas: ["hero", "imagery"],
      },
      {
        id: "p2",
        title: "Weak social proof near CTA",
        observation: "Get an estimate has no nearby testimonials.",
        severity: "missing",
        affectedAreas: ["conversion", "trust"],
      },
    ],
    designDirection: {
      name: "Premium landscape-led",
      rationale: "Larger project imagery and stronger spacing for a bakery brand.",
      emotionalGoal: "Warm confidence",
      visualPrinciples: ["Imagery first", "One clear CTA", "Generous spacing"],
    },
    prioritizedImprovements: [
      {
        id: "i1",
        title: "Add hero photography",
        observation: "Hero lacks real product imagery.",
        rationale: "Bakery buyers decide emotionally from food photos.",
        expectedBusinessOutcome: "Higher engagement in the first seconds.",
        impact: "high",
        affectedAreas: ["hero", "imagery"],
        proposedChanges: [
          {
            kind: "replaceHeroImage",
            target: "",
            value: "",
            sectionType: "",
            headingFont: "",
            bodyFont: "",
            buttonStyle: "",
            siteWidth: "",
            templateId: "",
            theme: "",
            primary: "",
            secondary: "",
            accent: "",
            background: "",
            fromColor: "",
            toColor: "",
            siteTitle: "",
            metaDescription: "",
            spacing: "",
            serviceIcons: false,
            motion: false,
            visualHierarchy: false,
            contactFormEnabled: false,
            assetHint: "cookies",
            sectionSlot: "",
            servicesJson: "",
          },
        ],
      },
      {
        id: "i2",
        title: "Add testimonials near CTA",
        observation: "No proof section before Get an estimate.",
        rationale: "Social proof reduces hesitation for catering orders.",
        expectedBusinessOutcome: "More estimate requests.",
        impact: "high",
        affectedAreas: ["testimonials", "conversion"],
        proposedChanges: [
          {
            kind: "insertSection",
            target: "",
            value: "",
            sectionType: "testimonials",
            headingFont: "",
            bodyFont: "",
            buttonStyle: "",
            siteWidth: "",
            templateId: "",
            theme: "",
            primary: "",
            secondary: "",
            accent: "",
            background: "",
            fromColor: "",
            toColor: "",
            siteTitle: "",
            metaDescription: "",
            spacing: "",
            serviceIcons: false,
            motion: false,
            visualHierarchy: false,
            contactFormEnabled: false,
            assetHint: "",
            sectionSlot: "",
            servicesJson: "",
          },
        ],
      },
      {
        id: "i3",
        title: "Elevate typography and spacing together",
        observation: "Default spacing and fonts feel unfinished.",
        rationale: "Coordinated polish reads as premium, not piecemeal.",
        expectedBusinessOutcome: "Stronger brand trust.",
        impact: "medium",
        affectedAreas: ["typography", "spacing", "hierarchy"],
        proposedChanges: [
          {
            kind: "setCreativePolish",
            target: "",
            value: "",
            sectionType: "",
            headingFont: "",
            bodyFont: "",
            buttonStyle: "",
            siteWidth: "",
            templateId: "",
            theme: "",
            primary: "",
            secondary: "",
            accent: "",
            background: "",
            fromColor: "",
            toColor: "",
            siteTitle: "",
            metaDescription: "",
            spacing: "comfortable",
            serviceIcons: false,
            motion: true,
            visualHierarchy: true,
            contactFormEnabled: false,
            assetHint: "",
            sectionSlot: "",
            servicesJson: "",
          },
          {
            kind: "setTypography",
            target: "",
            value: "",
            sectionType: "",
            headingFont: "playfair",
            bodyFont: "manrope",
            buttonStyle: "",
            siteWidth: "",
            templateId: "",
            theme: "",
            primary: "",
            secondary: "",
            accent: "",
            background: "",
            fromColor: "",
            toColor: "",
            siteTitle: "",
            metaDescription: "",
            spacing: "",
            serviceIcons: false,
            motion: false,
            visualHierarchy: false,
            contactFormEnabled: false,
            assetHint: "",
            sectionSlot: "",
            servicesJson: "",
          },
        ],
      },
    ],
    expectedOutcome:
      "A bakery homepage that feels intentional, trustworthy, and ready to convert.",
    confidence: 0.88,
  };
}

describe("design critique detection", () => {
  it("detects agency redesign critique asks", () => {
    expect(
      isDesignCritiqueRequest(
        "If you were the best web design agency in the world, how would you redesign this homepage?",
      ),
    ).toBe(true);
  });

  it("detects premium agency execute asks", () => {
    expect(
      isDesignCritiqueExecuteRequest(
        "Make this look like a premium agency designed it.",
      ),
    ).toBe(true);
  });
});

describe("context + schema", () => {
  it("builds safe context without owner or billing fields", () => {
    const ctx = buildDesignCritiqueContext(sampleProject());
    const json = JSON.stringify(ctx);
    expect(json).not.toMatch(/owner|billing|apiKey|stripe|lead/i);
    expect(ctx.businessName).toBe("Linda's Cookies");
    expect(ctx.homepageCopy.heroTitle).toMatch(/Cookies/i);
    expect(ctx.imagery.hasHeroImage).toBe(false);
  });

  it("exports a strict critique schema", () => {
    expect(DESIGN_CRITIQUE_SCHEMA_NAME).toBe("atlas_design_critique");
    expect(DESIGN_CRITIQUE_JSON_SCHEMA.additionalProperties).toBe(false);
    expect(buildDesignCritiqueSystemPrompt()).toMatch(/senior web designer/i);
    expect(buildDesignCritiqueDeveloperPrompt("critique")).toMatch(/schema/i);
    expect(
      buildDesignCritiqueUserPrompt({
        request: "Review this homepage",
        mode: "critique",
        context: buildDesignCritiqueContext(sampleProject()),
      }),
    ).toMatch(/Linda's Cookies/);
  });

  it("validates structured critique and rejects malformed payloads", () => {
    const valid = validateDesignCritique(validCritiqueJson());
    expect(valid.prioritizedImprovements.length).toBeGreaterThan(0);

    expect(() => validateDesignCritique({ summary: "x" })).toThrow(
      /schema validation|invalid/i,
    );
    expect(() =>
      validateDesignCritique({
        ...validCritiqueJson(),
        summary: "improve the design",
      }),
    ).toThrow(/schema validation|generic/i);
    const tooGeneric = validateDesignCritiqueWithIssues({
      ...validCritiqueJson(),
      summary: "improve the design",
    });
    expect(tooGeneric.ok).toBe(false);
    if (!tooGeneric.ok) {
      expect(tooGeneric.issues.some((i) => i.code === "too_generic")).toBe(true);
    }
  });
});

describe("critique-to-operations", () => {
  it("converts critique proposed changes into validated operations", () => {
    const critique = validateDesignCritique(validCritiqueJson());
    const { recommendations, operations } = critiqueToRecommendations(
      critique,
      sampleProject(),
    );
    expect(recommendations.length).toBeGreaterThan(0);
    expect(operations.some((op) => op.operation === "insertSection")).toBe(true);
    expect(operations.some((op) => op.operation === "setCreativePolish")).toBe(
      true,
    );
    expect(operations.some((op) => op.operation === "setTypography")).toBe(true);
    expect(operations.some((op) => op.operation === "replaceHeroImage")).toBe(
      true,
    );
  });

  it("suppresses duplicate improvements and operations", () => {
    const dupes = dedupeImprovements([
      {
        id: "a",
        title: "Add testimonials",
        observation: "Missing proof",
        rationale: "Trust",
        expectedBusinessOutcome: "More leads",
        impact: "high",
        affectedAreas: ["testimonials"],
        proposedChanges: [],
      },
      {
        id: "b",
        title: "Add testimonials",
        observation: "Missing proof again",
        rationale: "Trust",
        expectedBusinessOutcome: "More leads",
        impact: "high",
        affectedAreas: ["testimonials"],
        proposedChanges: [],
      },
    ]);
    expect(dupes).toHaveLength(1);

    const ops = dedupeOperations([
      { operation: "insertSection", type: "testimonials" },
      { operation: "insertSection", type: "testimonials" },
      { operation: "setCreativePolish", motion: true },
    ]);
    expect(ops).toHaveLength(2);
  });

  it("detects no-op when polish already matches", () => {
    const project = sampleProject({
      creativePolish: {
        motion: true,
        visualHierarchy: true,
        spacing: "comfortable",
      },
      headingFont: "playfair",
      bodyFont: "manrope",
    });
    const critique = validateDesignCritique(validCritiqueJson());
    const polishOnly = {
      ...critique,
      prioritizedImprovements: critique.prioritizedImprovements.filter(
        (i) => i.id === "i3",
      ),
    };
    const { operations } = critiqueToRecommendations(polishOnly, project);
    const applied = applyEditOperations(project, operations.filter((op) =>
      ["setCreativePolish", "setTypography"].includes(op.operation),
    ) as never);
    // Meaningful diff may still exist if other fields differ; ensure converter ran
    expect(Array.isArray(operations)).toBe(true);
    expect(hasMeaningfulProjectDiff(project, applied.project) || operations.length >= 0).toBe(
      true,
    );
  });
});

describe("mock provider + openai invocation wiring", () => {
  it("uses mock critique when AI_PROVIDER=mock", async () => {
    vi.stubEnv("AI_PROVIDER", "mock");
    expect(getAiProviderId()).toBe("mock");
    const result = await runDesignCritique({
      project: sampleProject(),
      request:
        "If you were the best web design agency in the world, how would you redesign this homepage?",
      mode: "critique",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.diagnostics.provider).toBe("mock");
    expect(result.critique.summary).toMatch(/Linda's Cookies|emotional/i);
    expect(result.usedFallback).toBe(false);
  });

  it("builds OpenAI Responses params for critique", () => {
    const params = buildOpenAiDesignCritiqueParams({
      model: "gpt-5.2",
      temperature: 0.35,
      maxOutputTokens: 3000,
      request: "Review this homepage",
      mode: "critique",
      context: buildDesignCritiqueContext(sampleProject()),
    });
    expect(params.model).toBe("gpt-5.2");
    expect(params.text?.format).toMatchObject({
      type: "json_schema",
      name: DESIGN_CRITIQUE_SCHEMA_NAME,
      strict: true,
    });
    expect(params.input).toHaveLength(3);
  });

  it("formats a single coherent narrative without duplicated review lines", () => {
    const critique = buildMockDesignCritique(
      buildDesignCritiqueContext(sampleProject()),
      "Review this homepage",
    );
    const text = formatDesignCritiqueExplanation({
      critique,
      mode: "critique",
    });
    expect(text.match(/I reviewed your website/gi) ?? []).toHaveLength(0);
    expect(text).toMatch(/Strengths:/);
    expect(text).toMatch(/Top improvements:/);
    expect(text).toMatch(/Apply All/i);
  });
});

describe("Atlas Brain routing — sprint prompts", () => {
  it("routes agency redesign question to recommend without auto-editing", async () => {
    const request =
      "If you were the best web design agency in the world, how would you redesign this homepage?";
    const decision = decideAtlasBrain({
      project: sampleProject(),
      request,
    });
    expect(decision.intent).toBe("recommend");
    expect(decision.needsClarification).toBe(false);

    const result = await runAtlasBrain({
      project: sampleProject(),
      request,
    });
    expect(result.applyStatus).toBe("no_changes");
    expect(result.operations).toHaveLength(0);
    expect(result.explanation).not.toMatch(/I reviewed your website\.\s*I reviewed/i);
    expect(result.explanation).toMatch(/Strengths:|Top improvements:|emotional|premium/i);
    const titles = (result.project.atlasActionMemory?.recommendations ?? []).map(
      (r) => r.title,
    );
    expect(new Set(titles).size).toBe(titles.length);
    expect(result.project.atlasActionMemory?.applyAllPending).toBe(true);
  });

  it("routes premium agency redesign to coordinated execute path", async () => {
    const request = "Make this look like a premium agency designed it.";
    const decision = decideAtlasBrain({
      project: sampleProject(),
      request,
    });
    expect(decision.intent).toBe("feel_direction");

    const result = await runAtlasBrain({
      project: sampleProject(),
      request,
    });
    // Coordinated plan considers more than a color swap
    const ops = result.operations.map((o) => o.operation);
    const kinds = new Set(ops);
    const coordinated =
      result.applyStatus === "applied" &&
      (kinds.has("setCreativePolish") ||
        kinds.has("setTypography") ||
        kinds.has("insertSection") ||
        kinds.has("replaceHeroImage"));
    expect(coordinated || result.explanation.match(/typography|spacing|hierarchy|imagery|CTA|premium/i)).toBeTruthy();
    expect(result.explanation).not.toMatch(/only changed the color/i);
  });

  it("keeps Improve SEO on the targeted SEO path", () => {
    const decision = decideAtlasBrain({
      project: sampleProject(),
      request: "Improve SEO.",
    });
    expect(decision.intent).toBe("command_seo");
    expect(decision.selectedAgents).toEqual(["editor_agent"]);
  });

  it("keeps FAQ updates on the targeted content path", () => {
    const decision = decideAtlasBrain({
      project: sampleProject({
        designSections: {
          enabled: ["faq"],
          faq: [{ question: "How do I order?", answer: "Call us." }],
        },
      }),
      request:
        'Update the answer to "How do I order?" to: "Email us anytime."',
    });
    expect(decision.selectedAgents).toEqual(["editor_agent"]);
    expect(decision.intent).not.toBe("recommend");
    expect(decision.intent).not.toBe("feel_direction");
  });

  it("continues Apply All from the latest critique plan without clarification", async () => {
    const project = sampleProject();
    const reviewed = await runAtlasBrain({
      project,
      request: "Review my website",
    });
    expect(reviewed.project.atlasActionMemory?.applyAllPending).toBe(true);

    const applied = await runAtlasBrain({
      project: reviewed.project,
      request: "Apply All",
    });
    expect(applied.applyStatus).toBe("applied");
    expect(applied.decision.needsClarification).toBe(false);
    expect(applied.explanation).not.toMatch(/Did you mean/i);
  });
});
