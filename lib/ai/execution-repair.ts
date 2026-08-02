/**
 * Conversation repair when the user disputes a prior edit (v1.2 truthfulness).
 */

import {
  getActionMemory,
  getLastExecution,
  storeLastExecution,
  withActionMemory,
} from "@/lib/ai/atlas-action-memory";
import type { AtlasBrainDecision } from "@/lib/ai/atlas-brain-types";
import {
  isExecutionDisputeRequest,
  sectionDisplayName,
  type AtlasLastExecution,
  type EditExecutionResult,
} from "@/lib/ai/edit-execution-result";
import type { EditOperation } from "@/lib/ai/edit-operations";
import {
  isInsertableSectionType,
  type InsertableSectionType,
} from "@/lib/ai/edit-operations";
import { applyEditOperations } from "@/lib/ai/apply-edit-operations";
import { validateEditOperations } from "@/lib/ai/validate-edit-operations";
import {
  applyStatusFromExecution,
  isSectionPresentOnPage,
  verifyEditExecution,
  verifyMoveSection,
} from "@/lib/ai/verify-edit-execution";
import type { BusinessProject } from "@/types/business-project";

export { isExecutionDisputeRequest };

function repairDecision(explanation: string): AtlasBrainDecision {
  return {
    intent: "continue_plan",
    confidence: 0.99,
    selectedAgents: ["editor_agent"],
    needsClarification: false,
    executionPlan: {
      goal: "Verify the previous edit",
      steps: [
        {
          id: "repair.verify",
          agent: "editor_agent",
          label: "Inspect the last change against the current page",
        },
      ],
      estimatedImpact: "medium",
    },
    explanation,
    followUpSuggestions: [],
    decisionStage: "continuation",
    commandKind: "execution_repair",
  };
}

function toLastExecution(
  request: string,
  result: EditExecutionResult,
  operations: EditOperation[],
): AtlasLastExecution {
  return {
    request,
    at: new Date().toISOString(),
    success: result.success,
    verified: result.verified,
    operationTypes: operations.map((op) => op.operation),
    operations,
    verificationFailures: result.verificationFailures,
    createdEntities: result.createdEntities,
    modifiedEntities: result.modifiedEntities,
    explanation: result.explanation,
    followUpRecommendation: result.followUpRecommendation,
  };
}

/**
 * If the user disputes the last edit, re-verify page state and optionally fix.
 */
export function tryRepairDisputedExecution(input: {
  project: BusinessProject;
  request: string;
}): {
  ok: true;
  explanation: string;
  operations: EditOperation[];
  changes: Array<{ id: string; label: string; ok: boolean }>;
  project: BusinessProject;
  applyStatus: "applied" | "no_changes" | "needs_clarification";
  decision: AtlasBrainDecision;
  followUpSuggestions: string[];
} | null {
  if (!isExecutionDisputeRequest(input.request)) return null;

  const memory = getActionMemory(input.project);
  const last = getLastExecution(memory);
  if (!last) {
    return {
      ok: true,
      explanation:
        "I don’t have a recent edit to double-check. Tell me what you’d like changed on the page.",
      operations: [],
      changes: [],
      project: input.project,
      applyStatus: "needs_clarification",
      decision: repairDecision(
        "I don’t have a recent edit to double-check.",
      ),
      followUpSuggestions: ["Review my website"],
    };
  }

  // Re-verify last operations against current project (as both before/after snapshot).
  const recheck = verifyEditExecution(
    input.project,
    input.project,
    last.operations as EditOperation[],
  );

  const moveOp = (last.operations as EditOperation[]).find(
    (op) => op.operation === "moveSection",
  );

  // Common failure: claimed move of a missing optional section.
  if (moveOp && moveOp.operation === "moveSection") {
    const section = moveOp.section;
    const present = isSectionPresentOnPage(input.project, section);
    if (!present && isInsertableSectionType(section)) {
      const name = sectionDisplayName(section);
      const ops = validateEditOperations([
        { operation: "insertSection", type: section as InsertableSectionType },
        {
          operation: "moveSection",
          section,
          position: moveOp.position,
          ...(moveOp.relativeTo ? { relativeTo: moveOp.relativeTo } : {}),
        },
      ]);
      const before = input.project;
      const applied = applyEditOperations(before, ops);
      const verified = verifyEditExecution(before, applied.project, ops);
      const status = applyStatusFromExecution(verified);
      const followUp = verified.followUpRecommendation
        ? [verified.followUpRecommendation]
        : [];
      let project = applied.project;
      project = withActionMemory(
        project,
        storeLastExecution(
          getActionMemory(project),
          toLastExecution(input.request, verified, ops),
        ),
      );

      if (status === "applied") {
        return {
          ok: true,
          explanation: `You’re right — ${name} wasn’t on the page yet. ${verified.explanation}`,
          operations: ops,
          changes: applied.changes.map((c) => ({ ...c, ok: true })),
          project,
          applyStatus: "applied",
          decision: repairDecision(verified.explanation),
          followUpSuggestions: followUp,
        };
      }

      return {
        ok: true,
        explanation: `You’re right — ${name} isn’t on the page. ${
          verified.explanation ||
          `I can’t move ${name} until that section exists.`
        }`,
        operations: [],
        changes: [],
        project: withActionMemory(
          input.project,
          storeLastExecution(
            memory,
            toLastExecution(input.request, verified, []),
          ),
        ),
        applyStatus: "needs_clarification",
        decision: repairDecision(verified.explanation),
        followUpSuggestions: verified.followUpRecommendation
          ? [verified.followUpRecommendation]
          : [`Add ${name}`],
      };
    }

    // Section exists — check position truthfully.
    const positionCheck = verifyMoveSection(input.project, input.project, {
      section: moveOp.section,
      position: moveOp.position,
      relativeTo: moveOp.relativeTo,
    });
    if (positionCheck.success && positionCheck.verified) {
      // verifyMoveSection treats identical before/after as no-op warning when not created.
      // For dispute with identical snapshots, check positionMatches via warnings/failures.
    }
    if (
      positionCheck.warnings.some((w) => /already in that position/i.test(w)) ||
      /already in that position/i.test(positionCheck.explanation)
    ) {
      const name = sectionDisplayName(moveOp.section);
      return {
        ok: true,
        explanation: `I checked — ${name} is already in the position you asked for. If you’re looking at a different preview, try refreshing the canvas.`,
        operations: [],
        changes: [],
        project: input.project,
        applyStatus: "no_changes",
        decision: repairDecision(positionCheck.explanation),
        followUpSuggestions: positionCheck.followUpRecommendation
          ? [positionCheck.followUpRecommendation]
          : ["Review my website"],
      };
    }

    if (!positionCheck.success) {
      // Re-apply the move now that we're repairing.
      try {
        const ops = validateEditOperations([
          {
            operation: "moveSection",
            section: moveOp.section,
            position: moveOp.position,
            ...(moveOp.relativeTo ? { relativeTo: moveOp.relativeTo } : {}),
          },
        ]);
        const before = input.project;
        const applied = applyEditOperations(before, ops);
        const verified = verifyEditExecution(before, applied.project, ops);
        if (verified.success && verified.verified) {
          const project = withActionMemory(
            applied.project,
            storeLastExecution(
              getActionMemory(applied.project),
              toLastExecution(input.request, verified, ops),
            ),
          );
          return {
            ok: true,
            explanation: `You’re right to flag that. ${verified.explanation}`,
            operations: ops,
            changes: applied.changes.map((c) => ({ ...c, ok: true })),
            project,
            applyStatus: "applied",
            decision: repairDecision(verified.explanation),
            followUpSuggestions: verified.followUpRecommendation
              ? [verified.followUpRecommendation]
              : [],
          };
        }
      } catch {
        // fall through to explain
      }
      return {
        ok: true,
        explanation:
          positionCheck.explanation ||
          last.verificationFailures[0] ||
          "I checked the page — that change isn’t reflected right now.",
        operations: [],
        changes: [],
        project: input.project,
        applyStatus: "needs_clarification",
        decision: repairDecision(positionCheck.explanation),
        followUpSuggestions: positionCheck.followUpRecommendation
          ? [positionCheck.followUpRecommendation]
          : last.followUpRecommendation
            ? [last.followUpRecommendation]
            : ["Review my website"],
      };
    }
  }

  // Generic: prior claim failed verification historically, or current state doesn't match.
  if (!last.success || !last.verified || last.verificationFailures.length > 0) {
    return {
      ok: true,
      explanation: `You’re right — that change didn’t fully land. ${
        last.verificationFailures[0] || last.explanation
      }`,
      operations: [],
      changes: [],
      project: input.project,
      applyStatus: "needs_clarification",
      decision: repairDecision(last.explanation),
      followUpSuggestions: last.followUpRecommendation
        ? [last.followUpRecommendation]
        : ["Review my website"],
    };
  }

  // Last execution claimed success — recheck may not detect move without before snapshot.
  // Be honest: inspect failures from recheck when ops are insert/theme/copy.
  if (recheck.verificationFailures.length > 0 || !recheck.success) {
    return {
      ok: true,
      explanation: `I re-checked the page. ${
        recheck.explanation ||
        recheck.verificationFailures[0] ||
        "That change isn’t visible right now."
      }`,
      operations: [],
      changes: [],
      project: input.project,
      applyStatus: "needs_clarification",
      decision: repairDecision(recheck.explanation),
      followUpSuggestions: recheck.followUpRecommendation
        ? [recheck.followUpRecommendation]
        : last.followUpRecommendation
          ? [last.followUpRecommendation]
          : ["Review my website"],
    };
  }

  return {
    ok: true,
    explanation:
      "I re-checked the page — the last change is still reflected. If you’re not seeing it, try refreshing the canvas.",
    operations: [],
    changes: [],
    project: input.project,
    applyStatus: "no_changes",
    decision: repairDecision("Previous edit still reflected."),
    followUpSuggestions: ["Review my website"],
  };
}
