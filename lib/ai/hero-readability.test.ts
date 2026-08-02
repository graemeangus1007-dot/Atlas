/**
 * v1.2 — Hero readability: local scope, brand preservation, Action Memory bypass.
 */

import { beforeAll, describe, expect, it } from "vitest";
import {
  decideWithAtlasBrainEngine,
} from "@/lib/ai/atlas-brain-decision-engine";
import {
  getLastExecution,
  shouldExecuteActionMemory,
  storeLastExecution,
  storeRecommendations,
} from "@/lib/ai/atlas-action-memory";
import {
  registerEditorPlanner,
  runAtlasBrain,
} from "@/lib/ai/atlas-brain";
import { planEditOperations } from "@/lib/ai/editor-agent";
import { applyEditOperations } from "@/lib/ai/apply-edit-operations";
import { validateEditOperations } from "@/lib/ai/validate-edit-operations";
import { buildSiteDesignStyle } from "@/lib/design-theme";
import { buildStaticSiteCss } from "@/lib/publishing/styles/site-css";
import { NAMED_COLORS } from "@/lib/ai/named-colors";
import { MOCK_BUSINESS_PROJECT } from "@/data/mock-project";
import type { BusinessProject } from "@/types/business-project";
import {
  analyzeHeroReadability,
  heroTreatmentsToOperations,
  isBrandRegressionComplaint,
  isHeroReadabilityRequest,
  planHeroReadabilityOperations,
  verifyHeroReadabilityImprovement,
} from "@/lib/ai/hero-readability";

beforeAll(() => {
  registerEditorPlanner(planEditOperations);
});

function greenGoldProject(
  overrides: Partial<BusinessProject> = {},
): BusinessProject {
  return {
    ...MOCK_BUSINESS_PROJECT,
    businessName: "Harborview Landscaping",
    businessType: "Contractor",
    heroHeadline: "Outdoor spaces that feel finished",
    heroSubheadline: "Design, build, and care for yards that look intentional.",
    primaryCta: "Get a quote",
    primaryColor: NAMED_COLORS.forestGreen,
    accentColor: NAMED_COLORS.gold,
    secondaryColor: NAMED_COLORS.forestGreen,
    backgroundColor: "#f7f8fa",
    theme: "light",
    headingFont: "inter",
    bodyFont: "inter",
    buttonStyle: "rounded",
    siteWidth: "boxed",
    heroOverlay: 25,
    heroImageId: "hero-busy",
    creativePolish: {
      spacing: "airy",
      visualHierarchy: true,
      serviceIcons: false,
      motion: false,
    },
    atlasActionMemory: undefined,
    ...overrides,
  };
}

describe("routing — hero readability beats Action Memory", () => {
  it("detects corrective follow-ups", () => {
    expect(
      isHeroReadabilityRequest(
        "The text blends into the hero background. Fix that.",
      ),
    ).toBe(true);
    expect(isHeroReadabilityRequest("Fix the hero contrast.")).toBe(true);
    expect(isHeroReadabilityRequest("I still can’t read the headline.")).toBe(
      true,
    );
    expect(isHeroReadabilityRequest("That didn’t fix it.")).toBe(true);
    expect(isHeroReadabilityRequest("The hero is still hard to read.")).toBe(
      true,
    );
  });

  it("never routes corrective blend request through Action Memory", () => {
    const memory = storeRecommendations(undefined, {
      creative: [
        {
          id: "visual.icons",
          kind: "visual",
          title: "Add icons",
          explanation: "Icons",
          impact: "high",
          impactScore: 90,
          confidence: 0.9,
          operations: [{ operation: "setCreativePolish", serviceIcons: true }],
          capabilityIds: [],
          applyable: true,
          estimatedTime: "<10 seconds",
        },
      ],
    });
    expect(
      shouldExecuteActionMemory(
        "The text blends into the hero background. Fix that.",
        memory,
      ),
    ).toBe(false);
  });

  it("brain never returns empty-plan message for blend follow-up", async () => {
    const memory = storeRecommendations(undefined, {
      creative: [
        {
          id: "visual.icons",
          kind: "visual",
          title: "Add icons",
          explanation: "Icons",
          impact: "high",
          impactScore: 90,
          confidence: 0.9,
          operations: [{ operation: "setCreativePolish", serviceIcons: true }],
          capabilityIds: [],
          applyable: true,
          estimatedTime: "<10 seconds",
        },
      ],
    });
    const result = await runAtlasBrain({
      project: greenGoldProject({
        atlasActionMemory: memory,
        heroOverlay: 0,
      }),
      request: "The text blends into the hero background. Fix that.",
    });
    expect(result.explanation).not.toMatch(
      /applyable improvements queued|Review the site first|Apply All/i,
    );
    expect(result.applyStatus).toBe("applied");
    expect(result.project.accentColor).toBe(NAMED_COLORS.gold);
  });

  it("decision engine uses hero_readability", () => {
    const decision = decideWithAtlasBrainEngine({
      project: greenGoldProject(),
      request: "Make the words in the hero section easier to read.",
    });
    expect(decision.commandKind).toBe("hero_readability");
  });
});

describe("green-and-gold brand preservation", () => {
  it("strengthens overlay and keeps gold accent / global palette", async () => {
    const before = greenGoldProject({ heroOverlay: 0 });
    const result = await runAtlasBrain({
      project: before,
      request: "Make the words in the hero section easier to read.",
    });

    expect(result.applyStatus).toBe("applied");
    expect(result.project.heroOverlay).toBeGreaterThan(before.heroOverlay);
    expect(result.project.accentColor).toBe(NAMED_COLORS.gold);
    expect(result.project.primaryColor).toBe(NAMED_COLORS.forestGreen);
    expect(result.project.backgroundColor).toBe(before.backgroundColor);
    expect(result.operations.some((op) => op.operation === "changeTheme")).toBe(
      false,
    );
    expect(result.explanation).toMatch(/overlay|headline/i);
    expect(result.explanation).not.toMatch(/button contrast/i);
    expect(result.explanation).toMatch(/brand colors|without changing/i);

    const check = verifyHeroReadabilityImprovement(before, result.project);
    expect(check.improved).toBe(true);
    expect(check.preservationViolation).toBe(false);
    expect(check.globalThemeTokensChanged).toEqual([]);
  });

  it("never emits accent rewrite treatments", () => {
    const assessment = analyzeHeroReadability(
      greenGoldProject({
        heroOverlay: 0,
        accentColor: "#fcd34d",
      }),
    );
    const ops = heroTreatmentsToOperations(assessment.recommendedTreatments);
    expect(ops.some((op) => op.operation === "changeTheme")).toBe(false);
    expect(ops.some((op) => op.operation === "setHeroOverlay")).toBe(true);
  });

  it("button contrast alone does not verify hero readability", () => {
    const before = greenGoldProject({ heroOverlay: 75, heroImageId: "h1" });
    const after = {
      ...before,
      accentColor: "#0f766e",
    };
    const check = verifyHeroReadabilityImprovement(before, after);
    expect(check.improved).toBe(false);
    expect(check.preservationViolation).toBe(true);
    expect(check.explanationHint).toMatch(/brand colors|Button contrast/i);
  });
});

describe("brand regression repair", () => {
  it("detects gold complaint", () => {
    expect(isBrandRegressionComplaint("Why did you get rid of the gold colors?")).toBe(
      true,
    );
  });

  it("restores prior palette and does not launch a gold redesign", async () => {
    const original = greenGoldProject({ heroOverlay: 50 });
    const corrupted = {
      ...original,
      accentColor: "#0f766e",
      primaryColor: "#0f766e",
      atlasActionMemory: storeLastExecution(undefined, {
        request: "Make the words in the hero section easier to read.",
        at: new Date().toISOString(),
        success: true,
        verified: false,
        operationTypes: ["changeTheme", "setHeroOverlay"],
        operations: [
          { operation: "changeTheme", accent: "#0f766e" },
          { operation: "setHeroOverlay", value: 75 },
        ],
        verificationFailures: [],
        createdEntities: [],
        modifiedEntities: ["accentColor", "heroOverlay"],
        explanation: "Done. I improved button contrast.",
        paletteBefore: {
          primaryColor: original.primaryColor,
          accentColor: original.accentColor,
          secondaryColor: original.secondaryColor,
          backgroundColor: original.backgroundColor,
          theme: original.theme,
        },
        scope: "hero",
      }),
    };

    const result = await runAtlasBrain({
      project: corrupted,
      request: "Why did you get rid of the gold colors?",
    });

    expect(result.project.accentColor).toBe(NAMED_COLORS.gold);
    expect(result.project.primaryColor).toBe(NAMED_COLORS.forestGreen);
    expect(result.explanation).toMatch(/should not have changed your brand/i);
    expect(result.explanation).not.toMatch(/shift the color palette to gold/i);
    expect(result.applyStatus).toBe("applied");
  });
});

describe("local fix scenarios", () => {
  it("local fix with image uses overlay", async () => {
    const result = await runAtlasBrain({
      project: greenGoldProject({ heroImageId: "img", heroOverlay: 25 }),
      request: "The hero text is hard to see.",
    });
    expect(result.applyStatus).toBe("applied");
    expect(result.project.heroOverlay).toBeGreaterThanOrEqual(50);
    expect(result.project.accentColor).toBe(NAMED_COLORS.gold);
  });

  it("local fix without image does not rewrite background palette", async () => {
    const before = greenGoldProject({
      heroImageId: null,
      heroOverlay: 0,
      headingFont: "playfair",
      creativePolish: { spacing: "default", visualHierarchy: false },
    });
    const result = await runAtlasBrain({
      project: before,
      request: "Make the words in the hero section easier to read.",
    });
    expect(result.project.backgroundColor).toBe(before.backgroundColor);
    expect(result.project.accentColor).toBe(NAMED_COLORS.gold);
    expect(result.operations.some((op) => op.operation === "changeTheme")).toBe(
      false,
    );
  });

  it("already-readable hero is a truthful no-op", async () => {
    const result = await runAtlasBrain({
      project: greenGoldProject({
        heroImageId: null,
        heroOverlay: 50,
        headingFont: "inter",
        creativePolish: { spacing: "airy", visualHierarchy: true },
      }),
      request: "Make the hero words easier to read.",
    });
    expect(result.applyStatus).toBe("no_changes");
    expect(result.explanation).toMatch(/already|strong contrast/i);
  });

  it("preview/publish share overlay token", () => {
    const before = greenGoldProject({ heroOverlay: 0 });
    const ops = validateEditOperations(
      planHeroReadabilityOperations(before).operations,
    );
    const after = applyEditOperations(before, ops).project;
    const token = String(after.heroOverlay / 100);
    const style = buildSiteDesignStyle(after) as Record<string, string>;
    expect(style["--site-hero-overlay"]).toBe(token);
    expect(buildStaticSiteCss(after)).toContain(`--site-hero-overlay: ${token}`);
  });

  it("undo snapshot keeps palette before hero treatment", async () => {
    const before = greenGoldProject({ heroOverlay: 0 });
    const result = await runAtlasBrain({
      project: before,
      request: "Make the words in the hero section easier to read.",
    });
    const last = getLastExecution(
      result.project.atlasActionMemory as Parameters<
        typeof getLastExecution
      >[0],
    );
    expect(last?.paletteBefore?.accentColor).toBe(NAMED_COLORS.gold);
    expect(last?.scope).toBe("hero");
  });
});
