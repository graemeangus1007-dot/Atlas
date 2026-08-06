/**
 * @vitest-environment jsdom
 */
/**
 * P1 — Atomic hero pattern application tests.
 */

import { describe, expect, it, beforeAll } from "vitest";
import { render } from "@testing-library/react";
import SiteHero from "@/components/site/site-hero";
import { MOCK_BUSINESS_PROJECT } from "@/data/mock-project";
import {
  registerEditorPlanner,
  runAtlasBrain,
} from "@/lib/ai/atlas-brain";
import { planEditOperations } from "@/lib/ai/editor-agent";
import { getInteractionState } from "@/lib/ai/interaction-state";
import { assertScopedMutation } from "@/lib/ai/interaction-invariants";
import { applyEditOperations } from "@/lib/ai/apply-edit-operations";
import { validateEditOperations } from "@/lib/ai/validate-edit-operations";
import {
  EXECUTABLE_HERO_PATTERN_IDS,
  adaptHeroPatternComposition,
  explainHeroPatternApplication,
  heroPatternPreset,
  matchExplicitHeroPatternRequest,
  planHeroPatternApplication,
  verifyHeroPatternApplication,
  type ExecutableHeroPatternId,
} from "@/lib/ai/hero-pattern-application";
import { textExposesDesignPatternIds } from "@/lib/ai/design-patterns/registry";
import {
  pushEditorRevision,
  createEmptyRevisionStack,
  undoEditorRevision,
} from "@/lib/ai/editor-revisions";
import { buildHeroRenderPlan, heroParityContract } from "@/lib/hero-composition";
import { renderStaticSiteBody } from "@/lib/publishing/render/html";
import { getTemplate } from "@/lib/templates";
import { generateWebsiteContent } from "@/lib/website-generator";
import type { BusinessProject } from "@/types/business-project";

beforeAll(() => {
  registerEditorPlanner(planEditOperations);
});

function projectWithHero(
  overrides: Partial<BusinessProject> = {},
): BusinessProject {
  return {
    ...MOCK_BUSINESS_PROJECT,
    businessName: "Harborview Landscapes",
    businessType: "Contractor",
    description: "Premium outdoor living for coastal homes.",
    heroHeadline: "Outdoor spaces that feel finished",
    heroSubheadline: "Design, build, and care for yards that look intentional.",
    primaryCta: "Request a quote",
    secondaryCta: "View our work",
    primaryColor: "#1a3a2a",
    secondaryColor: "#2d5a3f",
    accentColor: "#c9a227",
    backgroundColor: "#0b1210",
    headingFont: "manrope",
    bodyFont: "inter",
    templateId: "modern",
    heroOverlay: 50,
    heroImageId: "hero-1",
    mediaLibrary: [
      {
        id: "hero-1",
        name: "hero.jpg",
        filename: "hero.jpg",
        url: "https://example.com/hero.jpg",
        storagePath: null,
        mimeType: "image/jpeg",
        size: 1024,
        sizeLabel: "1 KB",
        createdAt: Date.now(),
        title: "Hero",
        description: "",
        alt: "Hero photo",
      },
    ],
    galleryImageIds: ["", "", "", ""],
    heroComposition: null,
    ...overrides,
  };
}

describe("hero pattern presets", () => {
  it.each(EXECUTABLE_HERO_PATTERN_IDS)(
    "defines a deterministic preset for %s",
    (patternId) => {
      const a = heroPatternPreset(patternId);
      const b = heroPatternPreset(patternId);
      expect(a).toEqual(b);
      expect(a.patternId).toBe(patternId);
      expect(a.version).toBe(1);
      expect(a.layout).toBeTruthy();
      expect(a.minHeight).toBeTruthy();
      expect(a.mobile.layout).toBeTruthy();
    },
  );
});

describe("project-aware adaptation", () => {
  it("falls back from cinematic when no hero image", () => {
    const project = projectWithHero({ heroImageId: null, mediaLibrary: [] });
    const adapted = adaptHeroPatternComposition({
      patternId: "hero.cinematic_full_width",
      project,
    });
    expect(adapted.fallbackUsed).toBe(true);
    expect(adapted.patternId).toBe("hero.coastal_service");
  });

  it("keeps dual CTAs for contractor when secondary exists", () => {
    const adapted = adaptHeroPatternComposition({
      patternId: "hero.contractor_left",
      project: projectWithHero(),
    });
    expect(adapted.composition.typography.showSecondaryCta).toBe(true);
    expect(adapted.composition.contentAlignment).toBe("left");
  });

  it("allows premium minimal without imagery", () => {
    const adapted = adaptHeroPatternComposition({
      patternId: "hero.premium_minimal",
      project: projectWithHero({ heroImageId: null, mediaLibrary: [] }),
    });
    expect(adapted.patternId).toBe("hero.premium_minimal");
    expect(adapted.composition.treatment.overlay).toBe(0);
  });
});

describe("planner + apply + verify", () => {
  it.each(EXECUTABLE_HERO_PATTERN_IDS)(
    "plans, applies, and verifies %s",
    (patternId) => {
      const before = projectWithHero();
      const planned = planHeroPatternApplication({
        project: before,
        patternId,
      });
      expect(planned.blocked).toBe(false);
      expect(planned.operations).toHaveLength(1);
      expect(planned.operations[0]?.operation).toBe("applyHeroPattern");

      const ops = validateEditOperations(planned.operations);
      const applied = applyEditOperations(before, ops);
      const check = verifyHeroPatternApplication({
        before,
        after: applied.project,
        expected: planned.composition,
      });
      expect(check.verified).toBe(true);
      expect(applied.project.heroComposition?.patternId).toBe(
        planned.patternId,
      );
      expect(applied.project.templateId).toBe(before.templateId);
      expect(applied.project.primaryColor).toBe(before.primaryColor);
      expect(applied.project.headingFont).toBe(before.headingFont);
      expect(applied.project.heroImageId).toBe(before.heroImageId);
      assertScopedMutation(before, applied.project, "hero_composition");
    },
  );

  it("is idempotent when already satisfied", () => {
    const before = projectWithHero();
    const first = planHeroPatternApplication({
      project: before,
      patternId: "hero.cinematic_full_width",
    });
    const applied = applyEditOperations(
      before,
      validateEditOperations(first.operations),
    );
    const again = planHeroPatternApplication({
      project: applied.project,
      patternId: "hero.cinematic_full_width",
    });
    expect(again.alreadySatisfied).toBe(true);
    expect(again.operations).toHaveLength(0);
    expect(textExposesDesignPatternIds(again.explanation)).toBe(false);
  });

  it("clears residue when switching patterns", () => {
    const before = projectWithHero();
    const cinematic = applyEditOperations(
      before,
      validateEditOperations(
        planHeroPatternApplication({
          project: before,
          patternId: "hero.cinematic_full_width",
        }).operations,
      ),
    );
    expect(cinematic.project.heroComposition?.minHeight).toBe("viewport");
    const minimal = applyEditOperations(
      cinematic.project,
      validateEditOperations(
        planHeroPatternApplication({
          project: cinematic.project,
          patternId: "hero.premium_minimal",
        }).operations,
      ),
    );
    expect(minimal.project.heroComposition?.patternId).toBe(
      "hero.premium_minimal",
    );
    expect(minimal.project.heroComposition?.minHeight).toBe("short");
    expect(minimal.project.heroComposition?.accents.showAccentWash).toBe(false);
    expect(minimal.project.heroOverlay).toBe(0);
  });
});

describe("explanations", () => {
  it("never exposes internal pattern ids", () => {
    for (const patternId of EXECUTABLE_HERO_PATTERN_IDS) {
      const text = explainHeroPatternApplication({ patternId });
      expect(textExposesDesignPatternIds(text)).toBe(false);
      expect(text).not.toMatch(/hero\./i);
    }
  });
});

describe("NL matching", () => {
  it("matches explicit pattern requests", () => {
    expect(matchExplicitHeroPatternRequest("Use a cinematic hero")).toBe(
      "hero.cinematic_full_width",
    );
    expect(
      matchExplicitHeroPatternRequest("Make this a premium minimal hero"),
    ).toBe("hero.premium_minimal");
    expect(
      matchExplicitHeroPatternRequest("Give this a contractor-style hero"),
    ).toBe("hero.contractor_left");
    expect(matchExplicitHeroPatternRequest("Apply a coastal service hero")).toBe(
      "hero.coastal_service",
    );
  });
});

describe("Editor / Preview / Publish parity after apply", () => {
  it.each([
    "hero.cinematic_full_width",
    "hero.coastal_service",
    "hero.contractor_left",
    "hero.premium_minimal",
  ] as ExecutableHeroPatternId[])(
    "keeps surfaces aligned for %s",
    (patternId) => {
      const before = projectWithHero();
      const planned = planHeroPatternApplication({ project: before, patternId });
      const after = applyEditOperations(
        before,
        validateEditOperations(planned.operations),
      ).project;
      const content = generateWebsiteContent(after);
      const expected = heroParityContract(content.heroComposition);
      const template = getTemplate(after.templateId);

      const preview = render(
        <SiteHero
          content={content.hero}
          composition={content.heroComposition}
          testId="preview-hero"
        />,
      );
      const editor = render(
        <SiteHero
          content={content.hero}
          composition={content.heroComposition}
          testId="editor-hero"
        />,
      );
      const html = renderStaticSiteBody(content, template);

      const p = preview.getByTestId("preview-hero");
      const e = editor.getByTestId("editor-hero");
      expect(p.getAttribute("data-hero-composition-layout")).toBe(
        e.getAttribute("data-hero-composition-layout"),
      );
      expect(html).toContain(
        `data-hero-composition-layout="${expected.layout}"`,
      );
      expect(buildHeroRenderPlan(content.heroComposition).contract.mobileLayout).toBe(
        planned.composition.mobile.layout,
      );
      preview.unmount();
      editor.unmount();
    },
  );
});

describe("brain routing + active task", () => {
  it("applies cinematic on explicit request and sets activeTask after verify", async () => {
    const before = projectWithHero();
    const result = await runAtlasBrain({
      project: before,
      request: "Use a cinematic hero",
    });
    expect(result.applyStatus).toBe("applied");
    expect(result.project.heroComposition?.patternId).toBe(
      "hero.cinematic_full_width",
    );
    expect(result.project.templateId).toBe(before.templateId);
    expect(textExposesDesignPatternIds(result.explanation)).toBe(false);
    const task = getInteractionState(result.project).activeTask;
    expect(task?.kind).toBe("hero_composition");
    expect(task?.target?.type).toBe("hero");
    assertScopedMutation(before, result.project, "hero_composition");
  });

  it("preserves pattern during fit + readability refinements", async () => {
    const seeded = await runAtlasBrain({
      project: projectWithHero(),
      request: "Use a cinematic hero",
    });
    expect(seeded.project.heroComposition?.patternId).toBe(
      "hero.cinematic_full_width",
    );

    const fit = await runAtlasBrain({
      project: seeded.project,
      request: "Show the entire picture",
    });
    expect(fit.applyStatus).toBe("applied");
    expect(fit.project.heroComposition?.patternId).toBe(
      "hero.cinematic_full_width",
    );
    expect(fit.project.templateId).toBe(seeded.project.templateId);

    const readable = await runAtlasBrain({
      project: fit.project,
      request: "Make the hero text easier to read",
    });
    expect(readable.project.heroComposition?.patternId).toBe(
      "hero.cinematic_full_width",
    );
    expect(readable.project.primaryColor).toBe(seeded.project.primaryColor);
  });

  it("does not set activeTask when verification fails (no churn on blocked)", async () => {
    // Force a blocked plan by asking for cinematic with no image — should fall back, not fail.
    const result = await runAtlasBrain({
      project: projectWithHero({ heroImageId: null, mediaLibrary: [] }),
      request: "Use a cinematic hero",
    });
    expect(result.applyStatus).toBe("applied");
    expect(result.project.heroComposition?.patternId).toBe(
      "hero.coastal_service",
    );
  });
});

describe("undo/redo + refresh", () => {
  it("supports one undo step for pattern apply", () => {
    const before = projectWithHero();
    const planned = planHeroPatternApplication({
      project: before,
      patternId: "hero.contractor_left",
    });
    const ops = validateEditOperations(planned.operations);
    const applied = applyEditOperations(before, ops);
    let stack = createEmptyRevisionStack();
    stack = pushEditorRevision(stack, {
      before,
      after: applied.project,
      operations: ops,
      changes: applied.changes,
      prompt: "Give this a contractor-style hero",
    });
    const undone = undoEditorRevision(stack);
    expect(undone?.project.heroComposition?.patternId ?? null).toBeNull();
    expect(undone?.project.heroOverlay).toBe(before.heroOverlay);
  });

  it("persists pattern across JSON refresh", () => {
    const before = projectWithHero();
    const applied = applyEditOperations(
      before,
      validateEditOperations(
        planHeroPatternApplication({
          project: before,
          patternId: "hero.coastal_service",
        }).operations,
      ),
    ).project;
    const refreshed = JSON.parse(JSON.stringify(applied)) as BusinessProject;
    expect(refreshed.heroComposition?.patternId).toBe("hero.coastal_service");
    const content = generateWebsiteContent(refreshed);
    expect(content.heroComposition.patternId).toBe("hero.coastal_service");
  });
});

describe("failed verification", () => {
  it("rejects when brand palette is mutated", () => {
    const before = projectWithHero();
    const planned = planHeroPatternApplication({
      project: before,
      patternId: "hero.premium_minimal",
    });
    const applied = applyEditOperations(
      before,
      validateEditOperations(planned.operations),
    );
    const tampered = {
      ...applied.project,
      primaryColor: "#ff0000",
    };
    const check = verifyHeroPatternApplication({
      before,
      after: tampered,
      expected: planned.composition,
    });
    expect(check.verified).toBe(false);
    expect(check.failures.join(" ")).toMatch(/global_theme|scope_violation/);
  });
});

