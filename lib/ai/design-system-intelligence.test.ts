/**
 * Sprint 27.0A — Atlas Design System Intelligence regression tests.
 */

import { describe, expect, it } from "vitest";
import {
  attachDesignSystem,
  designSystemInputFromProject,
  designSystemToOperations,
  detectPreferredLanguage,
  DESIGN_LANGUAGES,
  resolveDesignSystem,
} from "@/lib/ai/design-system-intelligence";
import { DESIGN_LANGUAGE_IDS } from "@/lib/ai/design-system-types";
import {
  buildCreativeRecommendations,
  reviewCreativeDirector,
} from "@/lib/ai/creative-director";
import { decideAtlasBrain, registerEditorPlanner, runAtlasBrain } from "@/lib/ai/atlas-brain";
import { planEditOperations } from "@/lib/ai/editor-agent";
import { MOCK_BUSINESS_PROJECT } from "@/data/mock-project";
import type { BusinessProject } from "@/types/business-project";

registerEditorPlanner(planEditOperations);

function sampleProject(
  overrides: Partial<BusinessProject> = {},
): BusinessProject {
  return {
    ...MOCK_BUSINESS_PROJECT,
    businessName: "Linda's Cookies",
    businessType: "Restaurant",
    description: "Artisan bakery and catering",
    goals: ["Get more customers"],
    designSystem: undefined,
    atlasMemory: undefined,
    creativePolish: undefined,
    ...overrides,
  };
}

describe("deterministic style selection", () => {
  it("maps every built-in language to a complete DesignSystem", () => {
    for (const id of DESIGN_LANGUAGE_IDS) {
      const def = DESIGN_LANGUAGES[id];
      expect(def.id).toBe(id);
      expect(def.typography.headingFont).toBeTruthy();
      expect(def.colorStrategy.primary).toMatch(/^#/);
      expect(def.sectionHierarchy.length).toBeGreaterThan(0);
      const ops = designSystemToOperations(
        resolveDesignSystem({ preferredLanguage: id }).designSystem,
      );
      expect(ops.some((op) => op.operation === "setTypography")).toBe(true);
      expect(ops.some((op) => op.operation === "changeTheme")).toBe(true);
    }
  });

  it("selects luxury when preferredLanguage is luxury", () => {
    const result = resolveDesignSystem({ preferredLanguage: "luxury" });
    expect(result.designSystem.language).toBe("luxury");
    expect(result.designSystem.typography.headingFont).toBe("playfair");
    expect(result.designSystem.motionStyle).toBe("restrained");
    expect(result.designSystem.spacing).toBe("generous");
    expect(result.autoApply).toBe(true);
  });

  it("is stable across repeated calls with the same input", () => {
    const input = {
      businessType: "Contractor" as const,
      goals: ["Get more customers"],
      userGoal: "I need more phone calls",
    };
    const a = resolveDesignSystem(input);
    const b = resolveDesignSystem(input);
    expect(a.designSystem.language).toBe(b.designSystem.language);
    expect(a.designSystem.colorStrategy.primary).toBe(
      b.designSystem.colorStrategy.primary,
    );
  });
});

describe("industry mapping", () => {
  it("maps restaurants to the restaurant language", () => {
    const result = resolveDesignSystem({
      businessType: "Restaurant",
      industry: "fine dining restaurant",
    });
    expect(result.designSystem.language).toBe("restaurant");
    expect(result.designSystem.imageryStyle).toBe("food_first");
  });

  it("maps medical / dental copy to medical", () => {
    const result = resolveDesignSystem({
      industry: "family dental clinic",
      businessType: "Other",
    });
    expect(result.designSystem.language).toBe("medical");
    expect(result.designSystem.colorStrategy.principle.toLowerCase()).toMatch(
      /blue|trust|calm/,
    );
  });

  it("maps contractors to trades", () => {
    const result = resolveDesignSystem({
      businessType: "Contractor",
      industry: "residential plumbing contractor",
    });
    expect(result.designSystem.language).toBe("trades");
    expect(result.designSystem.buttonLanguage).toBe("urgent");
    expect(result.designSystem.imageryStyle).toBe("before_after");
  });
});

describe("business-goal influence", () => {
  it("boosts photography / creative when the goal is a portfolio", () => {
    const result = resolveDesignSystem({
      businessType: "Other",
      industry: "independent photographer",
      goals: ["Display portfolio"],
    });
    expect(["photography", "creative"]).toContain(result.designSystem.language);
  });

  it("boosts restaurant for catering / order goals", () => {
    const result = resolveDesignSystem({
      businessType: "Coffee Shop",
      userGoal: "I want more catering orders",
      goals: ["Accept online orders"],
    });
    expect(result.designSystem.language).toBe("restaurant");
  });
});

describe("memory influence", () => {
  it("prefers luxury when memory tone is luxury", () => {
    const result = resolveDesignSystem({
      businessType: "Retail Store",
      memory: { businessTone: "luxury", preferredLayouts: ["elegant"] },
    });
    expect(result.designSystem.language).toBe("luxury");
  });

  it("prefers minimal when memory prefers minimalist layouts", () => {
    const result = resolveDesignSystem({
      businessType: "Other",
      memory: { preferredLayouts: ["minimalist"], businessTone: "minimal" },
    });
    expect(result.designSystem.language).toBe("minimal");
  });
});

describe("consistency", () => {
  it("detects design-language aliases from free text", () => {
    expect(detectPreferredLanguage("Make it Scandinavian")).toBe(
      "scandinavian",
    );
    expect(detectPreferredLanguage("Apple-like simplicity please")).toBe(
      "premium_saas",
    );
    expect(detectPreferredLanguage("more luxurious")).toBe("luxury");
  });

  it("attaches a persisted design system snapshot", () => {
    const resolution = resolveDesignSystem({ preferredLanguage: "modern" });
    const next = attachDesignSystem(
      sampleProject(),
      resolution.designSystem,
    );
    expect(next.designSystem?.language).toBe("modern");
    expect(next.designSystem?.label).toBe("Modern");
    expect(next.atlasMemory?.preferredLayouts).toContain("modern");
  });

  it("builds input from a BusinessProject", () => {
    const input = designSystemInputFromProject(
      sampleProject({
        businessType: "Salon",
        atlasMemory: { businessTone: "warm" },
      }),
      "make it boutique",
    );
    expect(input.preferredLanguage).toBe("boutique");
    expect(input.businessType).toBe("Salon");
  });
});

describe("integration with Creative Director", () => {
  it("references the design language in review narrative", () => {
    const project = sampleProject({
      designSystem: {
        language: "luxury",
        label: "Luxury",
        imageryStyle: "large_hero",
        motionStyle: "restrained",
        explanation: "Chosen for premium craft.",
        confidence: 0.9,
        selectedAt: new Date().toISOString(),
      },
    });
    const report = reviewCreativeDirector({ project });
    expect(report.narrative.toLowerCase()).toContain("luxury");
    const recs = buildCreativeRecommendations(project);
    expect(recs.length).toBeGreaterThan(0);
    expect(
      recs.some((r) => r.explanation.toLowerCase().includes("luxury")),
    ).toBe(true);
  });
});

describe("Brain routing", () => {
  it("routes feel / design-language requests through feel_direction", () => {
    const decision = decideAtlasBrain({
      project: sampleProject(),
      request: "Make this website feel more luxurious.",
    });
    expect(decision.intent).toBe("feel_direction");
    expect(decision.selectedAgents).toContain("creative_director");
    expect(decision.selectedAgents).toContain("editor_agent");
  });

  it("auto-applies a design system on feel_direction when confident", () => {
    const result = runAtlasBrain({
      project: sampleProject({ businessType: "Restaurant" }),
      request: "Make this feel more luxurious.",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.project.designSystem?.language).toBe("luxury");
    expect(result.explanation.toLowerCase()).toMatch(/luxury|luxurious/);
  });
});
