/**
 * Sprint 28.1A — critique classification + Brain routing regressions.
 */

import { beforeEach, describe, expect, it } from "vitest";
import {
  decideWithAtlasBrainEngine,
  stageBusinessGoal,
  stageCritique,
  stageQuestion,
} from "@/lib/ai/atlas-brain-decision-engine";
import {
  decideAtlasBrain,
  registerEditorPlanner,
  runAtlasBrain,
} from "@/lib/ai/atlas-brain";
import { storePendingClarification } from "@/lib/ai/atlas-action-memory";
import {
  classifyCritiqueRequest,
  CRITIQUE_ROUTING_PATH,
} from "@/lib/ai/critique-request";
import {
  CRITIQUE_PIPELINE_VERSION,
  resetCritiquePipelineCacheForTests,
  runAtlasCritiquePipeline,
} from "@/lib/ai/critique-pipeline";
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
    atlasMemory: {
      primaryGoal: "leads",
      preferredThemes: ["light"],
      businessTone: "warm",
    },
    atlasActionMemory: undefined,
    ...overrides,
  };
}

beforeEach(() => {
  resetCritiquePipelineCacheForTests();
});

describe("classifyCritiqueRequest", () => {
  it("classifies agency hypothetical redesign as design_critique", () => {
    const c = classifyCritiqueRequest(
      "If you were the best web design agency in the world, how would you redesign this homepage?",
    );
    expect(c.kind).toBe("critique");
    expect(c.intent).toBe("design_critique");
    expect(c.shouldExecuteEdits).toBe(false);
    expect(c.selectedPath).toBe(CRITIQUE_ROUTING_PATH);
    expect(c.confidence).toBeGreaterThanOrEqual(0.95);
    expect(c.matchedSignals.length).toBeGreaterThan(0);
  });

  it("classifies how-would-you redesign as critique", () => {
    const c = classifyCritiqueRequest("How would you redesign this homepage?");
    expect(c.intent).toBe("design_critique");
    expect(c.shouldExecuteEdits).toBe(false);
  });

  it("classifies before-launch improve asks as critique", () => {
    const c = classifyCritiqueRequest("What would you improve before launch?");
    expect(c.intent).toBe("design_critique");
    expect(c.shouldExecuteEdits).toBe(false);
  });

  it("classifies imperative premium redesign as design_redesign", () => {
    const c = classifyCritiqueRequest(
      "Redesign this homepage like a premium agency would.",
    );
    expect(c.kind).toBe("execute");
    expect(c.intent).toBe("design_redesign");
    expect(c.shouldExecuteEdits).toBe(true);
  });

  it("does not treat design explanation as critique", () => {
    const c = classifyCritiqueRequest("Why did you choose this design?");
    expect(c.kind).toBe("none");
  });

  it("leaves ambiguous make-it-better unclassified", () => {
    const c = classifyCritiqueRequest("Make it better.");
    expect(c.kind).toBe("none");
  });
});

describe("decision engine — critique priority", () => {
  it("routes agency prompt to critique before question/clarification", () => {
    const engine = decideWithAtlasBrainEngine({
      project: sampleProject(),
      request:
        "If you were the best web design agency in the world, how would you redesign this homepage?",
    });
    expect(engine.stage).toBe("critique");
    expect(engine.decision.intent).toBe("design_critique");
    expect(engine.decision.needsClarification).toBe(false);
    expect(engine.decision.selectedPath).toBe(CRITIQUE_ROUTING_PATH);
    expect(engine.decision.shouldExecuteEdits).toBe(false);
  });

  it("critique detection overrides generic question routing", () => {
    const request = "How would you redesign this homepage?";
    expect(stageQuestion({ project: sampleProject(), request })).toBeNull();
    const critique = stageCritique({ project: sampleProject(), request });
    expect(critique?.decision.intent).toBe("design_critique");
  });

  it("critique detection overrides stored business goals", () => {
    const project = sampleProject({
      atlasMemory: {
        primaryGoal: "more catering orders",
        businessTone: "warm",
      },
    });
    const request =
      "What would you improve before launch?";
    expect(stageBusinessGoal({ project, request })).toBeNull();
    const engine = decideWithAtlasBrainEngine({ project, request });
    expect(engine.stage).toBe("critique");
    expect(engine.decision.intent).toBe("design_critique");
  });

  it("routes explanation questions to question, not critique", () => {
    const engine = decideWithAtlasBrainEngine({
      project: sampleProject(),
      request: "Why did you choose this design?",
    });
    expect(engine.decision.intent).toBe("question");
    expect(engine.decision.needsClarification).toBe(false);
    expect(engine.stage).not.toBe("critique");
  });

  it("allows clarification for ambiguous make it better", () => {
    const engine = decideWithAtlasBrainEngine({
      project: sampleProject(),
      request: "Make it better.",
    });
    expect(engine.decision.needsClarification).toBe(true);
    expect(engine.decision.intent).not.toBe("design_critique");
  });

  it("routes imperative redesign to design_redesign with execute flag", () => {
    const engine = decideWithAtlasBrainEngine({
      project: sampleProject(),
      request: "Redesign this homepage like a premium agency would.",
    });
    expect(engine.stage).toBe("critique");
    expect(engine.decision.intent).toBe("design_redesign");
    expect(engine.decision.shouldExecuteEdits).toBe(true);
  });
});

describe("Atlas Brain — critique routing execution", () => {
  it("agency prompt calls unified critique pipeline without clarification or auto-edit", async () => {
    const request =
      "If you were the best web design agency in the world, how would you redesign this homepage?";
    const decision = decideAtlasBrain({
      project: sampleProject(),
      request,
    });
    expect(decision.intent).toBe("design_critique");
    expect(decision.needsClarification).toBe(false);
    expect(decision.shouldExecuteEdits).toBe(false);
    expect(decision.selectedPath).toBe(CRITIQUE_ROUTING_PATH);

    const result = await runAtlasBrain({
      project: sampleProject(),
      request,
      atlasRequestId: "sprint-28-1a-agency",
    });

    expect(result.applyStatus).toBe("no_changes");
    expect(result.operations).toHaveLength(0);
    expect(result.explanation).not.toMatch(/Better visuals/i);
    expect(result.explanation).not.toMatch(/Understood\. What would you like/i);
    expect(result.explanation).toMatch(/Strengths:|Top improvements:|emotional|premium|hierarchy/i);
    expect(result.project.atlasActionMemory?.activePlan?.applyAllPending).toBe(true);
    expect(result.project.atlasActionMemory?.activePlan?.recommendations?.length).toBeGreaterThan(
      0,
    );
  });

  it("same prompt twice reaches the same unified pipeline cache", async () => {
    const request = "How would you redesign this homepage?";
    const project = sampleProject();
    const a = await runAtlasCritiquePipeline({
      project,
      request,
      mode: "critique",
      atlasRequestId: "cache-a",
    });
    const b = await runAtlasCritiquePipeline({
      project,
      request,
      mode: "critique",
      atlasRequestId: "cache-b",
    });
    expect(a.ok && b.ok).toBe(true);
    if (a.ok && b.ok) {
      expect(a.pipeline.pipelineVersion).toBe(CRITIQUE_PIPELINE_VERSION);
      expect(b.pipeline.cacheHit).toBe(true);
      expect(a.pipeline.cacheKey).toBe(b.pipeline.cacheKey);
    }
  });

  it("overrides pending clarification instead of re-asking Better visuals", async () => {
    const pending = storePendingClarification(undefined, {
      question: "Did you mean one of these?",
      allowedAnswers: [
        "Better visuals",
        "Better copy",
        "Better conversions",
        "Something else",
      ],
    });
    const project = sampleProject({ atlasActionMemory: pending });
    const result = await runAtlasBrain({
      project,
      request:
        "If you were the best web design agency in the world, how would you redesign this homepage?",
    });
    expect(result.decision.intent).toBe("design_critique");
    expect(result.applyStatus).toBe("no_changes");
    expect(result.explanation).not.toMatch(/Understood\. What would you like/i);
    expect(result.explanation).not.toMatch(/Better visuals/i);
    expect(result.project.atlasActionMemory?.pendingClarification).toBeFalsy();
    expect(result.project.atlasActionMemory?.activePlan?.applyAllPending).toBe(true);
  });

  it("Apply All continues critique plan without clarification", async () => {
    const reviewed = await runAtlasBrain({
      project: sampleProject(),
      request: "Review this homepage.",
    });
    expect(reviewed.decision.intent).toBe("design_critique");
    expect(reviewed.project.atlasActionMemory?.activePlan?.applyAllPending).toBe(true);

    const applied = await runAtlasBrain({
      project: reviewed.project,
      request: "Apply All",
    });
    expect(applied.applyStatus).toBe("applied");
    expect(applied.decision.needsClarification).toBe(false);
    expect(applied.explanation).not.toMatch(/Did you mean|Better visuals/i);
  });

  it("stores critique plan in Action Memory for design_critique", async () => {
    const result = await runAtlasBrain({
      project: sampleProject(),
      request: "What would you improve before launch?",
    });
    const memory = result.project.atlasActionMemory;
    expect(memory?.activePlan?.recommendations?.length).toBeGreaterThan(0);
    expect(memory?.activePlan?.applyAllPending).toBe(true);
    expect(memory?.activePlan?.executionPlan?.goal).toMatch(/Review|website|launch/i);
  });
});
