/**
 * Guarded Taste polish execution — one atomic batch, verify, keep or rollback.
 */

import { applyEditOperations } from "@/lib/ai/apply-edit-operations";
import { createRevisionId } from "@/lib/ai/editor-revisions";
import { validateEditOperations } from "@/lib/ai/validate-edit-operations";
import type { CreativeDirectorEvaluation } from "@/lib/creative-director/types";
import { evaluateWebsiteAsCreativeDirector } from "@/lib/creative-director";
import { evaluateTaste } from "@/lib/taste/evaluation";
import { assessTastePolishEligibility } from "@/lib/taste/polish-eligibility";
import { planTastePolish } from "@/lib/taste/polish-plan";
import {
  listChangedRoots,
  tastePolishOperationsInScope,
  tastePolishScopeViolations,
} from "@/lib/taste/polish-scope";
import {
  TASTE_POLISH_VERSION,
  type TastePolishDiagnostics,
  type TastePolishResult,
  type TastePolishVerdict,
} from "@/lib/taste/polish-types";
import { formatTastePolishExplanation } from "@/lib/taste/polish-presentation";
import type { TasteDimensionId, TasteEvaluation } from "@/lib/taste/types";
import { verifyTasteImprovement } from "@/lib/taste/recommendations";
import type { BusinessProject } from "@/types/business-project";

function cloneProject(project: BusinessProject): BusinessProject {
  return JSON.parse(JSON.stringify(project)) as BusinessProject;
}

function dimensionDeltas(
  before: TasteEvaluation,
  after: TasteEvaluation,
  targets: string[],
): Partial<Record<TasteDimensionId, number>> {
  const deltas: Partial<Record<TasteDimensionId, number>> = {};
  for (const id of targets) {
    const key = id as TasteDimensionId;
    deltas[key] = (after[key] ?? 0) - (before[key] ?? 0);
  }
  return deltas;
}

function structureStillSound(
  beforeEval: CreativeDirectorEvaluation | null,
  afterEval: CreativeDirectorEvaluation,
): boolean {
  if (afterEval.dimensions.accessibility + 1 < (beforeEval?.dimensions.accessibility ?? afterEval.dimensions.accessibility)) {
    return false;
  }
  if (afterEval.dimensions.conversion + 2 < (beforeEval?.dimensions.conversion ?? afterEval.dimensions.conversion)) {
    return false;
  }
  if (
    afterEval.dimensions.visualHierarchy + 2 <
    (beforeEval?.dimensions.visualHierarchy ?? afterEval.dimensions.visualHierarchy)
  ) {
    return false;
  }
  const band = afterEval.health.qualityBand?.toLowerCase() ?? "";
  if (band.includes("poor") || band.includes("developing")) return false;
  return true;
}

export function logTastePolishDiagnostics(
  diag: TastePolishDiagnostics,
  requestId?: string | null,
): void {
  if (process.env.NODE_ENV !== "development") return;
  console.info("[atlas:taste:polish]", {
    requestId: requestId ?? null,
    ...diag,
  });
}

/**
 * Apply at most one guarded polish pass.
 */
export function executeTastePolish(input: {
  project: BusinessProject;
  taste?: TasteEvaluation | null;
  evaluation?: CreativeDirectorEvaluation | null;
  requestId?: string | null;
  logDiagnostics?: boolean;
  criticalVerificationFailure?: boolean;
}): TastePolishResult {
  const baseline = cloneProject(input.project);
  const tasteBefore =
    input.taste ??
    evaluateTaste({
      project: baseline,
      evaluation: input.evaluation ?? null,
    });

  const eligibility = assessTastePolishEligibility({
    project: baseline,
    taste: tasteBefore,
    evaluation: input.evaluation,
    criticalVerificationFailure: input.criticalVerificationFailure,
  });

  const empty = (
    verdict: TastePolishVerdict,
    explanation: string,
  ): TastePolishResult => ({
    version: TASTE_POLISH_VERSION,
    verdict,
    applied: false,
    project: baseline,
    plan: null,
    operations: [],
    baselineTaste: tasteBefore.overallTaste,
    finalTaste: tasteBefore.overallTaste,
    targetDimensions: [],
    dimensionDeltas: {},
    explanation,
    rollbackPerformed: false,
    scopeViolations: [],
    tasteBefore,
    tasteAfter: tasteBefore,
    revisionId: null,
  });

  if (!eligibility.allowed) {
    const result = empty(
      "ineligible",
      eligibility.reasons[0]
        ? `${eligibility.reasons[0]} I’ll keep Taste advisory until the structural issues are fixed.`
        : "This site isn’t ready for a final polish pass yet — structural issues should be fixed first.",
    );
    if (input.logDiagnostics) {
      logTastePolishDiagnostics({
        baselineTaste: result.baselineTaste,
        finalTaste: result.finalTaste,
        targetDimensions: [],
        dimensionDeltas: {},
        eligibleToJudge: eligibility.eligibleToJudge,
        polishOperations: [],
        scopeViolations: [],
        rollbackPerformed: false,
        finalVerdict: "ineligible",
      }, input.requestId);
    }
    return result;
  }

  const plan = planTastePolish(baseline, tasteBefore, input.evaluation);

  if (plan.alreadyPolished) {
    const result = empty("already_polished", plan.rationale);
    result.plan = plan;
    if (input.logDiagnostics) {
      logTastePolishDiagnostics({
        baselineTaste: result.baselineTaste,
        finalTaste: result.finalTaste,
        targetDimensions: [],
        dimensionDeltas: {},
        eligibleToJudge: true,
        polishOperations: [],
        scopeViolations: [],
        rollbackPerformed: false,
        finalVerdict: "already_polished",
      }, input.requestId);
    }
    return result;
  }

  if (plan.ineligibleReason) {
    return empty("ineligible", plan.ineligibleReason);
  }

  if (plan.operations.length === 0) {
    return empty(
      "no_operations",
      "I couldn’t find a safe polish change that would improve finish without redesigning the site.",
    );
  }

  const opScope = tastePolishOperationsInScope(plan.operations);
  if (opScope.length > 0) {
    return empty(
      "ineligible",
      "The polish plan touched operations outside the guarded taste scope.",
    );
  }

  let appliedProject: BusinessProject;
  try {
    const ops = validateEditOperations(plan.operations);
    appliedProject = applyEditOperations(baseline, ops).project;
  } catch {
    return empty(
      "no_operations",
      "The polish operations could not be validated safely.",
    );
  }

  const scopeViolations = tastePolishScopeViolations(baseline, appliedProject);
  if (scopeViolations.length > 0) {
    const result = empty(
      "rolled_back",
      "I rolled back the polish pass to protect brand, content, and structure.",
    );
    result.scopeViolations = scopeViolations;
    result.rollbackPerformed = true;
    result.plan = plan;
    if (input.logDiagnostics) {
      logTastePolishDiagnostics({
        baselineTaste: tasteBefore.overallTaste,
        finalTaste: tasteBefore.overallTaste,
        targetDimensions: plan.targetDimensions,
        dimensionDeltas: {},
        eligibleToJudge: true,
        polishOperations: plan.operations.map((o) => o.operation),
        scopeViolations,
        rollbackPerformed: true,
        finalVerdict: "rolled_back",
      }, input.requestId);
    }
    return result;
  }

  // Unexpected roots changed → rollback
  const changed = listChangedRoots(baseline, appliedProject).filter(
    (k) =>
      ![
        "creativePolish",
        "heroOverlay",
        "heroTreatment",
        "buttonStyle",
        "atlasActionMemory",
        "atlasMemory",
        "updatedAt",
        "designAssistant",
      ].includes(k),
  );
  if (changed.length > 0) {
    const result = empty(
      "rolled_back",
      "I rolled back the polish pass because unrelated project domains changed.",
    );
    result.scopeViolations = changed;
    result.rollbackPerformed = true;
    result.plan = plan;
    return result;
  }

  const tasteAfter = evaluateTaste({
    project: appliedProject,
    evaluation: input.evaluation ?? null,
  });
  const deltas = dimensionDeltas(
    tasteBefore,
    tasteAfter,
    plan.targetDimensions,
  );

  const cdBefore =
    input.evaluation ??
    evaluateWebsiteAsCreativeDirector({ project: baseline });
  const cdAfter = evaluateWebsiteAsCreativeDirector({
    project: appliedProject,
  });

  const tasteGain = verifyTasteImprovement({
    before: tasteBefore,
    after: tasteAfter,
  });
  const targetsImproved = plan.targetDimensions.some(
    (d) => (deltas[d] ?? 0) > 0,
  );
  const meaningful =
    tasteGain.ok ||
    tasteAfter.overallTaste >= tasteBefore.overallTaste + 1 ||
    targetsImproved;

  let verdict: TastePolishVerdict = "applied";
  let rollbackPerformed = false;
  let project = appliedProject;
  let finalTaste = tasteAfter.overallTaste;
  let explanation = formatTastePolishExplanation({
    plan,
    tasteBefore,
    tasteAfter,
  });

  if (!meaningful) {
    project = baseline;
    rollbackPerformed = true;
    verdict = "rolled_back";
    finalTaste = tasteBefore.overallTaste;
    explanation =
      "I tested a polish pass, but it didn’t improve finish enough — I kept the previous version.";
  } else if (!structureStillSound(cdBefore, cdAfter)) {
    project = baseline;
    rollbackPerformed = true;
    verdict = "rolled_back";
    finalTaste = tasteBefore.overallTaste;
    explanation =
      "I rolled back the polish pass because accessibility, hierarchy, or conversion clarity regressed.";
  } else if (cdAfter.dimensions.accessibility < cdBefore.dimensions.accessibility) {
    project = baseline;
    rollbackPerformed = true;
    verdict = "rolled_back";
    finalTaste = tasteBefore.overallTaste;
    explanation =
      "I rolled back the polish pass because accessibility worsened.";
  }

  const revisionId = verdict === "applied" ? createRevisionId() : null;

  const result: TastePolishResult = {
    version: TASTE_POLISH_VERSION,
    verdict,
    applied: verdict === "applied",
    project,
    plan,
    operations: verdict === "applied" ? plan.operations : [],
    baselineTaste: tasteBefore.overallTaste,
    finalTaste,
    targetDimensions: plan.targetDimensions,
    dimensionDeltas: verdict === "applied" ? deltas : {},
    explanation,
    rollbackPerformed,
    scopeViolations: [],
    tasteBefore,
    tasteAfter: verdict === "applied" ? tasteAfter : tasteBefore,
    revisionId,
  };

  if (input.logDiagnostics) {
    logTastePolishDiagnostics({
      baselineTaste: result.baselineTaste,
      finalTaste: result.finalTaste,
      targetDimensions: plan.targetDimensions,
      dimensionDeltas: result.dimensionDeltas,
      eligibleToJudge: true,
      polishOperations: plan.operations.map((o) => o.operation),
      scopeViolations: result.scopeViolations,
      rollbackPerformed,
      finalVerdict: verdict,
    }, input.requestId);
  }

  return result;
}
