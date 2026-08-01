/**
 * Sprint 26.0A — Atlas Brain regression tests.
 */

import { describe, expect, it } from "vitest";
import {
  planEditOperations,
} from "@/lib/ai/editor-agent";
import {
  decideAtlasBrain,
  formatExecutionPlanForUser,
  planAtlasBrain,
  registerEditorPlanner,
  runAtlasBrain,
} from "@/lib/ai/atlas-brain";
import {
  inferMemoryFromMessage,
  mergeAtlasMemory,
  updateAtlasMemory,
} from "@/lib/ai/atlas-brain-memory";
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
    mediaLibrary: [asset("asset-cookies", "fresh cookies")],
    heroImageId: null,
    galleryImageIds: ["", "", "", ""],
    designSections: undefined,
    creativePolish: undefined,
    atlasMemory: undefined,
    ...overrides,
  };
}

describe("single-agent routing", () => {
  it("routes hero image replacement to the image agent only", async () => {
    const decision = decideAtlasBrain({
      project: sampleProject(),
      request: "Replace the hero image.",
    });
    expect(decision.selectedAgents).toEqual(["image_agent"]);
    expect(decision.intent).toBe("image_edit");
    expect(decision.needsClarification).toBe(false);
  });
});

describe("multi-agent routing", () => {
  it("routes luxury feel to creative + editor + image", async () => {
    const decision = decideAtlasBrain({
      project: sampleProject(),
      request: "Make this website feel more luxurious.",
    });
    expect(decision.selectedAgents).toContain("creative_director");
    expect(decision.selectedAgents).toContain("editor_agent");
    expect(decision.selectedAgents).toContain("image_agent");
    expect(decision.intent).toBe("feel_direction");
  });

  it("routes catering orders to advisor + creative + editor", async () => {
    const decision = decideAtlasBrain({
      project: sampleProject(),
      request: "I want more catering orders.",
    });
    expect(decision.selectedAgents).toContain("business_advisor");
    expect(decision.selectedAgents).toContain("creative_director");
    expect(decision.selectedAgents).toContain("editor_agent");
    expect(decision.executionPlan.estimatedImpact).toBe("high");
  });

  it("does not treat FAQ answers that mention calling as business goals", async () => {
    const decision = decideAtlasBrain({
      project: sampleProject(),
      request: `Update the answer to "How do I get started?" to: "You give us a call!"`,
    });
    expect(decision.selectedAgents).toEqual(["editor_agent"]);
    expect(decision.selectedAgents).not.toContain("business_advisor");
  });
});

describe("clarification", () => {
  it("asks a concise multiple-choice follow-up when the ask is vague", async () => {
    const decision = decideAtlasBrain({
      project: sampleProject(),
      request: "Not sure",
    });
    expect(decision.needsClarification).toBe(true);
    expect(decision.clarificationQuestion).toMatch(/precise|focus/i);
    expect(decision.clarificationQuestion).not.toMatch(/Did you mean/i);
    expect(decision.followUpSuggestions.length).toBeGreaterThan(1);
    expect(decision.followUpSuggestions.join(" ")).toMatch(/Richer photos/i);

    const result = await runAtlasBrain({
      project: sampleProject(),
      request: "Not sure",
    });
    expect(result.applyStatus).toBe("needs_clarification");
    expect(result.explanation).toMatch(/Richer photos|precise|focus/i);
    expect(result.explanation).not.toMatch(/Better visuals/i);
  });
});

describe("execution plans", () => {
  it("formats a user-facing plan without specialist names", async () => {
    const decision = decideAtlasBrain({
      project: sampleProject(),
      request: "I want more catering orders.",
    });
    const text = formatExecutionPlanForUser(decision.executionPlan);
    expect(text).toMatch(/Goal/i);
    expect(text).toMatch(/Plan/i);
    expect(text).toMatch(/✓/);
    expect(text).not.toMatch(/business_advisor|editor_agent|creative_director/i);
  });

  it("includes an execution plan on multi-agent turns", async () => {
    const planned = planAtlasBrain({
      project: sampleProject(),
      request: "Make this website feel more luxurious.",
    });
    expect(planned.executionPlan.steps.length).toBeGreaterThan(1);
  });
});

describe("project memory", () => {
  it("infers luxury tone and dark theme preferences", async () => {
    const patch = inferMemoryFromMessage(
      "I prefer a minimalist dark theme with a luxury tone",
    );
    expect(patch.preferredLayouts).toContain("minimalist");
    expect(patch.preferredThemes).toContain("dark");
    expect(patch.businessTone).toBe("luxury");
  });

  it("persists memory onto the project after a turn", async () => {
    const result = await runAtlasBrain({
      project: sampleProject(),
      request: "Make this website feel more luxurious.",
    });
    expect(result.project.atlasMemory?.businessTone).toBe("luxury");
    const merged = mergeAtlasMemory(result.project.atlasMemory, {
      primaryGoal: "phone calls",
    });
    expect(merged.primaryGoal).toBe("phone calls");
    const updated = updateAtlasMemory(
      { ...result.project, atlasMemory: merged },
      "I want more phone calls",
    );
    expect(updated.primaryGoal).toBe("phone calls");
  });
});

describe("follow-up suggestions", () => {
  it("returns natural follow-ups after image work", async () => {
    const result = await runAtlasBrain({
      project: sampleProject({
        mediaLibrary: [asset("asset-cookies", "fresh cookies")],
      }),
      request: "Replace the hero image with fresh cookies",
    });
    expect(result.followUpSuggestions.length).toBeGreaterThan(0);
    expect(result.followUpSuggestions.join(" ")).toMatch(/image|SEO|animation/i);
  });
});

describe("mixed requests", () => {
  it("selects both image and editor agents when copy is mixed in", async () => {
    const decision = decideAtlasBrain({
      project: sampleProject(),
      request: "Replace the hero image and update the headline",
    });
    expect(decision.selectedAgents).toContain("image_agent");
    expect(decision.selectedAgents).toContain("editor_agent");
  });
});

describe("deterministic routing", () => {
  it("returns the same agents for the same request", async () => {
    const project = sampleProject();
    const a = decideAtlasBrain({
      project,
      request: "Replace the hero image.",
    });
    const b = decideAtlasBrain({
      project,
      request: "Replace the hero image.",
    });
    expect(a.selectedAgents).toEqual(b.selectedAgents);
    expect(a.intent).toBe(b.intent);
    expect(a.confidence).toBe(b.confidence);
  });

  it("rewrites industry copy for a dental office through Atlas Brain", async () => {
    const project = sampleProject({
      heroHeadline: "old headline",
      services: [{ title: "Espresso", description: "Coffee" }],
    });
    const decision = decideAtlasBrain({
      project,
      request: "Rewrite everything for a dental office.",
    });
    expect(decision.selectedAgents).toContain("editor_agent");
    expect(decision.needsClarification).toBe(false);

    const result = await runAtlasBrain({
      project,
      request: "Rewrite everything for a dental office.",
    });
    expect(result.applyStatus).toBe("applied");
    expect(result.project.heroHeadline.toLowerCase()).toMatch(/smile|dental/i);
  });
});
