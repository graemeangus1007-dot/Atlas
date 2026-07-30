/**
 * Sprint 28.3 — plan ordinals, section reorder, motion truthfulness.
 */

import { beforeAll, describe, expect, it } from "vitest";
import {
  detectActionConfirmation,
  resolvePlanReference,
  selectRecommendationsToApply,
  storeRecommendations,
  type AtlasStoredRecommendation,
} from "@/lib/ai/atlas-action-memory";
import {
  registerEditorPlanner,
  runAtlasBrain,
} from "@/lib/ai/atlas-brain";
import { decideWithAtlasBrainEngine } from "@/lib/ai/atlas-brain-decision-engine";
import { applyEditOperations } from "@/lib/ai/apply-edit-operations";
import { planEditOperations } from "@/lib/ai/editor-agent";
import { validateEditOperations } from "@/lib/ai/validate-edit-operations";
import {
  getEffectiveSectionOrder,
  parseSectionMoveRequest,
} from "@/lib/ai/section-order";
import {
  isMotionStateActive,
  readMotionState,
} from "@/lib/ai/motion-model";
import { renderStaticSiteBody } from "@/lib/publishing/render/html";
import { buildStaticSiteCss } from "@/lib/publishing/styles/site-css";
import { getTemplate } from "@/lib/templates";
import { generateWebsiteContent } from "@/lib/website-generator";
import { MOCK_BUSINESS_PROJECT } from "@/data/mock-project";
import type { CreativeDirectorRecommendation } from "@/lib/ai/creative-director-types";
import type { BusinessProject } from "@/types/business-project";

beforeAll(() => {
  registerEditorPlanner(planEditOperations);
});

function sampleProject(
  overrides: Partial<BusinessProject> = {},
): BusinessProject {
  return {
    ...MOCK_BUSINESS_PROJECT,
    businessName: "Northwind Spa",
    creativePolish: undefined,
    atlasActionMemory: undefined,
    sectionOrder: ["hero", "about", "services", "features", "gallery", "contact"],
    designSections: {
      enabled: ["testimonials", "faq"],
      testimonials: [
        { quote: "Wonderful.", author: "Alex", role: "Guest" },
      ],
      faq: [{ question: "Hours?", answer: "Daily 9–6." }],
    },
    ...overrides,
  };
}

function creativeRec(
  partial: Partial<CreativeDirectorRecommendation> &
    Pick<CreativeDirectorRecommendation, "id" | "title" | "kind">,
): CreativeDirectorRecommendation {
  return {
    explanation: partial.title,
    impact: "high",
    impactScore: 80,
    confidence: 0.9,
    operations: [{ operation: "setCreativePolish", serviceIcons: true }],
    capabilityIds: [],
    applyable: true,
    estimatedTime: "<10 seconds",
    ...partial,
  };
}

function storedRec(
  partial: Partial<AtlasStoredRecommendation> &
    Pick<AtlasStoredRecommendation, "id" | "title">,
): AtlasStoredRecommendation {
  return {
    source: "creative_director",
    kind: "visual",
    applyable: true,
    operations: [{ operation: "setCreativePolish", serviceIcons: true }],
    ...partial,
  };
}

describe("Sprint 28.3 — ordinal plan references", () => {
  it("resolves Apply the second one to recommendation 2", () => {
    const memory = storeRecommendations(undefined, {
      creative: [
        creativeRec({ id: "r1", kind: "visual", title: "Add icons" }),
        creativeRec({
          id: "r2",
          kind: "content",
          title: "Strengthen hero",
          operations: [
            {
              operation: "replaceText",
              target: "hero.title",
              value: "Clearer headline",
            },
          ],
        }),
        creativeRec({
          id: "r3",
          kind: "motion",
          title: "Add motion",
          operations: [{ operation: "setCreativePolish", motion: true }],
        }),
      ],
    });

    const second = resolvePlanReference("Apply the second one", memory);
    expect(second.matched).toBe(true);
    expect(second.ordinal).toBe(2);
    expect(second.recommendationId).toBe("r2");

    const conf = detectActionConfirmation("Apply the second one");
    expect(conf.kind).toBe("ordinal");
    expect(conf.ordinalIndex).toBe(1);

    const selected = selectRecommendationsToApply(memory, conf);
    expect(selected).toHaveLength(1);
    expect(selected[0]?.id).toBe("r2");
  });

  it("applies the third recommendation without clarification", async () => {
    const memory = storeRecommendations(undefined, {
      creative: [
        creativeRec({ id: "a", kind: "visual", title: "First" }),
        creativeRec({
          id: "b",
          kind: "content",
          title: "Second",
          operations: [
            {
              operation: "replaceText",
              target: "hero.subheadline",
              value: "Sharper subhead",
            },
          ],
        }),
        creativeRec({
          id: "c",
          kind: "motion",
          title: "Third",
          operations: [
            {
              operation: "setCreativePolish",
              motion: true,
              motionPreset: "subtle",
              sectionReveal: true,
              hoverEffects: true,
            },
          ],
        }),
      ],
    });

    const result = await runAtlasBrain({
      project: sampleProject({ atlasActionMemory: memory }),
      request: "Apply the third one",
    });

    expect(result.applyStatus).toBe("applied");
    expect(result.explanation.toLowerCase()).not.toMatch(
      /better visuals|better copy|better conversions|did you mean/i,
    );
    expect(result.project.creativePolish?.motion).toBe(true);
    expect(result.explanation).toMatch(/1 recommendation applied/i);
  });

  it("asks one precise question for Apply number 99", async () => {
    const memory = storeRecommendations(undefined, {
      creative: [creativeRec({ id: "only", kind: "visual", title: "Only one" })],
    });

    const result = await runAtlasBrain({
      project: sampleProject({ atlasActionMemory: memory }),
      request: "Apply number 99",
    });

    expect(result.applyStatus).toBe("needs_clarification");
    expect(result.explanation).toMatch(/only 1 recommendation/i);
    expect(result.explanation.toLowerCase()).not.toMatch(
      /better visuals|better copy|better conversions/i,
    );
    expect(result.project.atlasActionMemory?.recommendations?.length).toBe(1);
  });

  it("keeps stable recommendation ids after refresh-shaped memory", () => {
    const memory = storeRecommendations(undefined, {
      creative: [
        creativeRec({
          id: "stable.gallery",
          kind: "visual",
          title: "Improve gallery",
          operations: [
            { operation: "setCreativePolish", visualHierarchy: true },
          ],
        }),
      ],
    });
    const persisted = JSON.parse(JSON.stringify(memory));
    const ref = resolvePlanReference(
      "Just the gallery recommendation",
      persisted,
    );
    expect(ref.matched).toBe(true);
    expect(ref.recommendationId).toBe("stable.gallery");
  });

  it("does not falsely apply unsupported ordinal recommendations", async () => {
    const memory = {
      ...storeRecommendations(undefined, { creative: [] }),
      recommendations: [
        storedRec({
          id: "u1",
          title: "Manual photography shoot",
          applyable: false,
          operations: [],
        }),
        storedRec({
          id: "u2",
          title: "Add icons",
          applyable: true,
        }),
      ],
      recommendationIds: ["u1", "u2"],
      applyAllPending: true,
      updatedAt: new Date().toISOString(),
    };

    const result = await runAtlasBrain({
      project: sampleProject({ atlasActionMemory: memory }),
      request: "Apply the first one",
    });

    expect(result.applyStatus).toBe("no_changes");
    expect(result.explanation).toMatch(/isn’t.*(applyable|automatically)/i);
    expect(result.explanation.toLowerCase()).not.toMatch(/better visuals/i);
  });
});

describe("Sprint 28.3 — section reordering", () => {
  it("moves contact to the bottom of the site", async () => {
    const project = sampleProject({
      sectionOrder: [
        "hero",
        "about",
        "contact",
        "services",
        "features",
        "gallery",
      ],
    });

    const engine = decideWithAtlasBrainEngine({
      project,
      request: "Move the contact section to the bottom of the site",
    });
    expect(engine.commandKind).toBe("section_order");
    expect(engine.decision.needsClarification).toBe(false);

    const result = await runAtlasBrain({
      project,
      request: "Move the contact section to the bottom of the site",
    });

    expect(result.applyStatus).toBe("applied");
    expect(result.explanation.toLowerCase()).not.toMatch(
      /better visuals|better copy|better conversions/i,
    );
    const order = result.project.sectionOrder ?? [];
    expect(order[0]).toBe("hero");
    expect(order[order.length - 1]).toBe("contact");
  });

  it("puts testimonials above services", async () => {
    const project = sampleProject({
      sectionOrder: [
        "hero",
        "about",
        "services",
        "features",
        "gallery",
        "testimonials",
        "faq",
        "contact",
      ],
    });

    const parsed = parseSectionMoveRequest("Put testimonials above services");
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.intent.section).toBe("testimonials");
      expect(parsed.intent.position).toBe("before");
      expect(parsed.intent.relativeTo).toBe("services");
    }

    const result = await runAtlasBrain({
      project,
      request: "Put testimonials above services",
    });

    expect(result.applyStatus).toBe("applied");
    const order = getEffectiveSectionOrder(result.project);
    expect(order.indexOf("testimonials")).toBeLessThan(
      order.indexOf("services"),
    );
    expect(order[0]).toBe("hero");
  });

  it("supports section-order undo via inverse move", () => {
    const before = sampleProject({
      sectionOrder: ["hero", "about", "services", "contact"],
    });
    const forward = validateEditOperations([
      {
        operation: "moveSection",
        section: "about",
        position: "after",
        relativeTo: "services",
      },
    ]);
    const applied = applyEditOperations(before, forward);
    expect(applied.project.sectionOrder).toEqual([
      "hero",
      "services",
      "about",
      "contact",
    ]);

    const restore = applyEditOperations(applied.project, [
      {
        operation: "moveSection",
        section: "about",
        position: "before",
        relativeTo: "services",
      },
    ]);
    expect(restore.project.sectionOrder).toEqual([
      "hero",
      "about",
      "services",
      "contact",
    ]);
  });
});

describe("Sprint 28.3 — motion truthfulness", () => {
  it("implements smooth scroll animations with persisted + rendered change", async () => {
    const project = sampleProject({ creativePolish: undefined });
    const result = await runAtlasBrain({
      project,
      request: "Implement smooth scroll animations",
    });

    expect(result.applyStatus).toBe("applied");
    expect(result.explanation.toLowerCase()).not.toMatch(
      /no changes needed|already matched/i,
    );
    expect(result.project.creativePolish?.motion).toBe(true);
    expect(result.project.creativePolish?.motionPreset).toBe("subtle");
    expect(result.project.creativePolish?.sectionReveal).toBe(true);

    const content = generateWebsiteContent(result.project);
    const template = getTemplate(result.project.templateId || "modern");
    const html = renderStaticSiteBody(content, template);
    expect(html).toMatch(/data-motion="on"/);
    expect(html).toMatch(/data-section-reveal="on"/);

    const css = buildStaticSiteCss(result.project);
    expect(css).toMatch(/site-section-reveal/);
    expect(css).toMatch(/prefers-reduced-motion/);
  });

  it("says motion style is already active when exact preset matches", async () => {
    const project = sampleProject({
      creativePolish: {
        motion: true,
        motionPreset: "subtle",
        sectionReveal: true,
        hoverEffects: true,
        respectReducedMotion: true,
      },
    });
    expect(isMotionStateActive(project, "subtle")).toBe(true);

    const result = await runAtlasBrain({
      project,
      request: "Implement smooth scroll animations",
    });

    expect(result.applyStatus).toBe("no_changes");
    expect(result.explanation).toMatch(/already active/i);
    expect(result.explanation.toLowerCase()).not.toMatch(
      /no changes needed — the site already matched/i,
    );
  });

  it("removes all animations while preserving reduced-motion behavior", async () => {
    const project = sampleProject({
      creativePolish: {
        motion: true,
        motionPreset: "subtle",
        sectionReveal: true,
        hoverEffects: true,
      },
    });

    const result = await runAtlasBrain({
      project,
      request: "Remove all animations",
    });

    expect(result.applyStatus).toBe("applied");
    const motion = readMotionState(result.project);
    expect(motion.preset).toBe("none");
    expect(motion.motion).toBe(false);
    expect(motion.respectReducedMotion).toBe(true);

    const css = buildStaticSiteCss(result.project);
    expect(css).toMatch(/prefers-reduced-motion/);
  });
});

describe("Sprint 28.3 — summary dedupe", () => {
  it("dedupes repeated operation summary labels", () => {
    const project = sampleProject();
    const ops = validateEditOperations([
      { operation: "setButtonStyle", value: "rounded" },
      { operation: "setButtonStyle", value: "pill" },
      { operation: "setSiteWidth", value: "boxed" },
      { operation: "setSiteWidth", value: "wide" },
      { operation: "setTemplate", value: "elegant" },
      { operation: "setTemplate", value: "modern" },
    ]);
    const applied = applyEditOperations(project, ops);
    const labels = applied.changes.map((c) => c.label);
    expect(labels.filter((l) => l === "Buttons updated")).toHaveLength(1);
    expect(labels.filter((l) => l === "Whitespace adjusted")).toHaveLength(1);
    expect(labels.filter((l) => l === "Layout refreshed")).toHaveLength(1);
  });
});
