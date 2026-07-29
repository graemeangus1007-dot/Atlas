/**
 * Sprint 26.2 — Atlas Brain Decision Engine regression tests.
 */

import { describe, expect, it } from "vitest";
import {
  CONFIDENCE_CLARIFY,
  CONFIDENCE_EXECUTE_EXPLAIN,
  decideWithAtlasBrainEngine,
  formatNaturalPreferenceNote,
  stageExplicitCommand,
} from "@/lib/ai/atlas-brain-decision-engine";
import {
  decideAtlasBrain,
  registerEditorPlanner,
  runAtlasBrain,
} from "@/lib/ai/atlas-brain";
import { storeRecommendations } from "@/lib/ai/atlas-action-memory";
import { planEditOperations } from "@/lib/ai/editor-agent";
import { MOCK_BUSINESS_PROJECT } from "@/data/mock-project";
import type { BusinessProject } from "@/types/business-project";
import type { MediaAsset } from "@/types/media";

registerEditorPlanner(planEditOperations);

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
    businessType: "Restaurant",
    mediaLibrary: [asset("asset-cookies", "fresh cookies")],
    heroImageId: null,
    galleryImageIds: ["", "", "", ""],
    designSections: undefined,
    creativePolish: undefined,
    atlasMemory: {
      primaryGoal: "leads",
      preferredThemes: ["light"],
      preferredLayouts: ["minimal"],
      businessTone: "warm",
    },
    atlasActionMemory: undefined,
    ...overrides,
  };
}

describe("Apply All / Yes / Go ahead continuation", () => {
  it("continues the active plan for Apply All without restarting routing", () => {
    const memory = storeRecommendations(undefined, {
      creative: [
        {
          id: "visual.icons",
          kind: "visual",
          title: "Add icons",
          explanation: "Icons help scanning.",
          impact: "high",
          impactScore: 90,
          confidence: 0.9,
          operations: [
            { operation: "setCreativePolish", serviceIcons: true },
          ],
          capabilityIds: ["icons"],
          applyable: true,
          estimatedTime: "<10 seconds",
        },
      ],
    });
    const project = sampleProject({ atlasActionMemory: memory });
    const engine = decideWithAtlasBrainEngine({
      project,
      request: "Apply All",
    });
    expect(engine.stage).toBe("continuation");
    expect(engine.decision.intent).toBe("continue_plan");
    expect(engine.decision.needsClarification).toBe(false);
    expect(engine.decision.confidence).toBeGreaterThanOrEqual(0.95);

    const result = runAtlasBrain({ project, request: "Apply All" });
    expect(result.applyStatus).toBe("applied");
    expect(result.explanation.toLowerCase()).not.toMatch(/did you mean/i);
  });

  it.each(["Yes", "Go ahead", "Do it"])(
    "continues for “%s” when recommendations are active",
    (phrase) => {
      const memory = storeRecommendations(undefined, {
        creative: [
          {
            id: "motion.scroll",
            kind: "motion",
            title: "Add motion",
            explanation: "Motion",
            impact: "medium",
            impactScore: 70,
            confidence: 0.9,
            operations: [{ operation: "setCreativePolish", motion: true }],
            capabilityIds: ["motion"],
            applyable: true,
            estimatedTime: "<10 seconds",
          },
        ],
      });
      const engine = decideWithAtlasBrainEngine({
        project: sampleProject({ atlasActionMemory: memory }),
        request: phrase,
      });
      expect(engine.stage).toBe("continuation");
      expect(engine.decision.needsClarification).toBe(false);
    },
  );
});

describe("explicit command overrides", () => {
  it("overrides stored lead-generation memory for Add subtle animations", () => {
    const project = sampleProject({
      atlasMemory: { primaryGoal: "leads", businessTone: "warm" },
    });
    const engine = decideWithAtlasBrainEngine({
      project,
      request: "Add subtle animations",
      history: [
        { role: "user", content: "I want more leads" },
        { role: "assistant", content: "I can help grow inquiries." },
      ],
    });
    expect(engine.stage).toBe("explicit_command");
    expect(engine.commandKind).toBe("animations");
    expect(engine.decision.selectedAgents).not.toContain("business_advisor");
    expect(engine.decision.intent).toBe("command_animations");

    const result = runAtlasBrain({
      project,
      request: "Add subtle animations",
      history: [
        { role: "user", content: "I want more leads" },
        { role: "assistant", content: "I can help grow inquiries." },
      ],
    });
    expect(result.applyStatus).toBe("applied");
    expect(result.project.creativePolish?.motion).toBe(true);
    expect(result.explanation.toLowerCase()).not.toMatch(
      /lead|quote|call now|inquir/i,
    );
  });

  it("overrides business goals for Improve SEO", () => {
    const engine = decideWithAtlasBrainEngine({
      project: sampleProject(),
      request: "Improve SEO",
    });
    expect(engine.stage).toBe("explicit_command");
    expect(engine.commandKind).toBe("seo");
    expect(engine.decision.needsClarification).toBe(false);
    expect(engine.decision.confidence).toBeGreaterThanOrEqual(
      CONFIDENCE_EXECUTE_EXPLAIN,
    );

    const result = runAtlasBrain({
      project: sampleProject(),
      request: "Improve SEO",
    });
    expect(result.applyStatus).toBe("applied");
    expect(result.explanation.toLowerCase()).not.toMatch(/did you mean/i);
    expect(result.project.seo?.siteTitle).toBeTruthy();
  });
});

describe("SEO / Animation / Readability routing", () => {
  it("routes SEO as an explicit command", () => {
    const cmd = stageExplicitCommand({
      project: sampleProject(),
      request: "Improve SEO",
    });
    expect(cmd?.commandKind).toBe("seo");
  });

  it("routes animation requests directly", () => {
    const decision = decideAtlasBrain({
      project: sampleProject(),
      request: "Add subtle animations.",
    });
    expect(decision.commandKind).toBe("animations");
    expect(decision.decisionStage).toBe("explicit_command");
  });

  it("routes readability and actually applies improvements", () => {
    const project = sampleProject({
      heroSubheadline:
        "We are a wonderful bakery that has been serving the community for many years with lots of delicious cookies cakes and catering packages that everyone loves so much.",
      siteWidth: "full",
      creativePolish: { spacing: "default" },
    });
    const engine = decideWithAtlasBrainEngine({
      project,
      request: "Make the words easier to read.",
    });
    expect(engine.stage).toBe("explicit_command");
    expect(engine.commandKind).toBe("readability");

    const result = runAtlasBrain({
      project,
      request: "Make the words easier to read.",
    });
    expect(result.applyStatus).toBe("applied");
    expect(result.explanation.toLowerCase()).not.toMatch(/no changes needed/i);
    expect(
      result.project.creativePolish?.spacing === "airy" ||
        result.project.siteWidth === "boxed" ||
        result.project.heroSubheadline.length <
          project.heroSubheadline.length,
    ).toBe(true);
  });
});

describe("question routing", () => {
  it("answers design questions without executing edits", () => {
    const engine = decideWithAtlasBrainEngine({
      project: sampleProject(),
      request: "Why did you choose this design?",
    });
    expect(engine.stage).toBe("question");
    expect(engine.decision.needsClarification).toBe(false);

    const before = sampleProject();
    const result = runAtlasBrain({
      project: before,
      request: "Why did you choose this design?",
    });
    expect(result.applyStatus).toBe("no_changes");
    expect(result.operations).toHaveLength(0);
  });
});

describe("clarification once / no loops", () => {
  it("asks clarification only when earlier stages fail", () => {
    const engine = decideWithAtlasBrainEngine({
      project: sampleProject(),
      request: "Not sure",
    });
    expect(engine.stage).toBe("clarification");
    expect(engine.decision.needsClarification).toBe(true);
    expect(engine.decision.confidence).toBeLessThan(CONFIDENCE_EXECUTE_EXPLAIN);
  });

  it("does not clarify Improve SEO or Add subtle animations", () => {
    for (const request of ["Improve SEO", "Add subtle animations"]) {
      const engine = decideWithAtlasBrainEngine({
        project: sampleProject(),
        request,
      });
      expect(engine.decision.needsClarification).toBe(false);
      expect(engine.stage).toBe("explicit_command");
    }
  });

  it("stores pending clarification and resolves without looping", () => {
    const first = runAtlasBrain({
      project: sampleProject(),
      request: "Not sure",
    });
    expect(first.applyStatus).toBe("needs_clarification");
    const second = runAtlasBrain({
      project: first.project,
      request: "Better visuals",
    });
    expect(second.explanation.toLowerCase()).not.toMatch(
      /did you mean:\s*\n• better visuals/i,
    );
  });
});

describe("confidence thresholds", () => {
  it("assigns execute-now confidence to Apply All continuation", () => {
    const memory = storeRecommendations(undefined, {
      creative: [
        {
          id: "a",
          kind: "visual",
          title: "A",
          explanation: "A",
          impact: "high",
          impactScore: 80,
          confidence: 0.9,
          operations: [
            { operation: "setCreativePolish", serviceIcons: true },
          ],
          capabilityIds: [],
          applyable: true,
          estimatedTime: "<10s",
        },
      ],
    });
    const engine = decideWithAtlasBrainEngine({
      project: sampleProject({ atlasActionMemory: memory }),
      request: "Apply All",
    });
    expect(engine.decision.confidence).toBeGreaterThanOrEqual(0.95);
    expect(engine.decision.needsClarification).toBe(false);
  });

  it("maps low-confidence unknowns into clarification band", () => {
    const engine = decideWithAtlasBrainEngine({
      project: sampleProject(),
      request: "hmm",
    });
    expect(engine.decision.confidence).toBeLessThan(CONFIDENCE_CLARIFY + 0.01);
    expect(engine.decision.needsClarification).toBe(true);
  });
});

describe("deterministic routing", () => {
  it("returns the same stage and agents for the same inputs", () => {
    const project = sampleProject();
    const a = decideWithAtlasBrainEngine({
      project,
      request: "Make this website feel more luxurious.",
    });
    const b = decideWithAtlasBrainEngine({
      project,
      request: "Make this website feel more luxurious.",
    });
    expect(a.stage).toBe(b.stage);
    expect(a.decision.selectedAgents).toEqual(b.decision.selectedAgents);
    expect(a.decision.intent).toBe(b.decision.intent);
    expect(a.decision.confidence).toBe(b.decision.confidence);
  });
});

describe("natural preference copy", () => {
  it("does not dump raw memory keys", () => {
    const note = formatNaturalPreferenceNote({
      primaryGoal: "leads",
      preferredThemes: ["light"],
      preferredLayouts: ["minimal"],
      businessTone: "warm",
    });
    expect(note.toLowerCase()).not.toMatch(/goal:\s*leads/);
    expect(note.toLowerCase()).not.toMatch(/theme:\s*light/);
    expect(note).toMatch(/warm|minimal|light/i);
  });
});
