/**
 * Atlas Brain — orchestration layer (Sprint 26.0A).
 * Every conversation turn flows through Brain before specialists run.
 * Users only ever talk to “Atlas”.
 */

import {
  formatMemoryContext,
  updateAtlasMemory,
} from "@/lib/ai/atlas-brain-memory";
import {
  decideAtlasBrain,
  formatExecutionPlanForUser,
} from "@/lib/ai/atlas-brain-routing";
import type {
  AtlasBrainDecision,
  AtlasExecutionPlan,
  AtlasProjectMemory,
} from "@/lib/ai/atlas-brain-types";
import { reviewBusinessProject } from "@/lib/ai/business-advisor";
import {
  applyAllCreativeRecommendations,
  applyCreativeRecommendation,
} from "@/lib/ai/apply-creative-recommendation";
import { applyAdvisorRecommendation } from "@/lib/ai/apply-advisor-recommendation";
import { reviewCreativeDirector } from "@/lib/ai/creative-director";
import type {
  EditorAgentHistoryItem,
  EditorAgentInput,
  EditorAgentResult,
} from "@/lib/ai/editor-agent";
import type { EditChangeSummary, EditOperation } from "@/lib/ai/edit-operations";
import { applyEditOperations } from "@/lib/ai/apply-edit-operations";
import { validateEditOperations } from "@/lib/ai/validate-edit-operations";
import { hasMeaningfulProjectDiff } from "@/lib/ai/editor-assistant-persistence";
import { AiError } from "@/lib/ai/errors";
import { runImageAgent } from "@/lib/ai/image-agent";
import type { ImageOperation } from "@/lib/ai/image-operations";
import {
  attachDesignSystem,
  designSystemInputFromProject,
  resolveDesignSystem,
} from "@/lib/ai/design-system-intelligence";
import type { BusinessProject } from "@/types/business-project";

/** Avoid circular import with editor-agent — registered at module load. */
type EditorPlanner = (input: {
  project: BusinessProject;
  request: string;
  history?: EditorAgentHistoryItem[];
}) => {
  operations: EditOperation[];
  explanation: string;
  needsClarification?: boolean;
  reasoning?: EditorAgentResult["reasoning"];
};

let editorPlanner: EditorPlanner | null = null;

/** Called by editor-agent.ts after planEditOperations is defined. */
export function registerEditorPlanner(planner: EditorPlanner): void {
  editorPlanner = planner;
}

export type AtlasBrainResult = EditorAgentResult & {
  decision: AtlasBrainDecision;
  followUpSuggestions: string[];
  executionPlan?: AtlasExecutionPlan;
  atlasMemory?: AtlasProjectMemory;
};

function withMemory(
  project: BusinessProject,
  request: string,
  patch?: Partial<AtlasProjectMemory> | null,
): BusinessProject {
  const atlasMemory = updateAtlasMemory(project, request, patch);
  return { ...project, atlasMemory };
}

function appendExplanation(base: string, extra: string): string {
  const a = base.trim();
  const b = extra.trim();
  if (!a) return b;
  if (!b) return a;
  return `${a}\n\n${b}`;
}

function runEditorSpecialist(input: {
  project: BusinessProject;
  request: string;
  history: EditorAgentHistoryItem[];
}): {
  project: BusinessProject;
  operations: EditOperation[];
  changes: EditChangeSummary[];
  explanation: string;
  applyStatus: EditorAgentResult["applyStatus"];
  needsClarification: boolean;
  reasoning?: EditorAgentResult["reasoning"];
} {
  if (!editorPlanner) {
    throw new AiError(
      "provider_error",
      "Atlas is still starting up. Please try that again.",
    );
  }
  const planned = editorPlanner({
    project: input.project,
    request: input.request,
    history: input.history,
  });

  if (planned.needsClarification || planned.operations.length === 0) {
    const needsClarification =
      planned.needsClarification ||
      Boolean(planned.reasoning && !planned.reasoning.shouldAct);
    return {
      project: input.project,
      operations: [],
      changes: [],
      explanation: planned.explanation,
      applyStatus: needsClarification ? "needs_clarification" : "no_changes",
      needsClarification,
      reasoning: planned.reasoning,
    };
  }

  const operations = validateEditOperations(planned.operations);
  const applied = applyEditOperations(input.project, operations);
  const changed = hasMeaningfulProjectDiff(input.project, applied.project);
  return {
    project: changed ? applied.project : input.project,
    operations: changed ? operations : [],
    changes: changed ? applied.changes : [],
    explanation: changed
      ? planned.explanation
      : "No changes needed — the site already matched that request.",
    applyStatus: changed ? "applied" : "no_changes",
    needsClarification: false,
    reasoning: planned.reasoning,
  };
}

/**
 * Produce a Brain decision without executing (for tests / preview).
 */
export function planAtlasBrain(input: EditorAgentInput): AtlasBrainDecision {
  const request = input.request?.trim();
  if (!request) {
    throw new AiError("bad_request", "A design request is required.");
  }
  if (!input.project || typeof input.project !== "object") {
    throw new AiError("bad_request", "A current project is required.");
  }
  const history = (input.history as EditorAgentHistoryItem[] | undefined) ?? [];
  return decideAtlasBrain({
    request,
    project: input.project,
    history,
  });
}

/**
 * Orchestrate specialists and return a unified Atlas response.
 */
export function runAtlasBrain(input: EditorAgentInput): AtlasBrainResult {
  const request = input.request?.trim();
  if (!request) {
    throw new AiError("bad_request", "A design request is required.");
  }
  if (!input.project || typeof input.project !== "object") {
    throw new AiError("bad_request", "A current project is required.");
  }

  const history: EditorAgentHistoryItem[] = Array.isArray(input.history)
    ? (input.history as EditorAgentHistoryItem[]).filter(
        (item) =>
          item &&
          (item.role === "user" || item.role === "assistant") &&
          typeof item.content === "string",
      )
    : [];

  const decision = decideAtlasBrain({
    request,
    project: input.project,
    history,
  });

  const memoryCtx = formatMemoryContext(input.project.atlasMemory);
  const planText = formatExecutionPlanForUser(decision.executionPlan);

  if (decision.needsClarification) {
    const project = withMemory(
      input.project,
      request,
      decision.memoryPatch,
    );
    return {
      ok: true,
      explanation: decision.clarificationQuestion || decision.explanation,
      operations: [],
      changes: [],
      project,
      applyStatus: "needs_clarification",
      decision,
      followUpSuggestions: decision.followUpSuggestions,
      executionPlan: decision.executionPlan,
      atlasMemory: project.atlasMemory,
      imageEditorState: input.imageEditorState ?? undefined,
    };
  }

  // Publish guidance — no mutation beyond memory
  if (decision.intent === "publish") {
    const project = withMemory(input.project, request, decision.memoryPatch);
    return {
      ok: true,
      explanation: decision.explanation,
      operations: [],
      changes: [],
      project,
      applyStatus: "no_changes",
      decision,
      followUpSuggestions: decision.followUpSuggestions,
      executionPlan: decision.executionPlan,
      atlasMemory: project.atlasMemory,
    };
  }

  // Recommend-only — narrative from Creative Director + Advisor (no auto-apply)
  if (decision.intent === "recommend") {
    const creative = reviewCreativeDirector({ project: input.project, limit: 5 });
    const advisor = reviewBusinessProject({ project: input.project, limit: 3 });
    const bullets = [
      ...creative.recommendedImprovements.slice(0, 3).map((r) => `• ${r.title}`),
      ...advisor.recommendations.slice(0, 2).map((r) => `• ${r.title}`),
    ];
    const explanation = [
      "I reviewed your website.",
      creative.narrative.split("\n")[0] ?? "",
      "",
      `Completeness: ${creative.overallCompleteness}% · ${creative.maturityLevel}`,
      "",
      "Highest-impact opportunities:",
      ...bullets,
    ]
      .filter(Boolean)
      .join("\n");

    const project = withMemory(input.project, request, decision.memoryPatch);
    return {
      ok: true,
      explanation,
      operations: [],
      changes: [],
      project,
      applyStatus: "no_changes",
      decision,
      followUpSuggestions: decision.followUpSuggestions,
      executionPlan: decision.executionPlan,
      atlasMemory: project.atlasMemory,
    };
  }

  let project = input.project;
  const operations: Array<EditOperation | ImageOperation> = [];
  const changes: EditChangeSummary[] = [];
  let explanation = decision.explanation;
  let imageEditorState = input.imageEditorState ?? undefined;
  let applyStatus: EditorAgentResult["applyStatus"] = "no_changes";
  let reasoning: EditorAgentResult["reasoning"];

  if (planText && decision.selectedAgents.length > 1) {
    explanation = appendExplanation(planText, explanation);
  }
  if (memoryCtx) {
    explanation = appendExplanation(
      explanation,
      `(Keeping your preferences in mind: ${memoryCtx}.)`,
    );
  }

  const agents = new Set(decision.selectedAgents);

  // Design System Intelligence — auto-choose language when confidence is high
  if (
    decision.intent === "feel_direction" ||
    decision.intent === "multi_goal" ||
    decision.intent === "explicit_design_edit"
  ) {
    const resolution = resolveDesignSystem(
      designSystemInputFromProject(project, request),
    );
    if (resolution.autoApply) {
      try {
        const ops = validateEditOperations(resolution.operations);
        const applied = applyEditOperations(project, ops);
        project = attachDesignSystem(applied.project, resolution.designSystem);
        if (hasMeaningfulProjectDiff(input.project, project)) {
          operations.push(...ops);
          changes.push(...applied.changes);
          applyStatus = "applied";
          explanation = appendExplanation(
            explanation,
            resolution.designSystem.explanation,
          );
        } else {
          project = attachDesignSystem(project, resolution.designSystem);
          explanation = appendExplanation(
            explanation,
            resolution.designSystem.explanation,
          );
        }
      } catch {
        project = attachDesignSystem(project, resolution.designSystem);
        explanation = appendExplanation(
          explanation,
          resolution.designSystem.explanation,
        );
      }
    }
  }

  // Image specialist
  if (agents.has("image_agent")) {
    const imageResult = runImageAgent({
      project,
      request,
      history,
      editorState: input.imageEditorState,
    });
    if (imageResult.applyStatus === "applied") {
      project = imageResult.project;
      operations.push(...imageResult.operations);
      changes.push(
        ...imageResult.changes.map((c) => ({
          id: c.id,
          label: c.label,
          ok: true as const,
        })),
      );
      applyStatus = "applied";
      explanation = appendExplanation(explanation, imageResult.explanation);
    } else if (
      imageResult.applyStatus === "needs_clarification" &&
      agents.size === 1
    ) {
      project = withMemory(project, request, decision.memoryPatch);
      return {
        ok: true,
        explanation: imageResult.explanation,
        operations: [],
        changes: [],
        project,
        applyStatus: "needs_clarification",
        decision,
        followUpSuggestions: decision.followUpSuggestions,
        executionPlan: decision.executionPlan,
        atlasMemory: project.atlasMemory,
        imageEditorState: imageResult.editorState,
      };
    } else if (imageResult.explanation) {
      explanation = appendExplanation(explanation, imageResult.explanation);
    }
    imageEditorState = imageResult.editorState ?? imageEditorState;
  }

  // Creative Director — apply top polish recommendations for feel / multi-goal
  if (
    agents.has("creative_director") &&
    (decision.intent === "feel_direction" || decision.intent === "multi_goal")
  ) {
    const creative = reviewCreativeDirector({ project, limit: 6 });
    const applyable = creative.recommendedImprovements.filter((r) => r.applyable);
    if (applyable.length > 0) {
      const batch = applyAllCreativeRecommendations({
        project,
        recommendations: applyable.slice(0, 4),
      });
      if (batch.ok && batch.status === "applied") {
        project = batch.project;
        changes.push(...batch.changes);
        applyStatus = "applied";
        explanation = appendExplanation(
          explanation,
          batch.explanation || "I applied the highest-impact polish upgrades.",
        );
      }
    } else if (decision.intent === "feel_direction") {
      // Fall back to a single icons/motion polish if nothing else applyable
      const icons = creative.recommendedImprovements.find(
        (r) => r.id === "visual.service_icons" || r.id === "motion.scroll_animations",
      );
      if (icons) {
        const one = applyCreativeRecommendation({ project, recommendation: icons });
        if (one.ok && one.status === "applied") {
          project = one.project;
          changes.push(...one.changes);
          applyStatus = "applied";
          explanation = appendExplanation(explanation, one.explanation);
        }
      }
    }
  }

  // Business Advisor — apply top non-destructive recommendation for multi_goal
  if (agents.has("business_advisor") && decision.intent === "multi_goal") {
    const advisor = reviewBusinessProject({ project, limit: 3 });
    const top = advisor.recommendations.find(
      (r) => !r.destructive && r.operations.length > 0,
    );
    if (top) {
      const applied = applyAdvisorRecommendation({
        project,
        recommendation: top,
      });
      if (applied.ok && applied.status === "applied") {
        project = applied.project;
        changes.push(...applied.changes);
        applyStatus = "applied";
        explanation = appendExplanation(
          explanation,
          applied.explanation || top.noticed,
        );
      }
    }
  }

  // Editor specialist — content/design edits
  if (agents.has("editor_agent")) {
    const edited = runEditorSpecialist({ project, request, history });
    if (edited.reasoning) reasoning = edited.reasoning;
    if (edited.needsClarification && applyStatus !== "applied") {
      project = withMemory(edited.project, request, decision.memoryPatch);
      return {
        ok: true,
        explanation: edited.explanation,
        operations: [],
        changes: [],
        project,
        applyStatus: "needs_clarification",
        decision,
        followUpSuggestions: decision.followUpSuggestions,
        executionPlan: decision.executionPlan,
        atlasMemory: project.atlasMemory,
        imageEditorState,
        reasoning,
      };
    }
    if (edited.applyStatus === "applied") {
      project = edited.project;
      operations.push(...edited.operations);
      changes.push(...edited.changes);
      applyStatus = "applied";
      explanation = appendExplanation(explanation, edited.explanation);
    } else if (edited.explanation && applyStatus !== "applied") {
      explanation = appendExplanation(explanation, edited.explanation);
      applyStatus = edited.applyStatus;
    }
  }

  project = withMemory(project, request, decision.memoryPatch);

  // Soft follow-ups after successful work
  const followUps =
    applyStatus === "applied"
      ? decision.followUpSuggestions
      : decision.followUpSuggestions.slice(0, 3);

  if (applyStatus === "applied") {
    explanation = appendExplanation(
      explanation,
      [
        "Would you like me to:",
        ...followUps.map((item) => `• ${item}`),
      ].join("\n"),
    );
  }

  return {
    ok: true,
    explanation,
    operations,
    changes,
    project,
    applyStatus,
    decision,
    followUpSuggestions: followUps,
    executionPlan: decision.executionPlan,
    atlasMemory: project.atlasMemory,
    imageEditorState,
    reasoning,
  };
}

export function tryRunAtlasBrain(
  input: EditorAgentInput,
): AtlasBrainResult | { ok: false; code: string; message: string } {
  try {
    return runAtlasBrain(input);
  } catch (error) {
    if (error instanceof AiError) {
      return { ok: false, code: error.code, message: error.message };
    }
    return {
      ok: false,
      code: "provider_error",
      message: "Atlas could not process that request. Please try again.",
    };
  }
}

// Re-exports for tests / consumers
export { decideAtlasBrain, formatExecutionPlanForUser } from "@/lib/ai/atlas-brain-routing";
export {
  inferMemoryFromMessage,
  mergeAtlasMemory,
  updateAtlasMemory,
  formatMemoryContext,
} from "@/lib/ai/atlas-brain-memory";
