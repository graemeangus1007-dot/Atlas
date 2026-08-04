/**
 * v1.3.2 — Hero readability vs image visibility tradeoff repair.
 */

import { beforeAll, describe, expect, it } from "vitest";
import {
  decideWithAtlasBrainEngine,
} from "@/lib/ai/atlas-brain-decision-engine";
import {
  getLastExecution,
  shouldExecuteActionMemory,
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
  analyzeHeroVisualBalance,
  isHeroImageVisibilityComplaint,
  planHeroBalanceRepair,
  verifyHeroBalanceRepair,
} from "@/lib/ai/hero-visual-balance";

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

function activePlanMemory() {
  return storeRecommendations(undefined, {
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
}

describe("routing — image visibility complaints", () => {
  it.each([
    "But now the image is hard to see.",
    "The photo is too dark now.",
    "You covered too much of the image.",
    "Keep the text readable but show more of the photo.",
    "The overlay is too strong.",
    "I can read the text now, but the image disappeared.",
    "Keep the words readable but show more of the image.",
  ])("detects: %s", (phrase) => {
    expect(isHeroImageVisibilityComplaint(phrase)).toBe(true);
  });

  it("never routes through Action Memory", () => {
    const memory = activePlanMemory();
    expect(
      shouldExecuteActionMemory("But now the image is hard to see.", memory),
    ).toBe(false);
    expect(
      shouldExecuteActionMemory("The photo is too dark now.", memory),
    ).toBe(false);
  });

  it("decision engine selects hero_balance", () => {
    const decided = decideWithAtlasBrainEngine({
      project: greenGoldProject({ heroOverlay: 100 }),
      request: "But now the image is hard to see.",
    });
    expect(decided.commandKind).toBe("hero_balance");
    expect(decided.decision.shouldExecuteEdits).toBe(true);
  });
});

describe("conversation — readability then image visibility", () => {
  it("second message routes to balance repair, not empty Action Memory", async () => {
    const withPlan = {
      ...greenGoldProject({ heroOverlay: 25 }),
      atlasActionMemory: activePlanMemory(),
    };

    const first = await runAtlasBrain({
      project: withPlan,
      request: "I can’t read the words in the hero.",
    });
    expect(first.applyStatus).toBe("applied");
    expect(first.project.heroOverlay).toBeGreaterThan(withPlan.heroOverlay);
    expect(first.decision?.commandKind).toBe("hero_readability");

    const second = await runAtlasBrain({
      project: {
        ...first.project,
        atlasActionMemory: {
          ...(first.project.atlasActionMemory ?? activePlanMemory()),
          ...activePlanMemory(),
          lastExecution: first.project.atlasActionMemory?.lastExecution,
        },
      },
      request: "But now the image is hard to see.",
    });

    expect(second.explanation).not.toMatch(
      /don’t have applyable improvements queued/i,
    );
    expect(second.decision?.commandKind).toBe("hero_balance");
    expect(second.applyStatus).toBe("applied");
    // Overlay may stay at the readability floor; localization must still run.
    expect(second.project.heroOverlay).toBeLessThanOrEqual(
      first.project.heroOverlay,
    );
    expect(second.project.heroTreatment?.gradient?.direction).toBe("bottom");
    expect(second.project.heroTreatment?.textScrim?.enabled).toBe(true);
    expect(second.project.accentColor).toBe(NAMED_COLORS.gold);
    expect(second.project.primaryColor).toBe(NAMED_COLORS.forestGreen);
    expect(second.explanation).toMatch(/photo is more visible|readable/i);

    const beforeBal = analyzeHeroVisualBalance(first.project);
    const afterBal = analyzeHeroVisualBalance(second.project);
    expect(afterBal.imageVisibilityScore).toBeGreaterThan(
      beforeBal.imageVisibilityScore,
    );
    expect(afterBal.textReadabilityScore).toBeGreaterThanOrEqual(62);
  });
});

describe("treatment selection", () => {
  it("prefers directional gradient + local scrim over flat overlay alone", () => {
    const project = greenGoldProject({ heroOverlay: 100 });
    const plan = planHeroBalanceRepair({
      project,
      request: "The photo is too dark now.",
    });
    expect(plan.maxSafeBalance).toBe(false);
    expect(plan.targetOverlay).toBeLessThan(100);
    expect(plan.treatment.gradient?.direction).toBe("bottom");
    expect(plan.treatment.textScrim?.enabled).toBe(true);
    expect(
      plan.operations.some((op) => op.operation === "setHeroTreatment"),
    ).toBe(true);
  });

  it("localizes when overlay cannot reduce further but treatments missing", () => {
    const project = greenGoldProject({
      heroOverlay: 50,
      heroTreatment: undefined,
    });
    // Score may keep floor at 50 — still apply gradient/scrim.
    const plan = planHeroBalanceRepair({
      project,
      request: "Keep the words readable but show more of the image.",
    });
    expect(plan.operations.length).toBeGreaterThan(0);
    expect(plan.treatment.gradient).toBeTruthy();
    expect(plan.treatment.textScrim?.enabled).toBe(true);
  });

  it("reports maximum safe balance and image/crop recommendation", () => {
    const project = greenGoldProject({
      heroOverlay: 50,
      heroTreatment: {
        gradient: { direction: "bottom", strength: 0.7, coverage: 0.62 },
        textScrim: { enabled: true, opacity: 0.42, blur: 8 },
      },
    });
    const plan = planHeroBalanceRepair({
      project,
      request: "The overlay is too strong.",
    });
    expect(plan.maxSafeBalance).toBe(true);
    expect(plan.operations).toHaveLength(0);
    expect(plan.explanation).toMatch(/crop or focal point|replacing the photo/i);
  });

  it("preserves brand palette through verification", () => {
    const before = greenGoldProject({ heroOverlay: 100 });
    const plan = planHeroBalanceRepair({
      project: before,
      request: "But now the image is hard to see.",
    });
    const ops = validateEditOperations(plan.operations);
    const after = applyEditOperations(before, ops).project;
    const check = verifyHeroBalanceRepair({
      before,
      after,
      assessmentBefore: plan.assessmentBefore,
    });
    expect(check.globalPaletteChanged).toBe(false);
    expect(check.verified).toBe(true);
    expect(after.accentColor).toBe(NAMED_COLORS.gold);
    expect(after.primaryColor).toBe(NAMED_COLORS.forestGreen);
  });
});

describe("persistence / preview parity", () => {
  it("persists heroBalance on lastExecution", async () => {
    const darkened = greenGoldProject({ heroOverlay: 100 });
    const result = await runAtlasBrain({
      project: darkened,
      request: "But now the image is hard to see.",
    });
    const last = getLastExecution(
      result.project.atlasActionMemory as Parameters<
        typeof getLastExecution
      >[0],
    );
    expect(last?.operationTypes).toContain("setHeroTreatment");
    expect(last?.heroBalance?.gradientApplied).toBe(true);
    expect(last?.heroBalance?.scrimApplied).toBe(true);
    expect(last?.heroBalance?.imageVisibilityAfter).toBeGreaterThan(
      last?.heroBalance?.imageVisibilityBefore ?? 0,
    );
    expect(last?.scope).toBe("hero");
    expect(last?.paletteBefore?.accentColor).toBe(NAMED_COLORS.gold);
  });

  it("preview and publish share treatment tokens", async () => {
    const result = await runAtlasBrain({
      project: greenGoldProject({ heroOverlay: 100 }),
      request: "The photo is too dark now.",
    });
    const style = buildSiteDesignStyle(result.project) as Record<
      string,
      string
    >;
    const css = buildStaticSiteCss(result.project);
    expect(Number(style["--site-hero-overlay"])).toBeLessThan(1);
    expect(Number(style["--site-hero-gradient-opacity"])).toBeGreaterThan(0);
    expect(Number(style["--site-hero-scrim-opacity"])).toBeGreaterThan(0);
    expect(css).toContain("--site-hero-gradient-opacity");
    expect(css).toContain("--site-hero-scrim-opacity");
    expect(css).toContain(".site-hero-gradient");
    expect(css).toContain(".site-hero-text-scrim");
  });

  it("max-safe brain response is truthful, not empty Action Memory", async () => {
    const project = greenGoldProject({
      heroOverlay: 50,
      heroTreatment: {
        gradient: { direction: "bottom", strength: 0.8, coverage: 0.62 },
        textScrim: { enabled: true, opacity: 0.45, blur: 8 },
      },
      atlasActionMemory: activePlanMemory(),
    });
    const result = await runAtlasBrain({
      project,
      request: "You covered too much of the image.",
    });
    expect(result.explanation).not.toMatch(
      /don’t have applyable improvements queued/i,
    );
    expect(result.explanation).toMatch(/safely can|crop|replacing/i);
    expect(result.decision?.commandKind).toBe("hero_balance");
  });
});
