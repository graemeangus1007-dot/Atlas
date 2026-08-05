/**
 * Sprint 28.1 — unified critique pipeline + cache regressions.
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
  buildDesignCritiquePrompt,
  buildOpenAiDesignCritiqueSchema,
  CRITIQUE_PIPELINE_VERSION,
  CRITIQUE_PROMPT_VERSION,
  CRITIQUE_SCHEMA_VERSION,
  getCritiquePipelineVersions,
  invalidateCritiquePipelineCache,
  resetCritiquePipelineCacheForTests,
  runAtlasCritiquePipeline,
} from "@/lib/ai/critique-pipeline";
import { buildDesignCritiqueContext } from "@/lib/ai/design-critique";
import { DESIGN_CRITIQUE_SCHEMA_NAME } from "@/lib/ai/design-critique-schema";
import {
  formatRecommendationSupportPlan,
  critiqueToOperations,
} from "@/lib/ai/critique-to-operations";
import { creativeDirectorFingerprint } from "@/lib/ai/creative-director";
import { applyAllCreativeRecommendations } from "@/lib/ai/apply-creative-recommendation";
import { resetServerEnvCacheForTests } from "@/lib/env";
import type { BusinessProject } from "@/types/business-project";
import type { CreativeDirectorRecommendation } from "@/lib/ai/creative-director-types";

registerEditorPlanner(planEditOperations);

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  resetServerEnvCacheForTests();
  resetCritiquePipelineCacheForTests();
});

function sampleProject(
  overrides: Partial<BusinessProject> = {},
): BusinessProject {
  return {
    ...MOCK_BUSINESS_PROJECT,
    businessName: "Linda's Cookies",
    mediaLibrary: [],
    heroImageId: null,
    atlasActionMemory: undefined,
    ...overrides,
  };
}

const AGENCY_PROMPT =
  "If you were the best web design agency in the world, how would you redesign this homepage?";

describe("unified critique pipeline contracts", () => {
  it("exposes a single schema, prompt builder, and version set", () => {
    const versions = getCritiquePipelineVersions();
    expect(versions).toEqual({
      pipelineVersion: CRITIQUE_PIPELINE_VERSION,
      schemaVersion: CRITIQUE_SCHEMA_VERSION,
      promptVersion: CRITIQUE_PROMPT_VERSION,
    });
    expect(DESIGN_CRITIQUE_SCHEMA_NAME).toBe("atlas_design_critique");
    const schemaA = buildOpenAiDesignCritiqueSchema();
    const schemaB = buildOpenAiDesignCritiqueSchema();
    expect(schemaA).toEqual(schemaB);

    const prompt = buildDesignCritiquePrompt({
      request: AGENCY_PROMPT,
      mode: "critique",
      context: buildDesignCritiqueContext(sampleProject()),
    });
    expect(prompt.combinedSystem).toMatch(/Atlas/);
    expect(prompt.user).toMatch(/User request/);
    expect(prompt.developer).toMatch(/prioritizedImprovements/);
  });

  it("runs the same prompt twice with identical cache key and cache hit", async () => {
    vi.stubEnv("AI_PROVIDER", "mock");
    const project = sampleProject();

    const first = await runAtlasCritiquePipeline({
      project,
      request: AGENCY_PROMPT,
      mode: "critique",
      atlasRequestId: "req-1",
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.pipeline.cacheHit).toBe(false);
    expect(first.pipeline.pipelineVersion).toBe(CRITIQUE_PIPELINE_VERSION);
    expect(first.pipeline.schemaVersion).toBe(CRITIQUE_SCHEMA_VERSION);
    expect(first.pipeline.promptVersion).toBe(CRITIQUE_PROMPT_VERSION);
    expect(first.pipeline.schemaName).toBe(DESIGN_CRITIQUE_SCHEMA_NAME);

    const second = await runAtlasCritiquePipeline({
      project,
      request: AGENCY_PROMPT,
      mode: "critique",
      atlasRequestId: "req-2",
    });
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.pipeline.cacheHit).toBe(true);
    expect(second.pipeline.cacheKey).toBe(first.pipeline.cacheKey);
    expect(second.critique.summary).toBe(first.critique.summary);
  });

  it("reuses fingerprint cache for Complete my website", async () => {
    vi.stubEnv("AI_PROVIDER", "mock");
    const project = sampleProject();
    const first = await runAtlasCritiquePipeline({
      project,
      request: AGENCY_PROMPT,
      mode: "critique",
      atlasRequestId: "agency-1",
    });
    expect(first.ok).toBe(true);

    const complete = await runAtlasCritiquePipeline({
      project,
      request: "Complete my website for launch",
      mode: "critique",
      atlasRequestId: "cmw-1",
      allowFingerprintReuse: true,
    });
    expect(complete.ok).toBe(true);
    if (!complete.ok || !first.ok) return;
    expect(complete.pipeline.cacheHit).toBe(true);
    expect(complete.critique.summary).toBe(first.critique.summary);
  });

  it("invalidates cache when fingerprint changes", async () => {
    vi.stubEnv("AI_PROVIDER", "mock");
    const project = sampleProject();
    const first = await runAtlasCritiquePipeline({
      project,
      request: AGENCY_PROMPT,
      mode: "critique",
    });
    expect(first.ok).toBe(true);
    invalidateCritiquePipelineCache(creativeDirectorFingerprint(project));
    const again = await runAtlasCritiquePipeline({
      project,
      request: AGENCY_PROMPT,
      mode: "critique",
    });
    expect(again.ok).toBe(true);
    if (!again.ok) return;
    expect(again.pipeline.cacheHit).toBe(false);
  });
});

describe("Brain routes agency prompt through unified pipeline", () => {
  it("uses critique pipeline for identical agency redesign prompt", async () => {
    vi.stubEnv("AI_PROVIDER", "mock");
    const decision = decideAtlasBrain({
      project: sampleProject(),
      request: AGENCY_PROMPT,
    });
    expect(decision.intent).toBe("design_critique");

    const a = await runAtlasBrain({
      project: sampleProject(),
      request: AGENCY_PROMPT,
      atlasRequestId: "brain-1",
    });
    const b = await runAtlasBrain({
      project: sampleProject(),
      request: AGENCY_PROMPT,
      atlasRequestId: "brain-2",
    });
    expect(a.applyStatus).toBe("no_changes");
    expect(b.applyStatus).toBe("no_changes");
    expect(a.explanation).toMatch(/Plan:|Strengths|Top improvements/i);
    expect(a.project.atlasActionMemory?.activePlan?.recommendations?.length ?? 0).toBeGreaterThan(
      0,
    );
  });
});

describe("Apply All support reporting", () => {
  it("reports unsupported recommendations instead of silently skipping", () => {
    const recommendations: CreativeDirectorRecommendation[] = [
      {
        id: "critique.a",
        kind: "content",
        title: "Rewrite hero",
        explanation: "Clearer promise",
        impact: "high",
        impactScore: 90,
        confidence: 0.9,
        operations: [
          {
            operation: "setCreativePolish",
            visualHierarchy: true,
            spacing: "comfortable",
          },
        ],
        capabilityIds: [],
        applyable: true,
        supportStatus: "supported",
        estimatedTime: "<15 seconds",
      },
      {
        id: "critique.b",
        kind: "visual",
        title: "Add gallery",
        explanation: "Show real work",
        impact: "high",
        impactScore: 88,
        confidence: 0.8,
        operations: [],
        capabilityIds: [],
        applyable: false,
        supportStatus: "needs_images",
        blockedReason: "Requires uploaded images",
        estimatedTime: "—",
      },
      {
        id: "critique.c",
        kind: "visual",
        title: "Generate hero imagery",
        explanation: "AI imagery",
        impact: "medium",
        impactScore: 70,
        confidence: 0.7,
        operations: [],
        capabilityIds: [],
        applyable: false,
        supportStatus: "coming_soon",
        blockedReason: "AI image generation coming soon",
        estimatedTime: "—",
      },
    ];

    const plan = formatRecommendationSupportPlan(recommendations);
    expect(plan).toMatch(/✓ Rewrite hero/);
    expect(plan).toMatch(/⚠ Add gallery — Requires uploaded images/);
    expect(plan).toMatch(/⚠ Generate hero imagery — AI image generation coming soon/);

    const result = applyAllCreativeRecommendations({
      project: sampleProject(),
      recommendations,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.appliedIds).toContain("critique.a");
    expect(result.unsupported.some((u) => u.id === "critique.b")).toBe(true);
    expect(result.explanation).toMatch(/Requires uploaded images/);
    expect(result.explanation).toMatch(/AI image generation coming soon/);
  });

  it("exports critiqueToOperations as the single converter", () => {
    expect(typeof critiqueToOperations).toBe("function");
    expect(critiqueToOperations).toBeTypeOf("function");
  });
});
