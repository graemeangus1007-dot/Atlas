/**
 * Atlas Brain — orchestration layer (Sprint 26.0A / 26.1).
 * Every conversation turn flows through Brain before specialists run.
 * Users only ever talk to “Atlas”.
 *
 * Sprint 29.1 — interaction writes go through `setInteractionState` /
 * `updateInteractionState` / active-visual-task helpers (adapter-backed).
 * Do not assign `atlasActionMemory` directly. See docs/atlas-interaction-ownership.md.
 */

import {
  clearPendingClarification,
  clearRecommendations,
  detectActionConfirmation,
  getActionMemory,
  hasActiveRecommendations,
  hasPendingClarification,
  isCompleteWebsiteRequest,
  looksLikePlanReference,
  matchClarificationAnswer,
  removeAppliedRecommendations,
  resolvePlanReference,
  selectRecommendationsToApply,
  shouldExecuteActionMemory,
  storeLastExecution,
  storePendingClarification,
  storeRecommendations,
  toAdvisorRecommendations,
  toCreativeRecommendations,
  type AtlasActionMemory,
  type ClarificationDestination,
} from "@/lib/ai/atlas-action-memory";
import {
  buildTransformationPlanForProject,
  executeTransformationPlan,
  transformationRevisionPrompt,
} from "@/lib/transformation";
import {
  buildTransformationFingerprint,
  shouldSkipRepeatedNoGainAttempt,
  storeTransformationAttempt,
} from "@/lib/transformation/attempt-memory";
import { detectTransformationCapabilityGaps } from "@/lib/transformation/capability-gaps";
import { classifyTransformationGoals } from "@/lib/transformation/classify";
import { formatTransformationExecutionReport } from "@/lib/transformation/report";
import { designQualityBandLabel } from "@/lib/creative-director/score-calibration";
import { evaluateWebsiteAsCreativeDirector } from "@/lib/creative-director";
import type { TransformationExecutionResult } from "@/lib/transformation/execution-types";
import {
  getInteractionState,
  normalizeInteractionState,
  recordActiveTaskDiagnostics,
  setInteractionState,
} from "@/lib/ai/interaction-state";
import {
  desiredMotionPresetFromRequest,
  isMotionStateActive,
  motionAlreadyActiveMessage,
  motionAppliedMessage,
  motionFieldsForPreset,
} from "@/lib/ai/motion-model";
import {
  sectionDisplayName,
  type AtlasLastExecution,
  type EditExecutionResult,
} from "@/lib/ai/edit-execution-result";
import { tryRepairDisputedExecution } from "@/lib/ai/execution-repair";
import {
  isSectionOrderRequest,
  parseSectionMoveRequest,
} from "@/lib/ai/section-order";
import {
  applyStatusFromExecution,
  isSectionAlreadyAtIntent,
  isSectionPresentOnPage,
  verifyEditExecution,
  verifyMoveSection,
} from "@/lib/ai/verify-edit-execution";
import {
  analyzeHeroReadability,
  buildHeroReadabilityDiagnostics,
  buildHeroReadabilityExplanation,
  captureBrandPalette,
  defaultHeroPreservationContext,
  filterOperationsForBrandPreservation,
  isBrandRegressionComplaint,
  isHeroReadabilityRequest,
  logHeroReadabilityDiagnostics,
  planHeroReadabilityOperations,
  restoreBrandPalette,
  verifyHeroReadabilityImprovement,
  withHeroReadabilityRepairLevel,
  type ProtectedBrandPalette,
} from "@/lib/ai/hero-readability";
import {
  isSurfaceStyleRequest,
  isSurfaceStyleSoftContinuation,
  planSurfaceStyleOperations,
  surfaceStyleChangedProtectedPalette,
  type SurfaceTarget,
} from "@/lib/ai/surface-styling";
import {
  isHeroImageVisibilityComplaint,
  logHeroBalanceDiagnostics,
  planHeroBalanceRepair,
  verifyHeroBalanceRepair,
} from "@/lib/ai/hero-visual-balance";
import {
  buildHeroIntentDiagnostics,
  diagnoseGreyAreaSource,
  galleryMayOwnRequest,
  isActiveHeroTask,
  isHeroDomainRequest,
  isHeroGreyAreaComplaint,
  logHeroIntentDiagnostics,
} from "@/lib/ai/hero-intent";
import {
  getActiveVisualTask,
  shouldContinueActiveHeroTask,
  touchActiveVisualTask,
} from "@/lib/ai/active-visual-task";
import {
  applyVisualCompositionRefinementPlan,
  classifyVisualCompositionIntent,
  explainHeroComposition,
  isExplicitVisualCompositionCommand,
  isVisualCompositionExplanationRequest,
  isVisualCompositionRefinementRequest,
  logVisualCompositionRoutingDiagnostics,
  planVisualCompositionRefinement,
} from "@/lib/composition";
import {
  canContinueActiveTask,
  clearActiveTask,
  detectFreshTaskIntent,
  isExplicitTopicSwitch,
  shouldClearActiveTask,
  touchActiveTask,
} from "@/lib/ai/active-task-policy";
import {
  explainHeroFitVerificationFailure,
  isHeroFitRequest,
  isHeroProfessionalCompositionRequest,
  isSoftHeroVisibilityRequest,
  logHeroFitDiagnostics,
  normalizeHeroFitMode,
  objectFitCss,
  planHeroFitOperations,
  planHeroProfessionalComposition,
  readHeroImagePresentation,
  verifyHeroFitChange,
} from "@/lib/ai/hero-image-presentation";
import {
  isExecutableHeroPatternId,
  isHeroPatternApplicationRequest,
  isHeroPatternRedesignRequest,
  matchExplicitHeroPatternRequest,
  planHeroPatternApplication,
  prepareHeroPatternComposition,
  verifyHeroPatternApplication,
  type ExecutableHeroPatternId,
} from "@/lib/ai/hero-pattern-application";
import { composeDesignPatterns } from "@/lib/ai/design-patterns/composition";
import { logHeroCompositionDiagnostics } from "@/lib/hero-composition";
import {
  isGalleryLightboxRequest,
  isGalleryLightboxSoftContinuation,
  planGalleryInteractionContinuation,
  planGalleryLightboxOperations,
  verifyGalleryLightbox,
} from "@/lib/ai/gallery-interaction";
import {
  isGalleryMetadataRequest,
  isGalleryMetadataSoftContinuation,
  planGalleryMetadataOperations,
} from "@/lib/ai/gallery-metadata";
import { NAMED_COLORS } from "@/lib/ai/named-colors";
import { updateAtlasMemory } from "@/lib/ai/atlas-brain-memory";
import {
  formatNaturalPreferenceNote,
} from "@/lib/ai/atlas-brain-decision-engine";
import {
  decideAtlasBrain,
  formatExecutionPlanForUser,
} from "@/lib/ai/atlas-brain-routing";
import type {
  AtlasBrainDecision,
  AtlasExecutionPlan,
  AtlasProjectMemory,
} from "@/lib/ai/atlas-brain-types";
import { ATLAS_BRAIN_CLARIFICATION_OPTIONS } from "@/lib/ai/atlas-brain-types";
import { ATLAS_VOICE } from "@/lib/ai/atlas-designer-voice";
import { reviewBusinessProject } from "@/lib/ai/business-advisor";
import {
  applyAllCreativeRecommendations,
  applyCreativeRecommendation,
} from "@/lib/ai/apply-creative-recommendation";
import { applyAdvisorRecommendation } from "@/lib/ai/apply-advisor-recommendation";
import {
  creativeDirectorFingerprint,
  reviewCreativeDirector,
} from "@/lib/ai/creative-director";
import {
  isDesignCritiqueExecuteRequest,
} from "@/lib/ai/design-critique";
import {
  shouldOverridePendingClarification,
} from "@/lib/ai/critique-request";
import {
  CRITIQUE_PIPELINE_VERSION,
  invalidateCritiquePipelineCache,
  runAtlasCritiquePipeline,
} from "@/lib/ai/critique-pipeline";
import { formatRecommendationSupportPlan } from "@/lib/ai/critique-to-operations";
import {
  createAiRequestId,
  logAtlasBrainRouting,
} from "@/lib/ai/openai-logging";
import {
  isNaturalLanguageEditRequest,
  planNaturalLanguageEdits,
  shouldExecuteNlEditPlan,
} from "@/lib/ai/nl-edit-planner";
import type {
  EditorAgentHistoryItem,
  EditorAgentInput,
  EditorAgentResult,
} from "@/lib/ai/editor-agent";
import {
  isInsertableSectionType,
  type EditChangeSummary,
  type EditOperation,
  type InsertableSectionType,
} from "@/lib/ai/edit-operations";
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
import {
  executeTastePolish,
  isTastePolishRequest,
  tastePolishMentionsInternalIds,
} from "@/lib/taste";
import {
  CONVERSION_DIRECTOR_FOLLOW_UPS,
  conversionTextExposesInternalIds,
  evaluateConversion,
  formatConversionDirectorReport,
  isConversionDirectorRequest,
} from "@/lib/conversion";
import {
  arbitrateReviewRecommendations,
  assessStrategicPriorities,
  buildExecutionTraceBase,
  buildReviewPlanSnapshot,
  classifyStrategicRequest,
  enrichStoredRecommendation,
  formatApplyAllDispositionReport,
  formatStrategicCompletionReport,
  formatStrategicDirectorReport,
  formatStrategicallyPrioritizedReview,
  hasRecentNoGainCompletion,
  isIdempotentCompletion,
  isReviewPlanStale,
  isStrategicAdvisoryRequest,
  isStrategicCompletionRequest,
  logReviewPlanDiagnostics,
  logStrategicCompletionDiagnostics,
  domainsAlignWithObjective,
  mutationDomainsFromOperations,
  preApplyDisposition,
  projectRevisionFromFingerprint,
  strategicTextExposesInternalIds,
  STRATEGIC_COMPLETION_FOLLOW_UPS,
  STRATEGIC_DIRECTOR_FOLLOW_UPS,
  type RecommendationExecutionTrace,
} from "@/lib/strategy";
import {
  filterFollowUpsForOwner,
  logScopeDiagnostics,
} from "@/lib/scope";
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

function hasUsableMedia(project: BusinessProject): boolean {
  return (project.mediaLibrary ?? []).some((asset) => !asset.unavailable);
}

/** Drop “Add matching images” chips when the library is empty. */
function followUpsForProject(
  project: BusinessProject,
  suggestions: string[],
): string[] {
  const hasMedia = hasUsableMedia(project);
  return suggestions
    .filter((item) => {
      if (!hasMedia && /matching images/i.test(item)) return false;
      return true;
    })
    .slice(0, 4);
}

function confirmDecision(
  goal: string,
  explanation: string,
): AtlasBrainDecision {
  return {
    intent: "recommend",
    confidence: 0.99,
    selectedAgents: ["creative_director"],
    needsClarification: false,
    executionPlan: {
      goal,
      steps: [
        {
          id: "action.apply",
          agent: "creative_director",
          label: "Apply the pending improvements",
        },
      ],
      estimatedImpact: "high",
    },
    explanation,
    followUpSuggestions: [
      "Add matching images",
      "Improve SEO",
      "Add subtle animations",
    ],
  };
}

function dedupeChangeLabels(changes: EditChangeSummary[]): EditChangeSummary[] {
  const seen = new Set<string>();
  const out: EditChangeSummary[] = [];
  for (const change of changes) {
    const key = change.label.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(change);
  }
  return out;
}

function persistTransformationAttempt(
  project: BusinessProject,
  tx: TransformationExecutionResult,
  goalIds: import("@/lib/transformation/types").TransformationGoalId[],
): BusinessProject {
  const fingerprint = buildTransformationFingerprint({
    project: tx.baselineProject,
    goalIds,
  });
  const memory = storeTransformationAttempt(getActionMemory(project), {
    fingerprint,
    goalIds,
    overallDelta: tx.verifiedScoreDelta,
    baselineScore: tx.baselineScore,
    at: new Date().toISOString(),
    capabilityGaps: tx.capabilityGaps ?? [],
  });
  return setInteractionState(project, memory);
}

function skippedRepeatTransformationResult(input: {
  project: BusinessProject;
  plan: import("@/lib/transformation/types").TransformationPlan;
  prior: NonNullable<ReturnType<typeof shouldSkipRepeatedNoGainAttempt>>;
}): TransformationExecutionResult {
  const evaluation = evaluateWebsiteAsCreativeDirector({
    project: input.project,
  });
  const classified = classifyTransformationGoals({
    plan: input.plan,
    project: input.project,
  });
  const capabilityGaps =
    input.prior.capabilityGaps?.length
      ? input.prior.capabilityGaps
      : detectTransformationCapabilityGaps({
          project: input.project,
          plan: input.plan,
          evaluation,
          classified,
        });
  const score = evaluation.dimensions.overallDesignScore;
  const result: TransformationExecutionResult = {
    planId: `tx-skip-${input.prior.fingerprint}`,
    status: "already_satisfied",
    baselineScore: score,
    finalScore: score,
    verifiedScoreDelta: 0,
    executedGoals: [],
    blockedGoals: [],
    failedGoals: [],
    revisionsCreated: [],
    refinementApplied: false,
    tastePolishApplied: false,
    summary: "",
    project: input.project,
    operations: [],
    changes: [],
    baselineProject: input.project,
    preflight: {
      passed: true,
      planValidationPassed: true,
      dependenciesSatisfiable: true,
      brandCaptured: true,
      revisionBaselineValid: true,
      issues: [],
      blockedGoalIds: [],
      readyGoalIds: [],
    },
    wholePage: {
      passed: true,
      baselineScore: score,
      finalScore: score,
      verifiedScoreDelta: 0,
      highestPriorityImproved: false,
      accessibilityRegression: false,
      brandIntegrityRegression: false,
      criticalDependencyFailed: false,
      notes: ["Skipped identical zero-delta transformation plan"],
    },
    batchResults: [],
    rollbackPerformed: false,
    rollbackScope: "none",
    capabilityGaps,
    qualityBand: designQualityBandLabel(score),
    skippedAsRepeat: true,
  };
  result.summary = formatTransformationExecutionReport(result);
  return result;
}

/**
 * Apply All for a strategically arbitrated Review plan.
 * Accounts for every approved recommendation; never silently substitutes polish.
 */
function executeReviewPlanApplyAll(input: {
  project: BusinessProject;
  memory: AtlasActionMemory;
  request: string;
  snapshot: NonNullable<
    NonNullable<AtlasActionMemory["activePlan"]>["reviewPlanSnapshot"]
  >;
}): AtlasBrainResult {
  const currentRevision = projectRevisionFromFingerprint(
    creativeDirectorFingerprint(input.project),
  );
  const stale = isReviewPlanStale({
    snapshot: input.snapshot,
    currentRevision,
  });
  if (stale) {
    const project = setInteractionState(
      withMemory(input.project, input.request),
      clearPendingClarification(input.memory, { reason: "cancelled" }),
    );
    if (process.env.NODE_ENV === "development") {
      logReviewPlanDiagnostics({
        snapshot: input.snapshot,
        stalePlanDetected: true,
      });
    }
    return {
      ok: true,
      explanation:
        "The site changed since this review plan was approved. Ask me to Review my website again so I can reassess against the current project before applying anything.",
      operations: [],
      changes: [],
      project,
      applyStatus: "no_changes",
      decision: confirmDecision(
        "Stale review plan",
        "Project revision diverged from ReviewPlanSnapshot.",
      ),
      followUpSuggestions: [
        "Review my website",
        "Complete my website",
        "What should I fix first?",
      ],
      atlasMemory: project.atlasMemory,
      executionPlan: input.memory.activePlan?.executionPlan,
    };
  }

  const postCompletionEvidence =
    input.snapshot.postCompletionEvidence ||
    hasRecentNoGainCompletion({
      lastAttempt: input.memory.lastTransformationAttempt,
    });
  const highestPriorityDomain = input.snapshot.highestPriorityOpportunityId
    ? inferDomainFromOpportunityId(input.snapshot.highestPriorityOpportunityId)
    : null;

  const planRecs = input.memory.activePlan?.recommendations ?? [];
  const byId = new Map(planRecs.map((r) => [r.id, r]));
  const orderedIds = [
    ...input.snapshot.dependencyOrder,
    ...planRecs
      .map((r) => r.id)
      .filter((id) => !input.snapshot.dependencyOrder.includes(id)),
  ];
  const ordered = orderedIds
    .map((id) => byId.get(id))
    .filter((r): r is NonNullable<typeof r> => Boolean(r));

  let project = input.project;
  const changes: EditChangeSummary[] = [];
  const operations: Array<EditOperation | ImageOperation> = [];
  const traces: RecommendationExecutionTrace[] = [];
  const appliedIds: string[] = [];

  for (const rec of ordered) {
    const base = buildExecutionTraceBase(rec);
    const pre = preApplyDisposition({
      recommendation: rec,
      postCompletionEvidence,
      highestPriorityDomain,
    });
    if (pre) {
      traces.push({
        ...base,
        disposition: pre.disposition,
        reason: pre.reason,
        actualMutationDomains: [],
        verificationResult: pre.verificationResult,
      });
      continue;
    }

    const creative = toCreativeRecommendations([rec]);
    const target = creative[0];
    if (!target) {
      traces.push({
        ...base,
        disposition: "blocked_unsupported",
        reason: "Could not map recommendation for execution.",
        actualMutationDomains: [],
        verificationResult: "unmapable",
      });
      continue;
    }

    const result = applyCreativeRecommendation({
      project,
      recommendation: target,
    });
    if (!result.ok) {
      traces.push({
        ...base,
        disposition: "failed_verification",
        reason: "Application failed.",
        actualMutationDomains: [],
        verificationResult: "apply_failed",
      });
      continue;
    }

    if (result.status !== "applied" || result.changes.length === 0) {
      traces.push({
        ...base,
        disposition: "already_satisfied",
        reason: "Already reflected on the site.",
        actualMutationDomains: [],
        verificationResult: "already_satisfied",
      });
      appliedIds.push(rec.id);
      continue;
    }

    const actualDomains = mutationDomainsFromOperations(target.operations);
    if (!domainsAlignWithObjective(base.domain, actualDomains)) {
      // Do not keep mutations that fail domain/objective verification.
      traces.push({
        ...base,
        disposition: "failed_verification",
        reason:
          "Mutations did not match the recommendation domain — change was not kept.",
        actualMutationDomains: actualDomains,
        verificationResult: "domain_mismatch_rejected",
      });
      continue;
    }

    project = result.project;
    changes.push(...result.changes);
    operations.push(...target.operations);
    appliedIds.push(rec.id);
    traces.push({
      ...base,
      disposition: "applied",
      actualMutationDomains: actualDomains,
      verificationResult: "verified",
      reason: "Improved the site and was kept.",
    });
  }

  if (process.env.NODE_ENV === "development") {
    logReviewPlanDiagnostics({
      snapshot: input.snapshot,
      dispositions: traces,
      stalePlanDetected: false,
    });
  }

  const anyApplied = traces.some((t) => t.disposition === "applied");
  if (anyApplied) {
    invalidateCritiquePipelineCache(creativeDirectorFingerprint(project));
  }

  const nextMemory = clearRecommendations(
    clearPendingClarification(input.memory, { reason: "resolved" }),
  );
  project = setInteractionState(withMemory(project, input.request), nextMemory);
  if (anyApplied) {
    project = touchActiveTask(project, {
      kind: "plan_execution",
      target: { type: "plan" },
      userGoal: input.request,
    });
  }

  return {
    ok: true,
    explanation: formatApplyAllDispositionReport(traces),
    operations: anyApplied ? operations : [],
    changes: anyApplied ? dedupeChangeLabels(changes) : [],
    project,
    applyStatus: anyApplied ? "applied" : "no_changes",
    decision: confirmDecision(
      "Apply approved review plan",
      "Dispositioned every approved recommendation in strategic order.",
    ),
    followUpSuggestions: [
      "Review my website",
      "Complete my website",
      "Improve SEO",
    ],
    executionPlan: input.memory.activePlan?.executionPlan,
    atlasMemory: project.atlasMemory,
  };
}

function inferDomainFromOpportunityId(id: string): string | null {
  const map: Record<string, string> = {
    cta: "cta",
    contact_flow: "contact_flow",
    trust: "trust",
    proof: "trust",
    spacing_polish: "spacing",
    visual_polish: "visual_polish",
    narrative: "narrative",
    hero_composition: "hero_composition",
    motion: "motion",
  };
  return map[id] ?? id;
}

function applyActionMemoryRecommendations(input: {
  project: BusinessProject;
  memory: AtlasActionMemory;
  request: string;
  destination?: ClarificationDestination | null;
  recommendationIds?: string[];
}): AtlasBrainResult {
  const confirmationEarly = detectActionConfirmation(input.request);
  // Complete my website never reaches here — handled by Strategic→Transformation handoff.
  const wantsFullPlan = confirmationEarly.kind === "apply_all";
  const activeTxPlan = input.memory.activePlan?.transformationPlan ?? null;
  const reviewSnapshot = input.memory.activePlan?.reviewPlanSnapshot ?? null;

  // v1.6.2 — Apply All on a Strategic Review plan: disposition every recommendation.
  // Do not run a second independent Transformation strategy or cosmetic polish substitute.
  if (
    wantsFullPlan &&
    reviewSnapshot &&
    !input.recommendationIds?.length &&
    !looksLikePlanReference(input.request)
  ) {
    return executeReviewPlanApplyAll({
      project: input.project,
      memory: input.memory,
      request: input.request,
      snapshot: reviewSnapshot,
    });
  }

  // Apply All → coordinated Transformation Engine when a plan is active (no Review snapshot).
  if (
    wantsFullPlan &&
    activeTxPlan &&
    !input.recommendationIds?.length &&
    !looksLikePlanReference(input.request)
  ) {
    const goalIds = activeTxPlan.goals.map((g) => g.id);
    const fingerprint = buildTransformationFingerprint({
      project: input.project,
      goalIds,
    });
    const prior = shouldSkipRepeatedNoGainAttempt({
      memory: input.memory,
      fingerprint,
    });
    const tx = prior
      ? skippedRepeatTransformationResult({
          project: input.project,
          plan: activeTxPlan,
          prior,
        })
      : executeTransformationPlan({
          project: input.project,
          plan: activeTxPlan,
          logDiagnostics: process.env.NODE_ENV === "development",
        });
    const txApplied =
      (tx.status === "applied" || tx.status === "partially_applied") &&
      tx.operations.length > 0;

    if (txApplied) {
      let project = withMemory(tx.project, input.request);
      project = setInteractionState(
        project,
        clearRecommendations(
          clearPendingClarification(getActionMemory(project), {
            reason: "resolved",
          }),
        ),
      );
      project = persistTransformationAttempt(project, tx, goalIds);
      invalidateCritiquePipelineCache(creativeDirectorFingerprint(project));
      return {
        ok: true,
        explanation: tx.summary,
        operations: tx.operations,
        changes: tx.changes,
        project,
        applyStatus: "applied",
        decision: confirmDecision(
          "Apply transformation plan",
          transformationRevisionPrompt(tx.planId),
        ),
        followUpSuggestions: followUpsForProject(project, [
          "Review my website",
          "Add matching images",
          "Improve SEO",
        ]),
        executionPlan: input.memory.activePlan?.executionPlan,
        atlasMemory: project.atlasMemory,
      };
    }

    // Ordinary critique plans: if the transformation had nothing safe to apply,
    // fall through to recommendation Apply All so queued ops still run.
    const hasApplyableRecs = (input.memory.activePlan?.recommendations ?? []).some(
      (r) => r.applyable && r.operations.length > 0,
    );
    if (!hasApplyableRecs || prior || tx.skippedAsRepeat) {
      let project = withMemory(
        tx.skippedAsRepeat ? input.project : tx.project,
        input.request,
      );
      project = setInteractionState(
        project,
        clearRecommendations(
          clearPendingClarification(getActionMemory(project), {
            reason: "resolved",
          }),
        ),
      );
      if (!tx.skippedAsRepeat) {
        project = persistTransformationAttempt(project, tx, goalIds);
      } else {
        // Keep prior attempt timestamp / gaps for consecutive Completes
        project = setInteractionState(
          project,
          storeTransformationAttempt(getActionMemory(project), {
            ...prior!,
            at: new Date().toISOString(),
          }),
        );
      }
      return {
        ok: true,
        explanation: tx.summary,
        operations: [],
        changes: [],
        project,
        applyStatus: "no_changes",
        decision: confirmDecision(
          "Apply transformation plan",
          transformationRevisionPrompt(tx.planId),
        ),
        followUpSuggestions: followUpsForProject(project, [
          "Review my website",
          "Add matching images",
          "Improve SEO",
        ]),
        executionPlan: input.memory.activePlan?.executionPlan,
        atlasMemory: project.atlasMemory,
      };
    }
  }

  const planRef = resolvePlanReference(input.request, input.memory);
  if (planRef.kind === "out_of_range" || (planRef.reason && !planRef.matched)) {
    const project = setInteractionState(
      withMemory(input.project, input.request),
      clearPendingClarification(input.memory, { reason: "cancelled" }),
    );
    return {
      ok: true,
      explanation:
        planRef.reason ??
        "Which recommendation number should I apply from the current plan?",
      operations: [],
      changes: [],
      project,
      applyStatus: "needs_clarification",
      decision: confirmDecision(
        "Clarify plan reference",
        "Ordinal was out of range for the active plan.",
      ),
      followUpSuggestions: [
        "Apply the first one",
        "Apply All",
        "Review my website",
      ],
      atlasMemory: project.atlasMemory,
      executionPlan: input.memory.activePlan?.executionPlan,
    };
  }

  if (planRef.kind === "unsupported" && planRef.reason) {
    const project = setInteractionState(
      withMemory(input.project, input.request),
      clearPendingClarification(input.memory, { reason: "cancelled" }),
    );
    return {
      ok: true,
      explanation: planRef.reason,
      operations: [],
      changes: [],
      project,
      applyStatus: "no_changes",
      decision: confirmDecision(
        "Unsupported recommendation",
        "Selected recommendation cannot be auto-applied.",
      ),
      followUpSuggestions: [
        "Apply the first one",
        "Apply All",
        "Review my website",
      ],
      atlasMemory: project.atlasMemory,
      executionPlan: input.memory.activePlan?.executionPlan,
    };
  }

  const confirmation = detectActionConfirmation(input.request);
  if (planRef.matched && planRef.recommendationId) {
    confirmation.recommendationId = planRef.recommendationId;
    if (planRef.ordinal != null) {
      confirmation.kind = "ordinal";
      confirmation.ordinalIndex = planRef.ordinal - 1;
    }
  }

  const selected = input.recommendationIds?.length
    ? (input.memory.activePlan?.recommendations ?? []).filter(
        (r) => input.recommendationIds!.includes(r.id) && r.applyable,
      )
    : selectRecommendationsToApply(
        input.memory,
        confirmation,
        input.destination,
      );

  if (selected.length === 0) {
    const project = setInteractionState(
      withMemory(input.project, input.request),
      clearPendingClarification(input.memory, { reason: "cancelled" }),
    );
    return {
      ok: true,
      explanation:
        "I don’t have applyable improvements queued right now. Ask me to review the site and I’ll share a fresh plan.",
      operations: [],
      changes: [],
      project,
      applyStatus: "no_changes",
      decision: confirmDecision("Continue", "No pending improvements to apply."),
      followUpSuggestions: [
        "Review my website",
        "Complete my website",
        "Make it feel more polished",
      ],
      atlasMemory: project.atlasMemory,
    };
  }

  let project = input.project;
  const changes: EditChangeSummary[] = [];
  const operations: Array<EditOperation | ImageOperation> = [];
  const appliedTitles: string[] = [];
  const appliedIds: string[] = [];

  const creative = toCreativeRecommendations(selected);
  let applyAllNote = "";
  if (creative.length > 0) {
    const batch = applyAllCreativeRecommendations({
      project,
      recommendations: creative,
    });
    if (batch.ok) {
      if (batch.status === "applied") {
        invalidateCritiquePipelineCache(
          creativeDirectorFingerprint(batch.project),
        );
        project = batch.project;
        changes.push(...batch.changes);
        appliedTitles.push(
          ...creative
            .filter((r) => batch.appliedIds.includes(r.id))
            .map((r) => r.title),
        );
        appliedIds.push(...batch.appliedIds);
        for (const rec of creative) {
          if (batch.appliedIds.includes(rec.id)) {
            operations.push(...rec.operations);
          }
        }
      }
      applyAllNote = batch.explanation;
    }
  }

  const advisor = toAdvisorRecommendations(selected);
  for (const rec of advisor) {
    const applied = applyAdvisorRecommendation({ project, recommendation: rec });
    if (applied.ok && applied.status === "applied") {
      project = applied.project;
      changes.push(...applied.changes);
      appliedTitles.push(rec.title);
      appliedIds.push(rec.id);
      operations.push(...rec.operations);
    }
  }

  const uniqueChanges = dedupeChangeLabels(changes);
  // Drop selected recommendations from the active plan (applied or already satisfied).
  const idsToRemove = selected.map((r) => r.id);
  const nextMemory = removeAppliedRecommendations(
    clearPendingClarification(input.memory, { reason: "resolved" }),
    idsToRemove,
  );
  project = setInteractionState(withMemory(project, input.request), nextMemory);

  const applied = appliedTitles.length > 0;
  if (applied) {
    project = touchActiveTask(project, {
      kind: "plan_execution",
      target: { type: "plan" },
      userGoal: input.request,
    });
  }
  const explanation = [
    applied
      ? [
          `${appliedTitles.length} recommendation${appliedTitles.length === 1 ? "" : "s"} applied`,
          `${uniqueChanges.length} website change${uniqueChanges.length === 1 ? "" : "s"} made`,
          ...appliedTitles.slice(0, 6).map((title) => `• ${title}`),
        ].join("\n")
      : "Those improvements were already in place, so there was nothing new to apply.",
    applyAllNote && applyAllNote.includes("Not applied:")
      ? applyAllNote.slice(applyAllNote.indexOf("Not applied:"))
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  return {
    ok: true,
    explanation,
    operations: applied ? operations : [],
    changes: applied ? uniqueChanges : [],
    project,
    applyStatus: applied ? "applied" : "no_changes",
    decision: confirmDecision(
      "Apply pending improvements",
      "Executing the active recommendation set.",
    ),
    followUpSuggestions: [
      "Add matching images",
      "Improve SEO",
      "Add subtle animations",
    ],
    executionPlan: input.memory.activePlan?.executionPlan,
    atlasMemory: project.atlasMemory,
  };
}

/**
 * Resolve typed clarifications (color / image_target) without plan Apply All.
 */
async function tryResolveTypedClarification(input: {
  project: BusinessProject;
  request: string;
}): Promise<AtlasBrainResult | null> {
  const project = input.project;
  const memory = getActionMemory(project);
  if (!hasPendingClarification(memory) || !memory.pendingClarification) {
    return null;
  }
  const pending = memory.pendingClarification;
  if (pending.kind !== "color" && pending.kind !== "image_target") {
    return null;
  }
  const matched = matchClarificationAnswer(input.request, pending);
  if (!matched) return null;

  if (
    pending.kind === "image_target" &&
    matched.destination !== "apply_gallery_fit"
  ) {
    const cleared = setInteractionState(
      project,
      clearPendingClarification(memory, { reason: "resolved" }),
    );
    const fit = tryApplyHeroFit({
      project: cleared,
      request: "Use the full picture.",
      forceHero: true,
    });
    if (fit) {
      return {
        ...fit,
        explanation:
          fit.applyStatus === "applied"
            ? "Done. I applied the full-image fit to the hero."
            : fit.explanation,
      };
    }
  }

  if (matched.destination === "apply_gallery_fit") {
    const cleared = setInteractionState(
      withMemory(project, input.request),
      clearPendingClarification(memory, { reason: "resolved" }),
    );
    return {
      ok: true,
      explanation:
        "Gallery full-photo fit isn’t available yet. I can apply it to the hero image instead — say Hero image.",
      operations: [],
      changes: [],
      project: cleared,
      applyStatus: "needs_clarification",
      decision: {
        intent: "clarification",
        confidence: 0.85,
        selectedAgents: ["editor_agent"],
        needsClarification: true,
        executionPlan: {
          goal: "Choose hero for full-photo fit",
          steps: [],
          estimatedImpact: "low",
        },
        explanation: "Gallery fit not available.",
        followUpSuggestions: ["Hero image", "Use the full picture"],
      },
      followUpSuggestions: ["Hero image", "Use the full picture"],
    };
  }

  if (matched.resolvedColor && pending.kind === "color") {
    return tryContinueActionMemory(input);
  }

  return null;
}

/**
 * Sprint 26.1 — resolve pending clarification or Apply All without re-routing.
 */
async function tryContinueActionMemory(input: {
  project: BusinessProject;
  request: string;
}): Promise<AtlasBrainResult | null> {
  const memory = getActionMemory(input.project);
  recordActiveTaskDiagnostics({ activePlanConsidered: true });
  if (!shouldExecuteActionMemory(input.request, memory)) {
    return null;
  }
  recordActiveTaskDiagnostics({ activePlanExecuted: true });

  // Ordinal / named plan references run before clarification chips.
  if (
    hasActiveRecommendations(memory) &&
    looksLikePlanReference(input.request)
  ) {
    return applyActionMemoryRecommendations({
      project: input.project,
      memory,
      request: input.request,
    });
  }

  // Clarification must resolve once — never re-ask.
  if (hasPendingClarification(memory) && memory.pendingClarification) {
    const matched = matchClarificationAnswer(
      input.request,
      memory.pendingClarification,
    );
    const confirmation = detectActionConfirmation(input.request);

    // Typed image-target clarification (e.g. user replies “Hero image”).
    if (
      matched &&
      (matched.destination === "apply_hero_fit" ||
        memory.pendingClarification.kind === "image_target") &&
      matched.destination !== "apply_gallery_fit"
    ) {
      const cleared = setInteractionState(
        input.project,
        clearPendingClarification(memory, { reason: "resolved" }),
      );
      const fit = tryApplyHeroFit({
        project: cleared,
        request: "Use the full picture.",
        forceHero: true,
      });
      if (fit) {
        return {
          ...fit,
          explanation:
            fit.applyStatus === "applied"
              ? "Done. I applied the full-image fit to the hero."
              : fit.explanation,
        };
      }
    }

    if (matched?.destination === "apply_gallery_fit") {
      const cleared = setInteractionState(
        withMemory(input.project, input.request),
        clearPendingClarification(memory, { reason: "resolved" }),
      );
      return {
        ok: true,
        explanation:
          "Gallery full-photo fit isn’t available yet. I can apply it to the hero image instead — say Hero image.",
        operations: [],
        changes: [],
        project: cleared,
        applyStatus: "needs_clarification",
        decision: {
          intent: "clarification",
          confidence: 0.85,
          selectedAgents: ["editor_agent"],
          needsClarification: true,
          executionPlan: {
            goal: "Choose hero for full-photo fit",
            steps: [],
            estimatedImpact: "low",
          },
          explanation: "Gallery fit not available.",
          followUpSuggestions: ["Hero image", "Use the full picture"],
        },
        followUpSuggestions: ["Hero image", "Use the full picture"],
      };
    }

    // Typed color clarification (e.g. user replies “gold”).
    if (
      matched?.resolvedColor &&
      (matched.destination === "restore_accent" ||
        matched.destination === "restore_palette" ||
        memory.pendingClarification.kind === "color")
    ) {
      const accent = matched.resolvedColor;
      const before = input.project;
      const ops = validateEditOperations([
        {
          operation: "changeTheme",
          accent,
          ...(matched.destination === "restore_palette" &&
          accent === NAMED_COLORS.gold
            ? {}
            : {}),
        },
      ]);
      const applied = applyEditOperations(before, ops);
      const cleared = setInteractionState(
        applied.project,
        clearPendingClarification(memory, { reason: "resolved" }),
      );
      const project = rememberExecution(
        cleared,
        input.request,
        {
          success: cleared.accentColor === accent,
          verified: cleared.accentColor === accent,
          operationType: "restoreAccentColor",
          verificationFailures:
            cleared.accentColor === accent
              ? []
              : ["accentColor not restored"],
          createdEntities: [],
          modifiedEntities: ["accentColor"],
          warnings: [],
          explanation: `Done. I restored the ${matched.answer} accent and left your other local styling in place.`,
        },
        ops,
        { paletteBefore: captureBrandPalette(before), scope: "global" },
      );
      return {
        ok: true,
        explanation: `Done. I restored the ${matched.answer} accent and left your other local styling in place.`,
        operations: ops,
        changes: applied.changes,
        project,
        applyStatus: "applied",
        decision: {
          intent: "continue_plan",
          confidence: 0.99,
          selectedAgents: ["editor_agent"],
          needsClarification: false,
          executionPlan: {
            goal: "Restore accent color",
            steps: [
              {
                id: "brand.accent",
                agent: "editor_agent",
                label: "Restore the accent color",
              },
            ],
            estimatedImpact: "medium",
          },
          explanation: "Restore accent from clarification.",
          followUpSuggestions: [
            "Make the hero more readable",
            "Review my website",
          ],
          decisionStage: "continuation",
          commandKind: "brand_restore",
        },
        followUpSuggestions: [
          "Make the hero more readable",
          "Review my website",
        ],
        atlasMemory: project.atlasMemory,
      };
    }

    if (matched?.destination === "other") {
      const cleared = setInteractionState(
        withMemory(input.project, input.request),
        clearPendingClarification(memory, { reason: "resolved" }),
      );
      return {
        ok: true,
        explanation:
          "Got it — tell me what you’d like to change and I’ll take it from there.",
        operations: [],
        changes: [],
        project: cleared,
        applyStatus: "needs_clarification",
        decision: {
          intent: "clarification",
          confidence: 0.7,
          selectedAgents: ["intent_router"],
          needsClarification: false,
          executionPlan: {
            goal: "Await a specific request",
            steps: [],
            estimatedImpact: "low",
          },
          explanation: "Awaiting a specific request.",
          followUpSuggestions: [
            "Make it feel more luxurious",
            "Strengthen the call-to-action",
            "Review my website",
          ],
        },
        followUpSuggestions: [
          "Make it feel more luxurious",
          "Strengthen the call-to-action",
          "Review my website",
        ],
        atlasMemory: cleared.atlasMemory,
      };
    }

    if (
      matched ||
      (hasActiveRecommendations(memory) && confirmation.kind !== "none")
    ) {
      if (hasActiveRecommendations(memory)) {
        return applyActionMemoryRecommendations({
          project: input.project,
          memory,
          request: input.request,
          destination: matched?.destination ?? null,
        });
      }

      // Clarification answered with no queued recommendations → continue with intent.
      const clearedProject = setInteractionState(
        withMemory(input.project, input.request),
        clearPendingClarification(memory, { reason: "resolved" }),
      );
      const mapped =
        matched?.destination === "visuals"
          ? "Make this website feel more modern"
          : matched?.destination === "copy"
            ? "Rewrite the hero headline and subheadline"
            : matched?.destination === "conversions"
              ? "I want more leads and stronger conversions"
              : null;
      if (mapped) {
        return runAtlasBrain({
          project: clearedProject,
          request: mapped,
          history: [],
        });
      }
    }

    // Ambiguous reply while clarification is pending — still do not re-ask.
    // Treat as best-effort kind filter / apply all if recs exist.
    if (hasActiveRecommendations(memory)) {
      return applyActionMemoryRecommendations({
        project: input.project,
        memory,
        request: input.request,
        destination: null,
      });
    }

    const cleared = setInteractionState(
      withMemory(input.project, input.request),
      clearPendingClarification(memory, { reason: "cancelled" }),
    );
    return {
      ok: true,
      explanation:
        "Understood. What would you like me to change on the site?",
      operations: [],
      changes: [],
      project: cleared,
      applyStatus: "no_changes",
      decision: confirmDecision("Continue", "Clarification cleared."),
      followUpSuggestions: [...ATLAS_BRAIN_CLARIFICATION_OPTIONS],
      atlasMemory: cleared.atlasMemory,
    };
  }

  // Active recommendations + confirmation → execute (skip routing).
  if (hasActiveRecommendations(memory)) {
    return applyActionMemoryRecommendations({
      project: input.project,
      memory,
      request: input.request,
    });
  }

  return null;
}

function appendExplanation(base: string, extra: string): string {
  const a = base.trim();
  const b = extra.trim();
  if (!a) return b;
  if (!b) return a;
  return `${a}\n\n${b}`;
}

function toLastExecutionRecord(
  request: string,
  result: EditExecutionResult,
  operations: EditOperation[],
  extras?: {
    paletteBefore?: ProtectedBrandPalette | null;
    scope?: AtlasLastExecution["scope"];
    heroBalance?: AtlasLastExecution["heroBalance"];
  },
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
    paletteBefore: extras?.paletteBefore ?? null,
    scope: extras?.scope,
    ...(extras?.heroBalance ? { heroBalance: extras.heroBalance } : {}),
  };
}

function rememberExecution(
  project: BusinessProject,
  request: string,
  result: EditExecutionResult,
  operations: EditOperation[],
  extras?: {
    paletteBefore?: ProtectedBrandPalette | null;
    scope?: AtlasLastExecution["scope"];
    heroBalance?: AtlasLastExecution["heroBalance"];
  },
): BusinessProject {
  return setInteractionState(
    project,
    storeLastExecution(
      getActionMemory(project),
      toLastExecutionRecord(request, result, operations, extras),
    ),
  );
}

function tryRestoreBrandPalette(input: {
  project: BusinessProject;
  request: string;
}): AtlasBrainResult | null {
  if (!isBrandRegressionComplaint(input.request)) return null;

  const memory = getActionMemory(input.project);
  const last = memory.lastVerifiedExecution;
  const palette =
    memory.preservation?.brandPalette ?? last?.paletteBefore ?? null;
  if (!palette) {
    const withPending = setInteractionState(
      input.project,
      storePendingClarification(memory, {
        question:
          "You’re right to flag the colors — that update shouldn’t change your brand palette. Tell me the accent you’d like restored (for example, gold).",
        kind: "color",
        destination: "restore_accent",
        resolveTo: "accentColor",
        allowedAnswers: ["gold", "green", "navy", "cream", "white"],
        context: {
          reason: "brand_regression",
          priorRequest: last?.request ?? null,
        },
      }),
    );
    return {
      ok: true,
      explanation:
        "You’re right to flag the colors — that update shouldn’t change your brand palette. I don’t have the prior palette saved on this session, so tell me the accent you’d like restored (for example, gold).",
      operations: [],
      changes: [],
      project: withPending,
      applyStatus: "needs_clarification",
      decision: {
        intent: "continue_plan",
        confidence: 0.99,
        selectedAgents: ["editor_agent"],
        needsClarification: true,
        executionPlan: {
          goal: "Restore brand colors",
          steps: [
            {
              id: "brand.restore",
              agent: "editor_agent",
              label: "Restore the previous brand palette",
            },
          ],
          estimatedImpact: "medium",
        },
        explanation: "Restore protected brand colors.",
        followUpSuggestions: ["gold", "Use green and gold", "Strengthen the hero overlay"],
        decisionStage: "continuation",
        commandKind: "brand_restore",
      },
      followUpSuggestions: ["gold", "Use green and gold", "Strengthen the hero overlay"],
    };
  }

  const protectedPalette = {
    primaryColor: palette.primaryColor,
    accentColor: palette.accentColor,
    secondaryColor: palette.secondaryColor,
    backgroundColor: palette.backgroundColor,
    theme: palette.theme ?? ("light" as const),
  };
  const restored = restoreBrandPalette(input.project, protectedPalette);
  const changed =
    restored.accentColor !== input.project.accentColor ||
    restored.primaryColor !== input.project.primaryColor ||
    restored.backgroundColor !== input.project.backgroundColor;

  const keptSurfaces = Boolean(input.project.componentSurfaces?.formFields);
  const explanation = keptSurfaces
    ? "You’re right—the text-box update should not have changed the gold accent. I restored it and kept the light-green styling local to the form fields."
    : "You’re right—that update should not have changed your brand colors. I restored your previous palette and will keep local styling scoped.";

  let project = rememberExecution(
    restored,
    input.request,
    {
      success: changed,
      verified: true,
      operationType: "restoreBrandPalette",
      verificationFailures: [],
      createdEntities: [],
      modifiedEntities: changed
        ? ["primaryColor", "accentColor", "secondaryColor", "backgroundColor"]
        : [],
      warnings: [],
      explanation,
    },
    [],
    { paletteBefore: protectedPalette, scope: "hero" },
  );
  if (changed) {
    project = touchActiveTask(project, {
      kind: "brand_restore",
      target: { type: "unknown" },
      userGoal: input.request,
    });
  }

  return {
    ok: true,
    explanation,
    operations: changed
      ? validateEditOperations([
          {
            operation: "changeTheme",
            primary: protectedPalette.primaryColor,
            accent: protectedPalette.accentColor,
            secondary: protectedPalette.secondaryColor,
            background: protectedPalette.backgroundColor,
            theme: protectedPalette.theme,
          },
        ])
      : [],
    changes: changed
      ? [{ id: "brand-restore", label: "Brand colors restored", ok: true as const }]
      : [],
    project,
    applyStatus: changed ? "applied" : "no_changes",
    decision: {
      intent: "continue_plan",
      confidence: 0.99,
      selectedAgents: ["editor_agent"],
      needsClarification: false,
      executionPlan: {
        goal: "Restore brand colors",
        steps: [
          {
            id: "brand.restore",
            agent: "editor_agent",
            label: "Restore the previous brand palette",
          },
        ],
        estimatedImpact: "high",
      },
      explanation: "Restore protected brand colors.",
      followUpSuggestions: ["Strengthen the hero overlay"],
      decisionStage: "continuation",
      commandKind: "brand_restore",
    },
    followUpSuggestions: ["Strengthen the hero overlay"],
  };
}

function tryExplainVisualComposition(input: {
  project: BusinessProject;
  request: string;
  requestId?: string | null;
}): AtlasBrainResult | null {
  const intent = classifyVisualCompositionIntent(input.request);
  if (!intent || intent.kind !== "visual_composition_explanation") {
    if (!isVisualCompositionExplanationRequest(input.request)) return null;
  }

  const explanation = explainHeroComposition(input.project);
  logVisualCompositionRoutingDiagnostics({
    requestId: input.requestId,
    detectedIntent: "visual_composition_explanation",
    activeTaskKind:
      getActiveVisualTask(getActionMemory(input.project))?.kind ?? null,
    target: "hero",
    explanationOnly: true,
    visualCompositionOwner: true,
    wholeSiteReviewTriggered: false,
    unrelatedDomainsChanged: false,
    verified: true,
  });

  let project = touchActiveVisualTask(input.project, {
    kind: "hero_composition",
    lastUserGoal: input.request,
    assetId: input.project.heroImageId,
  });
  project = withMemory(project, input.request);

  return {
    ok: true,
    explanation,
    operations: [],
    changes: [],
    project,
    applyStatus: "no_changes",
    decision: {
      intent: "question",
      confidence: 0.98,
      selectedAgents: ["creative_director", "editor_agent"],
      needsClarification: false,
      shouldExecuteEdits: false,
      executionPlan: {
        goal: "Explain current hero composition treatment",
        steps: [
          {
            id: "vc.explain",
            agent: "creative_director",
            label: "Explain hero blur / contrast treatment",
          },
        ],
        estimatedImpact: "medium",
      },
      explanation,
      followUpSuggestions: [
        "Fix it. Keep the photo clear and move the text somewhere easier to read.",
        "Keep the photo clear",
        "Use less blur",
      ],
      decisionStage: "visual_composition",
      commandKind: "visual_composition",
    },
    followUpSuggestions: [
      "Fix it. Keep the photo clear and move the text somewhere easier to read.",
      "Keep the photo clear",
      "Use less blur",
    ],
  };
}

function tryApplyVisualCompositionRefinement(input: {
  project: BusinessProject;
  request: string;
  requestId?: string | null;
}): AtlasBrainResult | null {
  const intent = classifyVisualCompositionIntent(input.request);
  const isRefine =
    intent?.kind === "visual_composition_refinement" ||
    isVisualCompositionRefinementRequest(input.request);
  if (!isRefine) return null;

  const interactionTask = getInteractionState(input.project).activeTask;
  const active = getActiveVisualTask(getInteractionState(input.project));
  const heroContext =
    Boolean(active) ||
    interactionTask?.target?.type === "hero" ||
    interactionTask?.kind === "image_placement" ||
    Boolean(interactionTask?.kind?.startsWith("hero_"));
  const bareFix = /^fix\s+it[.!?]?$/i.test(input.request.trim());
  if (bareFix && !heroContext) {
    return null;
  }
  if (intent && intent.confidence < 0.9 && !heroContext) {
    // Weak match without hero/image context — let other handlers try
    if (!isExplicitVisualCompositionCommand(input.request)) return null;
  }

  const before = input.project;
  const plan = planVisualCompositionRefinement({
    project: before,
    request: input.request,
    goals: {
      preservePhotography: true,
      improveReadability: true,
      relocateContent: true,
      reduceBlur: true,
    },
  });

  const applied = applyVisualCompositionRefinementPlan(
    before,
    plan,
    (project, ops) => applyEditOperations(project, validateEditOperations(ops)),
  );

  logVisualCompositionRoutingDiagnostics({
    requestId: input.requestId,
    detectedIntent: "visual_composition_refinement",
    activeTaskKind: active?.kind ?? interactionTask?.kind ?? null,
    target: "hero",
    explanationOnly: false,
    visualCompositionOwner: true,
    blurBefore: plan.diagnostics.blurBefore,
    blurAfter: plan.diagnostics.blurAfter,
    contentZoneBefore: plan.diagnostics.contentZoneBefore,
    contentZoneAfter: plan.diagnostics.contentZoneAfter,
    photographyPreservationBefore:
      plan.diagnostics.photographyPreservationBefore,
    photographyPreservationAfter:
      plan.diagnostics.photographyPreservationAfter,
    wholeSiteReviewTriggered: false,
    unrelatedDomainsChanged: applied.failures.some((f) =>
      /brand|typography|section_order|motion/.test(f),
    ),
    verified: applied.verified,
  });

  if (!applied.verified) {
    let project = touchActiveVisualTask(before, {
      kind: "hero_composition",
      lastUserGoal: input.request,
      assetId: before.heroImageId,
    });
    project = withMemory(project, input.request);
    return {
      ok: true,
      explanation:
        "I tried to clear the hero photo and relocate the copy, but I couldn’t verify a safe composition change. Tell me whether the blur or the text position is the bigger problem.",
      operations: [],
      changes: [],
      project,
      applyStatus: "no_changes",
      decision: {
        intent: "command_readability",
        confidence: 0.9,
        selectedAgents: ["editor_agent"],
        needsClarification: false,
        shouldExecuteEdits: false,
        executionPlan: {
          goal: "Refine hero visual composition",
          steps: [
            {
              id: "vc.refine",
              agent: "editor_agent",
              label: "Relocate copy and clear photography",
            },
          ],
          estimatedImpact: "high",
        },
        explanation: plan.explanation,
        followUpSuggestions: [
          "Keep the photo clear",
          "Move the text somewhere easier to read",
        ],
        decisionStage: "visual_composition",
        commandKind: "visual_composition",
      },
      followUpSuggestions: [
        "Keep the photo clear",
        "Move the text somewhere easier to read",
      ],
    };
  }

  let project = touchActiveVisualTask(applied.project, {
    kind: "hero_composition",
    lastUserGoal: input.request,
    assetId: applied.project.heroImageId,
  });
  project = rememberExecution(
    project,
    input.request,
    {
      success: true,
      verified: true,
      operationType: "visual_composition_refinement",
      verificationFailures: [],
      createdEntities: [],
      modifiedEntities: ["heroComposition", "heroOverlay", "heroTreatment"],
      warnings: [],
      explanation: plan.explanation,
    },
    plan.operations,
    { scope: "hero" },
  );
  project = withMemory(project, input.request);

  return {
    ok: true,
    explanation: plan.explanation,
    operations: plan.operations,
    changes: applied.changes,
    project,
    applyStatus: "applied",
    decision: {
      intent: "command_readability",
      confidence: 0.98,
      selectedAgents: ["editor_agent"],
      needsClarification: false,
      shouldExecuteEdits: true,
      executionPlan: {
        goal: "Refine hero visual composition",
        steps: [
          {
            id: "vc.refine",
            agent: "editor_agent",
            label: "Relocate copy and clear photography",
          },
        ],
        estimatedImpact: "high",
      },
      explanation: plan.explanation,
      followUpSuggestions: [
        "Make the text a bit clearer",
        "Use less blur",
        "Review my website",
      ],
      decisionStage: "visual_composition",
      commandKind: "visual_composition",
    },
    followUpSuggestions: [
      "Make the text a bit clearer",
      "Use less blur",
      "Review my website",
    ],
  };
}

function tryApplyHeroBalanceRepair(input: {
  project: BusinessProject;
  request: string;
  requestId?: string | null;
}): AtlasBrainResult | null {
  if (
    !isHeroImageVisibilityComplaint(input.request) &&
    !isSoftHeroVisibilityRequest(input.request) &&
    !isHeroGreyAreaComplaint(input.request)
  ) {
    return null;
  }
  // Visual-composition ownership beats classic balance when phrases match.
  if (
    isVisualCompositionExplanationRequest(input.request) ||
    isVisualCompositionRefinementRequest(input.request)
  ) {
    return null;
  }

  const planned = planHeroBalanceRepair({
    project: input.project,
    request: input.request,
  });

  if (planned.maxSafeBalance || planned.operations.length === 0) {
    logHeroBalanceDiagnostics({
      requestId: input.requestId,
      intent: "hero_balance_repair",
      repairType: "max_safe_balance",
      overlayBefore: planned.assessmentBefore.overlayStrength,
      overlayAfter: planned.assessmentBefore.overlayStrength,
      readabilityBefore: planned.assessmentBefore.textReadabilityScore,
      readabilityAfter: planned.assessmentBefore.textReadabilityScore,
      imageVisibilityBefore: planned.assessmentBefore.imageVisibilityScore,
      imageVisibilityAfter: planned.assessmentBefore.imageVisibilityScore,
      gradientApplied: planned.assessmentBefore.hasDirectionalGradient,
      scrimApplied: planned.assessmentBefore.hasTextScrim,
      globalPaletteChanged: false,
      verified: false,
    });
    let project = touchActiveVisualTask(input.project, {
      kind: "hero_balance",
      lastUserGoal: input.request,
    });
    project = rememberExecution(
      project,
      input.request,
      {
        success: false,
        verified: true,
        operationType: "hero_balance_repair",
        verificationFailures: ["max_safe_balance"],
        createdEntities: [],
        modifiedEntities: [],
        warnings: [],
        explanation: planned.explanation,
        followUpRecommendation: "Use the full picture",
      },
      [],
      { paletteBefore: planned.paletteBefore, scope: "hero" },
    );
    return {
      ok: true,
      explanation: planned.explanation,
      operations: [],
      changes: [],
      project,
      applyStatus: "no_changes",
      decision: {
        intent: "command_readability",
        confidence: 0.98,
        selectedAgents: ["editor_agent"],
        needsClarification: false,
        executionPlan: {
          goal: "Balance hero readability and image visibility",
          steps: [],
          estimatedImpact: "medium",
        },
        explanation: planned.explanation,
        followUpSuggestions: [
          "Use the full picture",
          "Try a different hero image",
        ],
        decisionStage: "explicit_command",
        commandKind: "hero_balance",
      },
      followUpSuggestions: [
        "Use the full picture",
        "Try a different hero image",
      ],
    };
  }

  const ops = validateEditOperations(
    filterOperationsForBrandPreservation(
      planned.operations,
      defaultHeroPreservationContext(),
    ),
  );
  const before = input.project;
  const applied = applyEditOperations(before, ops);
  const paletteSafe = restoreBrandPalette(
    applied.project,
    planned.paletteBefore,
  );
  const check = verifyHeroBalanceRepair({
    before,
    after: paletteSafe,
    assessmentBefore: planned.assessmentBefore,
  });

  logHeroBalanceDiagnostics({
    requestId: input.requestId,
    intent: "hero_balance_repair",
    repairType: "reduce_overlay_localize_contrast",
    overlayBefore: planned.assessmentBefore.overlayStrength,
    overlayAfter: check.assessmentAfter.overlayStrength,
    readabilityBefore: planned.assessmentBefore.textReadabilityScore,
    readabilityAfter: check.assessmentAfter.textReadabilityScore,
    imageVisibilityBefore: planned.assessmentBefore.imageVisibilityScore,
    imageVisibilityAfter: check.assessmentAfter.imageVisibilityScore,
    gradientApplied: Boolean(paletteSafe.heroTreatment?.gradient),
    scrimApplied: Boolean(paletteSafe.heroTreatment?.textScrim?.enabled),
    globalPaletteChanged: check.globalPaletteChanged,
    verified: check.verified,
  });

  if (!check.verified) {
    const project = rememberExecution(
      before,
      input.request,
      {
        success: false,
        verified: true,
        operationType: "hero_balance_repair",
        verificationFailures: check.failures,
        createdEntities: [],
        modifiedEntities: [],
        warnings: [],
        explanation:
          "I couldn’t improve image visibility without risking the headline contrast. Replacing or cropping the hero photo would help next.",
      },
      ops,
      { paletteBefore: planned.paletteBefore, scope: "hero" },
    );
    return {
      ok: true,
      explanation:
        "I couldn’t improve image visibility without risking the headline contrast. Replacing or cropping the hero photo would help next.",
      operations: [],
      changes: [],
      project,
      applyStatus: "no_changes",
      decision: {
        intent: "command_readability",
        confidence: 0.95,
        selectedAgents: ["editor_agent"],
        needsClarification: false,
        executionPlan: {
          goal: "Balance hero readability and image visibility",
          steps: [],
          estimatedImpact: "medium",
        },
        explanation: "Hero balance repair could not verify safely.",
        followUpSuggestions: [
          "Try a different hero image",
          "Review my website",
        ],
        decisionStage: "explicit_command",
        commandKind: "hero_balance",
      },
      followUpSuggestions: [
        "Try a different hero image",
        "Review my website",
      ],
    };
  }

  let project = touchActiveVisualTask(paletteSafe, {
    kind: "hero_balance",
    lastUserGoal: input.request,
  });
  project = rememberExecution(
    project,
    input.request,
    {
      success: true,
      verified: true,
      operationType: "hero_balance_repair",
      verificationFailures: [],
      createdEntities: [],
      modifiedEntities: ["heroOverlay", "heroTreatment"],
      warnings: [],
      explanation: planned.explanation,
    },
    ops,
    {
      paletteBefore: planned.paletteBefore,
      scope: "hero",
      heroBalance: {
        overlayBefore: planned.assessmentBefore.overlayStrength,
        overlayAfter: check.assessmentAfter.overlayStrength,
        readabilityBefore: planned.assessmentBefore.textReadabilityScore,
        readabilityAfter: check.assessmentAfter.textReadabilityScore,
        imageVisibilityBefore: planned.assessmentBefore.imageVisibilityScore,
        imageVisibilityAfter: check.assessmentAfter.imageVisibilityScore,
        gradientApplied: Boolean(paletteSafe.heroTreatment?.gradient),
        scrimApplied: Boolean(paletteSafe.heroTreatment?.textScrim?.enabled),
        imageVisibilityComplaint: true,
      },
    },
  );

  return {
    ok: true,
    explanation: planned.explanation,
    operations: ops,
    changes: applied.changes,
    project,
    applyStatus: "applied",
    decision: {
      intent: "command_readability",
      confidence: 0.98,
      selectedAgents: ["editor_agent"],
      needsClarification: false,
      executionPlan: {
        goal: "Balance hero readability and image visibility",
        steps: [
          {
            id: "cmd.hero-balance",
            agent: "editor_agent",
            label: "Localize hero contrast treatment",
          },
        ],
        estimatedImpact: "high",
      },
      explanation: planned.explanation,
      followUpSuggestions: [
        "Use the full picture",
        "Review my website",
      ],
      decisionStage: "explicit_command",
      commandKind: "hero_balance",
      shouldExecuteEdits: true,
    },
    followUpSuggestions: [
      "Use the full picture",
      "Review my website",
    ],
  };
}

function tryApplyHeroFit(input: {
  project: BusinessProject;
  request: string;
  requestId?: string | null;
  forceHero?: boolean;
}): AtlasBrainResult | null {
  if (!isHeroFitRequest(input.request) && !input.forceHero) return null;

  const planned = planHeroFitOperations({
    project: input.project,
    request: input.request,
    forceHero: input.forceHero,
  });
  const active = getActiveVisualTask(getInteractionState(input.project));
  const heroAssetId =
    input.project.heroImageId ?? active?.assetId ?? null;

  // Never re-ask after the user already answered “Hero image”.
  if (planned.needsTargetClarification && !input.forceHero) {
    const memory = storePendingClarification(
      getActionMemory(input.project),
      {
        question: planned.explanation,
        kind: "image_target",
        destination: "apply_hero_fit",
        allowedAnswers: ["Hero image", "Gallery image"],
        context: { intent: "hero_full_picture" },
      },
    );
    const project = touchActiveVisualTask(
      setInteractionState(input.project, memory),
      {
        kind: "hero_image_fit",
        assetId: heroAssetId ?? undefined,
        lastUserGoal: input.request,
      },
    );
    logHeroFitDiagnostics({
      requestId: input.requestId,
      activeVisualTaskKind: active?.kind ?? null,
      resolvedTarget: "unknown",
      pendingClarificationKind: "image_target",
      continuationMatched: Boolean(active),
      selectedOperation: "clarify_image_target",
      heroAssetIdBefore: heroAssetId,
      heroAssetIdAfter: heroAssetId,
      activeTaskAssetId: active?.assetId ?? null,
      requestedFit: planned.presentation.fit,
      normalizedFit: normalizeHeroFitMode(planned.presentation.fit),
      persistedFit: planned.before.fit,
      renderedFit: objectFitCss(planned.before.fit),
      heroFitBefore: planned.before.fit,
      heroFitAfter: planned.before.fit,
      heroZoomBefore: planned.before.zoom,
      heroZoomAfter: planned.before.zoom,
      globalThemeChanged: false,
      verified: false,
      verificationFailure: "needs_target_clarification",
    });
    return {
      ok: true,
      explanation: planned.explanation,
      operations: [],
      changes: [],
      project,
      applyStatus: "needs_clarification",
      decision: {
        intent: "clarification",
        confidence: 0.9,
        selectedAgents: ["editor_agent"],
        needsClarification: true,
        executionPlan: {
          goal: "Choose which image gets the full-photo fit",
          steps: [],
          estimatedImpact: "medium",
        },
        explanation: planned.explanation,
        followUpSuggestions: ["Hero image", "Gallery image"],
        decisionStage: "explicit_command",
        commandKind: "images",
      },
      followUpSuggestions: ["Hero image", "Gallery image"],
    };
  }

  // Idempotent: already showing the full picture — success, no re-upload.
  if (planned.alreadySatisfied) {
    let project = touchActiveVisualTask(input.project, {
      kind: "hero_image_fit",
      assetId: heroAssetId ?? undefined,
      lastUserGoal: input.request,
    });
    project = setInteractionState(
      project,
      clearPendingClarification(getActionMemory(project), {
        reason: "resolved",
      }),
    );
    project = rememberExecution(
      project,
      input.request,
      {
        success: true,
        verified: true,
        operationType: "hero_image_fit",
        verificationFailures: [],
        createdEntities: [],
        modifiedEntities: [],
        warnings: [],
        explanation: planned.explanation,
      },
      [],
      { scope: "hero", paletteBefore: captureBrandPalette(input.project) },
    );
    logHeroFitDiagnostics({
      requestId: input.requestId,
      activeVisualTaskKind: active?.kind ?? "hero_image_fit",
      resolvedTarget: "hero",
      pendingClarificationKind: null,
      continuationMatched: Boolean(active),
      selectedOperation: "already_satisfied",
      heroAssetIdBefore: heroAssetId,
      heroAssetIdAfter: project.heroImageId,
      activeTaskAssetId: active?.assetId ?? heroAssetId,
      requestedFit: planned.presentation.fit,
      normalizedFit: normalizeHeroFitMode(planned.presentation.fit),
      persistedFit: readHeroImagePresentation(project).fit,
      renderedFit: objectFitCss(readHeroImagePresentation(project).fit),
      heroFitBefore: planned.before.fit,
      heroFitAfter: planned.presentation.fit,
      heroZoomBefore: planned.before.zoom,
      heroZoomAfter: planned.presentation.zoom,
      globalThemeChanged: false,
      verified: true,
      verificationFailure: null,
    });
    return {
      ok: true,
      explanation: planned.explanation,
      operations: [],
      changes: [],
      project,
      applyStatus: "applied",
      decision: {
        intent: "command_readability",
        confidence: 0.98,
        selectedAgents: ["editor_agent"],
        needsClarification: false,
        executionPlan: {
          goal: "Show the full hero photo",
          steps: [],
          estimatedImpact: "low",
        },
        explanation: planned.explanation,
        followUpSuggestions: [
          "Make the words easier to read",
          "Review my website",
        ],
        decisionStage: "explicit_command",
        commandKind: "images",
        shouldExecuteEdits: true,
      },
      followUpSuggestions: [
        "Make the words easier to read",
        "Review my website",
      ],
    };
  }

  const ops = validateEditOperations(planned.operations);
  const before = input.project;
  const applied = applyEditOperations(before, ops);
  // If heroImageId was only on activeTask, restore project truth assignment.
  let afterProject = applied.project;
  if (!afterProject.heroImageId && heroAssetId) {
    afterProject = { ...afterProject, heroImageId: heroAssetId };
  }
  const check = verifyHeroFitChange({
    before,
    after: afterProject,
    intendedFit: planned.presentation.fit,
    allowAlreadySatisfied: true,
  });
  const persistedFit = readHeroImagePresentation(afterProject).fit;
  logHeroFitDiagnostics({
    requestId: input.requestId,
    activeVisualTaskKind: active?.kind ?? "hero_image_fit",
    resolvedTarget: "hero",
    pendingClarificationKind: null,
    continuationMatched: Boolean(active),
    selectedOperation: "setHeroImagePresentation",
    heroAssetIdBefore: before.heroImageId,
    heroAssetIdAfter: afterProject.heroImageId,
    activeTaskAssetId: active?.assetId ?? null,
    requestedFit: planned.presentation.fit,
    normalizedFit: normalizeHeroFitMode(planned.presentation.fit),
    persistedFit,
    renderedFit: objectFitCss(persistedFit),
    heroFitBefore: planned.before.fit,
    heroFitAfter: persistedFit,
    heroZoomBefore: planned.before.zoom,
    heroZoomAfter: planned.presentation.zoom,
    globalThemeChanged: check.globalThemeChanged,
    verified: check.verified,
    verificationFailure: check.failures[0] ?? null,
  });

  if (!check.verified) {
    const explanation = explainHeroFitVerificationFailure({
      failures: check.failures,
      heroImageId: before.heroImageId ?? heroAssetId,
      intendedFit: planned.presentation.fit,
    });
    return {
      ok: true,
      explanation,
      operations: [],
      changes: [],
      project: rememberExecution(
        before,
        input.request,
        {
          success: false,
          verified: true,
          operationType: "hero_image_fit",
          verificationFailures: check.failures,
          createdEntities: [],
          modifiedEntities: [],
          warnings: [],
          explanation,
        },
        ops,
        { scope: "hero" },
      ),
      applyStatus: "no_changes",
      decision: {
        intent: "command_readability",
        confidence: 0.9,
        selectedAgents: ["editor_agent"],
        needsClarification: false,
        executionPlan: {
          goal: "Show the full hero photo",
          steps: [],
          estimatedImpact: "medium",
        },
        explanation,
        followUpSuggestions: ["Use the full picture", "Review my website"],
        decisionStage: "explicit_command",
        commandKind: "images",
      },
      followUpSuggestions: ["Use the full picture", "Review my website"],
    };
  }

  let project = touchActiveVisualTask(afterProject, {
    kind: "hero_image_fit",
    assetId: afterProject.heroImageId ?? heroAssetId ?? undefined,
    lastUserGoal: input.request,
  });
  project = setInteractionState(
    project,
    clearPendingClarification(getActionMemory(project), { reason: "resolved" }),
  );
  project = rememberExecution(
    project,
    input.request,
    {
      success: true,
      verified: true,
      operationType: "hero_image_fit",
      verificationFailures: [],
      createdEntities: [],
      modifiedEntities: ["heroImagePresentation"],
      warnings: [],
      explanation: planned.explanation,
    },
    ops,
    { scope: "hero", paletteBefore: captureBrandPalette(before) },
  );

  return {
    ok: true,
    explanation: planned.explanation,
    operations: ops,
    changes: applied.changes,
    project,
    applyStatus: "applied",
    decision: {
      intent: "command_readability",
      confidence: 0.98,
      selectedAgents: ["editor_agent"],
      needsClarification: false,
      executionPlan: {
        goal: "Show the full hero photo",
        steps: [
          {
            id: "cmd.hero-fit",
            agent: "editor_agent",
            label: "Update hero image fit",
          },
        ],
        estimatedImpact: "high",
      },
      explanation: planned.explanation,
      followUpSuggestions: [
        "Make the words easier to read",
        "Review my website",
      ],
      decisionStage: "explicit_command",
      commandKind: "images",
      shouldExecuteEdits: true,
    },
    followUpSuggestions: [
      "Make the words easier to read",
      "Review my website",
    ],
  };
}

function strategyHeroPatternForProject(
  project: BusinessProject,
): ExecutableHeroPatternId | null {
  const composed = composeDesignPatterns({
    industry: project.businessType || project.businessName,
    businessDescription: project.description,
    hasHeroImage: Boolean(project.heroImageId),
    galleryFilledSlots: project.galleryImageIds.filter(Boolean).length,
    libraryCount: project.mediaLibrary.length,
    hasTestimonials: Boolean(project.designSections?.testimonials?.length),
    primaryGoal: project.goals?.[0] ? String(project.goals[0]) : undefined,
  });
  for (const id of composed.patternIds) {
    if (isExecutableHeroPatternId(id)) return id;
  }
  return null;
}

function tryApplyHeroPattern(input: {
  project: BusinessProject;
  request: string;
  requestId?: string | null;
}): AtlasBrainResult | null {
  if (!isHeroPatternApplicationRequest(input.request)) return null;
  // Fit / readability refinements must preserve the pattern — never steal those turns.
  if (isHeroFitRequest(input.request)) return null;
  if (
    !matchExplicitHeroPatternRequest(input.request) &&
    !isHeroPatternRedesignRequest(input.request)
  ) {
    return null;
  }

  const explicit = matchExplicitHeroPatternRequest(input.request);
  const strategyPattern = isHeroPatternRedesignRequest(input.request)
    ? strategyHeroPatternForProject(input.project)
    : null;
  const patternId = explicit ?? strategyPattern;
  if (!patternId) {
    // Redesign without an executable strategy pattern — let professional composition run.
    if (isHeroPatternRedesignRequest(input.request) && !explicit) {
      return null;
    }
    return null;
  }

  const planned = planHeroPatternApplication({
    project: input.project,
    patternId,
    request: input.request,
    strategyContext: strategyPattern
      ? { patternIds: [strategyPattern] }
      : null,
  });

  if (planned.blocked) {
    return {
      ok: true,
      explanation:
        planned.blockReason ||
        "I couldn’t apply that hero composition without a clearer pattern choice.",
      operations: [],
      changes: [],
      project: input.project,
      applyStatus: "no_changes",
      decision: {
        intent: "command_readability",
        confidence: 0.7,
        selectedAgents: ["editor_agent"],
        needsClarification: true,
        executionPlan: {
          goal: "Apply hero pattern",
          steps: [],
          estimatedImpact: "medium",
        },
        explanation: planned.blockReason || planned.explanation,
        followUpSuggestions: [
          "Use a cinematic hero",
          "Make this a premium minimal hero",
        ],
        decisionStage: "explicit_command",
        commandKind: "hero_balance",
      },
      followUpSuggestions: [
        "Use a cinematic hero",
        "Make this a premium minimal hero",
      ],
    };
  }

  if (planned.alreadySatisfied) {
    let project = touchActiveVisualTask(input.project, {
      kind: "hero_composition",
      lastUserGoal: input.request,
    });
    project = rememberExecution(
      project,
      input.request,
      {
        success: true,
        verified: true,
        operationType: "applyHeroPattern",
        verificationFailures: [],
        createdEntities: [],
        modifiedEntities: [],
        warnings: [],
        explanation: planned.explanation,
      },
      [],
      { scope: "hero", paletteBefore: captureBrandPalette(input.project) },
    );
    return {
      ok: true,
      explanation: planned.explanation,
      operations: [],
      changes: [],
      project,
      applyStatus: "applied",
      decision: {
        intent: "command_readability",
        confidence: 0.99,
        selectedAgents: ["editor_agent"],
        needsClarification: false,
        executionPlan: {
          goal: "Apply hero pattern",
          steps: [
            {
              id: "cmd.hero-pattern",
              agent: "editor_agent",
              label: "Hero pattern already active",
            },
          ],
          estimatedImpact: "low",
        },
        explanation: planned.explanation,
        followUpSuggestions: [
          "Show the entire picture",
          "Keep the words readable",
        ],
        decisionStage: "explicit_command",
        commandKind: "hero_balance",
        shouldExecuteEdits: true,
      },
      followUpSuggestions: [
        "Show the entire picture",
        "Keep the words readable",
      ],
    };
  }

  // P1.5 — one composition-first refinement pass before apply/verify.
  const prepared = prepareHeroPatternComposition({
    project: input.project,
    composition: planned.composition,
  });
  logHeroCompositionDiagnostics({
    ...prepared.diagnostics,
    requestId: input.requestId,
  });

  const ops = validateEditOperations(
    filterOperationsForBrandPreservation(
      [
        {
          operation: "applyHeroPattern",
          patternId: planned.patternId,
          composition: prepared.composition,
        },
      ],
      defaultHeroPreservationContext(),
    ),
  );
  const before = input.project;
  const applied = applyEditOperations(before, ops);
  const paletteSafe = restoreBrandPalette(
    applied.project,
    captureBrandPalette(before),
  );
  const check = verifyHeroPatternApplication({
    before,
    after: paletteSafe,
    expected: prepared.composition,
  });

  if (!check.verified) {
    return {
      ok: true,
      explanation:
        "I kept your brand colors and couldn’t verify that hero composition. Try another pattern or refine the photo first.",
      operations: [],
      changes: [],
      project: rememberExecution(
        before,
        input.request,
        {
          success: false,
          verified: true,
          operationType: "applyHeroPattern",
          verificationFailures: check.failures,
          createdEntities: [],
          modifiedEntities: [],
          warnings: [],
          explanation: "Hero pattern application could not be verified.",
        },
        ops,
        { scope: "hero", paletteBefore: captureBrandPalette(before) },
      ),
      applyStatus: "no_changes",
      decision: {
        intent: "command_readability",
        confidence: 0.9,
        selectedAgents: ["editor_agent"],
        needsClarification: false,
        executionPlan: {
          goal: "Apply hero pattern",
          steps: [],
          estimatedImpact: "medium",
        },
        explanation: "Hero pattern blocked.",
        followUpSuggestions: [
          "Use a coastal service hero",
          "Make this a premium minimal hero",
        ],
        decisionStage: "explicit_command",
        commandKind: "hero_balance",
      },
      followUpSuggestions: [
        "Use a coastal service hero",
        "Make this a premium minimal hero",
      ],
    };
  }

  let project = touchActiveVisualTask(paletteSafe, {
    kind: "hero_composition",
    lastUserGoal: input.request,
  });
  const explanation = prepared.refined
    ? `${planned.explanation} I refined the composition for stronger balance and readability.`
    : planned.explanation;
  project = rememberExecution(
    project,
    input.request,
    {
      success: true,
      verified: true,
      operationType: "applyHeroPattern",
      verificationFailures: [],
      createdEntities: [],
      modifiedEntities: [
        "heroComposition",
        "heroOverlay",
        "heroTreatment",
        "heroImagePresentation",
      ],
      warnings: [],
      explanation,
    },
    ops,
    { scope: "hero", paletteBefore: captureBrandPalette(before) },
  );

  return {
    ok: true,
    explanation,
    operations: ops,
    changes: applied.changes,
    project,
    applyStatus: "applied",
    decision: {
      intent: "command_readability",
      confidence: 0.97,
      selectedAgents: ["editor_agent"],
      needsClarification: false,
      executionPlan: {
        goal: "Apply hero pattern",
        steps: [
          {
            id: "cmd.hero-pattern",
            agent: "editor_agent",
            label: "Apply hero pattern composition",
          },
        ],
        estimatedImpact: "high",
      },
      explanation,
      followUpSuggestions: [
        "Show the entire picture",
        "Keep the words readable",
      ],
      decisionStage: "explicit_command",
      commandKind: "hero_balance",
      shouldExecuteEdits: true,
    },
    followUpSuggestions: [
      "Show the entire picture",
      "Keep the words readable",
    ],
  };
}

function tryApplyHeroProfessionalComposition(input: {
  project: BusinessProject;
  request: string;
  requestId?: string | null;
}): AtlasBrainResult | null {
  if (!isHeroProfessionalCompositionRequest(input.request)) return null;
  const memory = getActionMemory(input.project);
  const continueHero = shouldContinueActiveHeroTask(input.request, memory);
  const heroScoped =
    Boolean(getActiveVisualTask(memory)) ||
    memory.lastVerifiedExecution?.scope === "hero" ||
    continueHero;
  if (!heroScoped) return null;

  const planned = planHeroProfessionalComposition({
    project: input.project,
    request: input.request,
  });
  const ops = validateEditOperations(
    filterOperationsForBrandPreservation(
      planned.operations,
      defaultHeroPreservationContext(),
    ),
  );
  const before = input.project;
  const applied = applyEditOperations(before, ops);
  const paletteSafe = restoreBrandPalette(
    applied.project,
    captureBrandPalette(before),
  );
  const fitCheck = verifyHeroFitChange({
    before,
    after: paletteSafe,
    intendedFit: "full",
  });
  const globalThemeChanged =
    before.primaryColor !== paletteSafe.primaryColor ||
    before.accentColor !== paletteSafe.accentColor ||
    before.headingFont !== paletteSafe.headingFont;

  logHeroFitDiagnostics({
    requestId: input.requestId,
    activeVisualTaskKind: "hero_composition",
    resolvedTarget: "hero",
    pendingClarificationKind: null,
    continuationMatched: continueHero,
    selectedOperation: "hero_composition",
    heroFitBefore: planned.before.fit,
    heroFitAfter: readHeroImagePresentation(paletteSafe).fit,
    heroZoomBefore: planned.before.zoom,
    heroZoomAfter: readHeroImagePresentation(paletteSafe).zoom,
    globalThemeChanged,
    verified: fitCheck.verified && !globalThemeChanged,
  });

  if (globalThemeChanged || !fitCheck.verified) {
    return {
      ok: true,
      explanation:
        "I kept your brand colors and couldn’t safely refine the hero composition further. Showing the full picture or replacing the photo would help next.",
      operations: [],
      changes: [],
      project: rememberExecution(
        before,
        input.request,
        {
          success: false,
          verified: true,
          operationType: "hero_composition",
          verificationFailures: fitCheck.failures,
          createdEntities: [],
          modifiedEntities: [],
          warnings: [],
          explanation: "Hero composition could not be verified.",
        },
        ops,
        { scope: "hero", paletteBefore: captureBrandPalette(before) },
      ),
      applyStatus: "no_changes",
      decision: {
        intent: "command_readability",
        confidence: 0.9,
        selectedAgents: ["editor_agent"],
        needsClarification: false,
        executionPlan: {
          goal: "Refine hero composition",
          steps: [],
          estimatedImpact: "medium",
        },
        explanation: "Hero composition blocked.",
        followUpSuggestions: ["Use the full picture", "Review my website"],
        decisionStage: "explicit_command",
        commandKind: "hero_balance",
      },
      followUpSuggestions: ["Use the full picture", "Review my website"],
    };
  }

  let project = touchActiveVisualTask(paletteSafe, {
    kind: "hero_composition",
    lastUserGoal: input.request,
  });
  project = rememberExecution(
    project,
    input.request,
    {
      success: true,
      verified: true,
      operationType: "hero_composition",
      verificationFailures: [],
      createdEntities: [],
      modifiedEntities: ["heroImagePresentation", "heroTreatment"],
      warnings: [],
      explanation: planned.explanation,
    },
    ops,
    { scope: "hero", paletteBefore: captureBrandPalette(before) },
  );

  return {
    ok: true,
    explanation: planned.explanation,
    operations: ops,
    changes: applied.changes,
    project,
    applyStatus: "applied",
    decision: {
      intent: "command_readability",
      confidence: 0.97,
      selectedAgents: ["editor_agent"],
      needsClarification: false,
      executionPlan: {
        goal: "Refine hero composition",
        steps: [
          {
            id: "cmd.hero-composition",
            agent: "editor_agent",
            label: "Professional hero composition",
          },
        ],
        estimatedImpact: "high",
      },
      explanation: planned.explanation,
      followUpSuggestions: [
        "Use the full picture",
        "Review my website",
      ],
      decisionStage: "explicit_command",
      commandKind: "hero_balance",
      shouldExecuteEdits: true,
    },
    followUpSuggestions: ["Use the full picture", "Review my website"],
  };
}

function tryApplyGalleryLightbox(input: {
  project: BusinessProject;
  request: string;
}): AtlasBrainResult | null {
  const activeTask = getInteractionState(input.project).activeTask;
  // P1.6 — active hero task + hero-domain language never yields to gallery.
  if (
    isActiveHeroTask(activeTask) &&
    isHeroDomainRequest(input.request) &&
    !galleryMayOwnRequest(input.request)
  ) {
    return null;
  }
  if (
    isHeroDomainRequest(input.request) &&
    !galleryMayOwnRequest(input.request)
  ) {
    return null;
  }
  const continuing =
    activeTask?.kind === "gallery_interaction" &&
    canContinueActiveTask(activeTask, input.request) &&
    isGalleryLightboxSoftContinuation(input.request);
  if (!isGalleryLightboxRequest(input.request) && !continuing) return null;
  if (continuing) {
    recordActiveTaskDiagnostics({
      continuationOwner: "gallery_interaction",
      continuationMatched: true,
    });
  }

  const planned = continuing
    ? planGalleryInteractionContinuation(input.request) ??
      planGalleryLightboxOperations()
    : planGalleryLightboxOperations();
  const ops = validateEditOperations(planned.operations);
  const before = input.project;
  const applied = applyEditOperations(before, ops);
  const disablingLightbox = planned.interaction.mode === "none";
  const check = disablingLightbox
    ? { verified: true, failures: [] as string[] }
    : verifyGalleryLightbox({
        before,
        after: applied.project,
        galleryAssetIds: applied.project.galleryImageIds ?? [],
      });

  if (!check.verified) {
    const project = rememberExecution(
      before,
      input.request,
      {
        success: false,
        verified: true,
        operationType: "setGalleryInteraction",
        verificationFailures: check.failures,
        createdEntities: [],
        modifiedEntities: [],
        warnings: [],
        explanation:
          "I couldn’t enable full-image viewing yet because a gallery photo is missing its full-size file. Re-upload the photos, then ask again.",
      },
      ops,
      { scope: "unknown" },
    );
    return {
      ok: true,
      explanation:
        "I couldn’t enable full-image viewing yet because a gallery photo is missing its full-size file. Re-upload the photos, then ask again.",
      operations: [],
      changes: [],
      project,
      applyStatus: "no_changes",
      decision: {
        intent: "image_edit",
        confidence: 0.95,
        selectedAgents: ["editor_agent"],
        needsClarification: false,
        executionPlan: {
          goal: "Enable gallery lightbox",
          steps: [],
          estimatedImpact: "high",
        },
        explanation: "Gallery lightbox verification failed.",
        followUpSuggestions: ["Add photos to the gallery", "Review my website"],
        decisionStage: "explicit_command",
        commandKind: "images",
      },
      followUpSuggestions: ["Add photos to the gallery", "Review my website"],
    };
  }

  let project = rememberExecution(
    applied.project,
    input.request,
    {
      success: true,
      verified: true,
      operationType: "setGalleryInteraction",
      verificationFailures: [],
      createdEntities: [],
      modifiedEntities: ["galleryInteraction"],
      warnings: [],
      explanation: planned.explanation,
    },
    ops,
    { scope: "unknown" },
  );
  project = touchActiveTask(project, {
    kind: "gallery_interaction",
    target: { type: "gallery" },
    userGoal: input.request,
  });

  return {
    ok: true,
    explanation: planned.explanation,
    operations: ops,
    changes: applied.changes,
    project,
    applyStatus: "applied",
    decision: {
      intent: "image_edit",
      confidence: 0.98,
      selectedAgents: ["editor_agent"],
      needsClarification: false,
      executionPlan: {
        goal: "Enable gallery lightbox",
        steps: [
          {
            id: "cmd.gallery-lightbox",
            agent: "editor_agent",
            label: "Open gallery photos fullscreen",
          },
        ],
        estimatedImpact: "high",
      },
      explanation: planned.explanation,
      followUpSuggestions: [
        "Remove the titles from the gallery",
        "Review my website",
      ],
      decisionStage: "explicit_command",
      commandKind: "images",
      shouldExecuteEdits: true,
    },
    followUpSuggestions: [
      "Remove the titles from the gallery",
      "Review my website",
    ],
  };
}

function tryApplyGalleryMetadata(input: {
  project: BusinessProject;
  request: string;
}): AtlasBrainResult | null {
  const activeTask = getInteractionState(input.project).activeTask;
  const continuing =
    activeTask?.kind === "gallery_metadata" &&
    canContinueActiveTask(activeTask, input.request) &&
    isGalleryMetadataSoftContinuation(input.request);
  if (!isGalleryMetadataRequest(input.request) && !continuing) return null;
  if (continuing) {
    recordActiveTaskDiagnostics({
      continuationOwner: "gallery_metadata",
      continuationMatched: true,
    });
  }
  // Soft phrases → planner-friendly wording when continuing an active task.
  const metadataRequest =
    continuing && !isGalleryMetadataRequest(input.request)
      ? /\b(give|add|write)\b[\s\S]{0,40}\bcaptions?\b/i.test(input.request)
        ? "Add captions to the gallery photos"
        : /\b(hide|remove|clear)\b[\s\S]{0,24}\b(titles?|captions?|labels?)\b/i.test(
              input.request,
            ) || /\bother\s+titles?\b/i.test(input.request)
          ? "Remove the titles from the gallery"
          : input.request
      : input.request;
  const planned = planGalleryMetadataOperations({
    project: input.project,
    request: metadataRequest,
  });
  if (planned.needsClarification || planned.operations.length === 0) {
    return {
      ok: true,
      explanation: planned.explanation,
      operations: [],
      changes: [],
      project: withMemory(input.project, input.request),
      applyStatus: planned.needsClarification
        ? "needs_clarification"
        : "no_changes",
      decision: {
        intent: "image_edit",
        confidence: 0.9,
        selectedAgents: ["editor_agent"],
        needsClarification: planned.needsClarification,
        executionPlan: {
          goal: "Update gallery metadata",
          steps: [],
          estimatedImpact: "medium",
        },
        explanation: planned.explanation,
        followUpSuggestions: [
          "Rename the first gallery image to Front Yard",
          "Remove the titles from the gallery",
        ],
        decisionStage: "explicit_command",
        commandKind: "images",
      },
      followUpSuggestions: [
        "Rename the first gallery image to Front Yard",
        "Remove the titles from the gallery",
      ],
    };
  }

  const ops = validateEditOperations(planned.operations);
  const applied = applyEditOperations(input.project, ops);
  let project = rememberExecution(
    applied.project,
    input.request,
    {
      success: true,
      verified: true,
      operationType: "updateGalleryItemMetadata",
      verificationFailures: [],
      createdEntities: [],
      modifiedEntities: ["mediaLibrary"],
      warnings: [],
      explanation: planned.explanation,
    },
    ops,
    { scope: "unknown" },
  );
  project = touchActiveTask(project, {
    kind: "gallery_metadata",
    target: { type: "gallery" },
    userGoal: input.request,
  });

  return {
    ok: true,
    explanation: planned.explanation,
    operations: ops,
    changes: applied.changes,
    project,
    applyStatus: "applied",
    decision: {
      intent: "image_edit",
      confidence: 0.97,
      selectedAgents: ["editor_agent"],
      needsClarification: false,
      executionPlan: {
        goal: "Update gallery metadata",
        steps: [
          {
            id: "cmd.gallery-meta",
            agent: "editor_agent",
            label: "Update gallery photo details",
          },
        ],
        estimatedImpact: "medium",
      },
      explanation: planned.explanation,
      followUpSuggestions: [
        "Let people click photos to see the full image",
        "Review my website",
      ],
      decisionStage: "explicit_command",
      commandKind: "images",
      shouldExecuteEdits: true,
    },
    followUpSuggestions: [
      "Let people click photos to see the full image",
      "Review my website",
    ],
  };
}

function tryApplySurfaceStyle(input: {
  project: BusinessProject;
  request: string;
}): AtlasBrainResult | null {
  const activeTask = getInteractionState(input.project).activeTask;
  const continueSurface =
    activeTask?.kind === "surface_style" &&
    activeTask.target.type === "surface"
      ? (activeTask.target.surface as SurfaceTarget)
      : activeTask?.kind === "surface_style"
        ? ("form_fields" as SurfaceTarget)
        : null;
  const continuing =
    Boolean(continueSurface) &&
    canContinueActiveTask(activeTask, input.request) &&
    isSurfaceStyleSoftContinuation(input.request);

  if (!isSurfaceStyleRequest(input.request) && !continuing) return null;
  if (continuing) {
    recordActiveTaskDiagnostics({
      continuationOwner: "surface_style",
      continuationMatched: true,
    });
  }

  const planned = planSurfaceStyleOperations({
    request: input.request,
    project: input.project,
    continueFromTask: continuing ? continueSurface : null,
  });

  if (!planned.ok) {
    if (planned.needsClarification) {
      return {
        ok: true,
        explanation: planned.explanation,
        operations: [],
        changes: [],
        project: input.project,
        applyStatus: "needs_clarification",
        decision: {
          intent: "clarification",
          confidence: 0.9,
          selectedAgents: ["editor_agent"],
          needsClarification: true,
          executionPlan: {
            goal: "Clarify surface target",
            steps: [],
            estimatedImpact: "low",
          },
          explanation: planned.explanation,
          followUpSuggestions: [
            "Make the contact-form fields light green",
            "Make the text panels light green",
          ],
          decisionStage: "clarification",
          commandKind: "surface_style",
        },
        followUpSuggestions: [
          "Make the contact-form fields light green",
          "Make the text panels light green",
        ],
      };
    }
    return null;
  }

  const paletteBefore = captureBrandPalette(input.project);
  const ops = validateEditOperations(planned.operations);
  const applied = applyEditOperations(input.project, ops);
  const protectedChanged = surfaceStyleChangedProtectedPalette(
    input.project,
    applied.project,
  );
  if (protectedChanged) {
    // Hard guard — never allow local surface styling to rewrite brand tokens.
    applied.project = restoreBrandPalette(applied.project, paletteBefore);
  }

  const verified =
    applied.project.componentSurfaces?.formFields?.backgroundColor ===
      planned.backgroundColor ||
    applied.project.componentSurfaces?.textPanels?.backgroundColor ===
      planned.backgroundColor ||
    applied.project.componentSurfaces?.cards?.backgroundColor ===
      planned.backgroundColor;

  const accentUnchanged =
    applied.project.accentColor === input.project.accentColor;

  let project = rememberExecution(
    applied.project,
    input.request,
    {
      success: verified && accentUnchanged,
      verified: verified && accentUnchanged,
      operationType: "setComponentSurface",
      verificationFailures: [
        ...(!verified ? ["surface style not applied"] : []),
        ...(!accentUnchanged ? ["protected accent changed"] : []),
      ],
      createdEntities: [],
      modifiedEntities: verified ? ["componentSurfaces"] : [],
      warnings: [],
      explanation: planned.explanation,
    },
    ops,
    { paletteBefore, scope: "unknown" },
  );
  if (verified && accentUnchanged && planned.ok) {
    project = touchActiveTask(project, {
      kind: "surface_style",
      target: { type: "surface", surface: planned.target },
      userGoal: input.request,
    });
  }

  return {
    ok: true,
    explanation: planned.explanation,
    operations: ops,
    changes: applied.changes,
    project,
    applyStatus: verified ? "applied" : "no_changes",
    decision: {
      intent: "explicit_design_edit",
      confidence: 0.98,
      selectedAgents: ["editor_agent"],
      needsClarification: false,
      executionPlan: {
        goal: "Update local surface styling",
        steps: [
          {
            id: "cmd.surface",
            agent: "editor_agent",
            label: "Style form fields or text panels",
          },
        ],
        estimatedImpact: "medium",
      },
      explanation: planned.explanation,
      followUpSuggestions: [
        "Restore the gold accent",
        "Make the hero more readable",
        "Review my website",
      ],
      decisionStage: "explicit_command",
      commandKind: "surface_style",
      shouldExecuteEdits: true,
    },
    followUpSuggestions: [
      "Restore the gold accent",
      "Make the hero more readable",
      "Review my website",
    ],
  };
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
  const before = input.project;
  const applied = applyEditOperations(before, operations);
  const meaningful = hasMeaningfulProjectDiff(before, applied.project);
  const verified = verifyEditExecution(before, applied.project, operations);
  const status = applyStatusFromExecution(verified);

  // Structural ops that failed verification with nothing landed → honest failure.
  const structuralHardFail =
    !meaningful &&
    status === "needs_clarification" &&
    operations.some(
      (op) =>
        op.operation === "moveSection" ||
        op.operation === "insertSection" ||
        op.operation === "removeSection",
    );

  if (!meaningful || structuralHardFail) {
    const project = rememberExecution(
      before,
      input.request,
      verified,
      operations,
    );
    const applyStatus = structuralHardFail
      ? "needs_clarification"
      : status === "needs_clarification"
        ? "needs_clarification"
        : "no_changes";
    return {
      project,
      operations: [],
      changes: [],
      explanation:
        verified.explanation ||
        (applyStatus === "no_changes"
          ? ATLAS_VOICE.alreadyMatched
          : "I wasn’t able to complete that change."),
      applyStatus,
      needsClarification: applyStatus === "needs_clarification",
      reasoning: planned.reasoning,
    };
  }

  const project = rememberExecution(
    applied.project,
    input.request,
    {
      ...verified,
      success: status === "applied" || verified.success,
      verified: true,
      explanation:
        verified.explanation ||
        planned.explanation ||
        "Done. I applied that update.",
    },
    operations,
  );
  return {
    project,
    operations,
    changes: applied.changes,
    explanation:
      verified.explanation ||
      planned.explanation ||
      "Done. I applied that update.",
    applyStatus: "applied",
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
    attachmentContexts: input.attachmentContexts,
  });
}

/**
 * Orchestrate specialists and return a unified Atlas response.
 * Async so LLM design critique can run when the provider is configured.
 */
export async function runAtlasBrain(
  input: EditorAgentInput,
): Promise<AtlasBrainResult> {
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

  // Sprint 29.2 — normalize legacy nested clarification → single top-level pending.
  let projectForTurn = normalizeInteractionState(input.project);
  if (
    shouldOverridePendingClarification(request) &&
    hasPendingClarification(getActionMemory(projectForTurn))
  ) {
    projectForTurn = setInteractionState(
      projectForTurn,
      clearPendingClarification(getActionMemory(projectForTurn), {
        reason: "critique_override",
      }),
    );
    if (getInteractionState(projectForTurn).activeTask) {
      projectForTurn = clearActiveTask(projectForTurn, "critique_override");
    }
  }

  // Sprint 29.5 — explicit topic switch clears prior task before new domain runs.
  {
    const currentTask = getInteractionState(projectForTurn).activeTask;
    if (currentTask && isExplicitTopicSwitch(currentTask, request)) {
      const fresh = detectFreshTaskIntent(request);
      if (shouldClearActiveTask("topic_switch", currentTask, request)) {
        projectForTurn = clearActiveTask(
          projectForTurn,
          fresh === "critique" ? "critique_override" : "topic_switch",
        );
      }
    }
  }

  // v1.2 — user disputes prior edit → verify/repair (never restart with plan chips)
  const repaired = tryRepairDisputedExecution({
    project: projectForTurn,
    request,
  });
  if (repaired) {
    return {
      ...repaired,
      changes: repaired.changes.map((c) => ({
        id: c.id,
        label: c.label,
        ok: true as const,
      })),
      followUpSuggestions: followUpsForProject(
        repaired.project,
        repaired.followUpSuggestions,
      ),
      atlasMemory: repaired.project.atlasMemory,
    };
  }

  // Brand regression from a prior over-scoped edit — restore palette, don’t redesign.
  const brandRestored = tryRestoreBrandPalette({
    project: projectForTurn,
    request,
  });
  if (brandRestored) {
    return {
      ...brandRestored,
      followUpSuggestions: followUpsForProject(
        brandRestored.project,
        brandRestored.followUpSuggestions ?? [],
      ),
      atlasMemory: brandRestored.project.atlasMemory,
    };
  }

  // 1) Typed pending clarification (color / image_target) before hero edits.
  const typedResolved = await tryResolveTypedClarification({
    project: projectForTurn,
    request,
  });
  if (typedResolved) {
    return typedResolved;
  }

  const activeForIntent = getInteractionState(projectForTurn).activeTask;
  const greyAreaSource = diagnoseGreyAreaSource(projectForTurn);
  logHeroIntentDiagnostics(
    buildHeroIntentDiagnostics({
      request,
      activeTask: activeForIntent,
      requestId: input.atlasRequestId,
      greyAreaSource,
    }),
  );

  // P1.6 priority: active/hero-domain composition before gallery lightbox.
  // Explicit gallery-with-evidence still owns the turn.
  const preferHeroDomain =
    (isActiveHeroTask(activeForIntent) || isHeroDomainRequest(request)) &&
    !galleryMayOwnRequest(request);

  const runHeroHandlers = (): AtlasBrainResult | null => {
    // Visual Composition Engine owns blur / photo-clear / relocate-copy turns.
    const vcExplain = tryExplainVisualComposition({
      project: projectForTurn,
      request,
      requestId: input.atlasRequestId,
    });
    if (vcExplain) return vcExplain;

    const vcRefine = tryApplyVisualCompositionRefinement({
      project: projectForTurn,
      request,
      requestId: input.atlasRequestId,
    });
    if (vcRefine) return vcRefine;

    const heroPattern = tryApplyHeroPattern({
      project: projectForTurn,
      request,
      requestId: input.atlasRequestId,
    });
    if (heroPattern) return heroPattern;

    const heroProfessional = tryApplyHeroProfessionalComposition({
      project: projectForTurn,
      request,
      requestId: input.atlasRequestId,
    });
    if (heroProfessional) return heroProfessional;

    const heroFit = tryApplyHeroFit({
      project: projectForTurn,
      request,
      requestId: input.atlasRequestId,
    });
    if (heroFit) return heroFit;

    const heroBalanced = tryApplyHeroBalanceRepair({
      project: projectForTurn,
      request,
      requestId: input.atlasRequestId,
    });
    if (heroBalanced) return heroBalanced;

    return null;
  };

  if (preferHeroDomain) {
    const heroOwned = runHeroHandlers();
    if (heroOwned) {
      return {
        ...heroOwned,
        followUpSuggestions: followUpsForProject(
          heroOwned.project,
          heroOwned.followUpSuggestions ?? [],
        ),
        atlasMemory: heroOwned.project.atlasMemory,
      };
    }
  }

  // Gallery lightbox / metadata — requires gallery evidence (never bare full-picture).
  const galleryLightbox = tryApplyGalleryLightbox({
    project: projectForTurn,
    request,
  });
  if (galleryLightbox) {
    return {
      ...galleryLightbox,
      followUpSuggestions: followUpsForProject(
        galleryLightbox.project,
        galleryLightbox.followUpSuggestions ?? [],
      ),
      atlasMemory: galleryLightbox.project.atlasMemory,
    };
  }

  const galleryMeta = tryApplyGalleryMetadata({
    project: projectForTurn,
    request,
  });
  if (galleryMeta) {
    return {
      ...galleryMeta,
      followUpSuggestions: followUpsForProject(
        galleryMeta.project,
        galleryMeta.followUpSuggestions ?? [],
      ),
      atlasMemory: galleryMeta.project.atlasMemory,
    };
  }

  // Scoped surface styling (text boxes / form fields) — never global theme.
  const surfaceStyled = tryApplySurfaceStyle({
    project: projectForTurn,
    request,
  });
  if (surfaceStyled) {
    return {
      ...surfaceStyled,
      followUpSuggestions: followUpsForProject(
        surfaceStyled.project,
        surfaceStyled.followUpSuggestions ?? [],
      ),
      atlasMemory: surfaceStyled.project.atlasMemory,
    };
  }

  // Fresh hero edits when not already preferred above.
  if (!preferHeroDomain) {
    const heroOwned = runHeroHandlers();
    if (heroOwned) {
      return {
        ...heroOwned,
        followUpSuggestions: followUpsForProject(
          heroOwned.project,
          heroOwned.followUpSuggestions ?? [],
        ),
        atlasMemory: heroOwned.project.atlasMemory,
      };
    }
  }

  // Complete my website — BEFORE Action Memory Apply All.
  // Authorization is explicit: Strategic assessment → Transformation execution.
  // Never pause at Review Plan / Apply All.
  if (
    isCompleteWebsiteRequest(request) ||
    isStrategicCompletionRequest(request)
  ) {
    const completeMemory = getActionMemory(projectForTurn);
    const strategic = assessStrategicPriorities({
      project: projectForTurn,
      logDiagnostics: process.env.NODE_ENV === "development",
    });
    const strategicPreface = formatStrategicDirectorReport(strategic, {
      mode: "execute_completion",
    });

    const completionExecutionPlan = {
      goal: "Complete the website for launch",
      steps: [
        {
          id: "complete.strategy",
          agent: "creative_director" as const,
          label: "Strategic Director prioritizes specialists",
        },
        {
          id: "complete.transform",
          agent: "creative_director" as const,
          label: "Execute the coordinated transformation plan",
        },
        {
          id: "complete.verify",
          agent: "creative_director" as const,
          label: "Verify the whole-page result",
        },
      ],
      estimatedImpact: "high" as const,
    };

    const { plan } = buildTransformationPlanForProject(
      projectForTurn,
      "Complete my website for launch",
    );
    const goalIds = plan.goals.map((g) => g.id);
    const fingerprint = buildTransformationFingerprint({
      project: projectForTurn,
      goalIds,
    });
    const prior = shouldSkipRepeatedNoGainAttempt({
      memory: completeMemory,
      fingerprint,
    });
    const executionStarted = !prior;
    const tx = prior
      ? skippedRepeatTransformationResult({
          project: projectForTurn,
          plan,
          prior,
        })
      : executeTransformationPlan({
          project: projectForTurn,
          plan,
          logDiagnostics: process.env.NODE_ENV === "development",
          allowTastePolish: true,
        });

    const idempotent = isIdempotentCompletion({
      assessment: strategic,
      tx,
      skippedAsRepeat: Boolean(prior),
    });

    logStrategicCompletionDiagnostics(
      {
        strategicRequestMode: "execute_completion",
        strategicAdvisoryQuestion: null,
        selectedLeader: strategic.recommendedLeader,
        highestPriorityOpportunity:
          strategic.highestPriorityOpportunity?.title ?? null,
        transformationHandoff: true,
        transformationPlanId: tx.planId ?? null,
        executionStarted,
        executionResult: idempotent
          ? "skipped_idempotent"
          : tx.status,
        blockedWork: strategic.blockedWork.map((b) => b.title),
        tastePassTriggered: Boolean(tx.tastePolishApplied),
        finalVerified: Boolean(tx.wholePage?.passed || tx.status === "applied"),
      },
      input.atlasRequestId,
    );

    let project = withMemory(tx.project, request);
    // Never leave a Review/Apply All plan after explicit completion.
    project = setInteractionState(
      project,
      clearRecommendations(getActionMemory(project)),
    );
    if (!tx.skippedAsRepeat) {
      project = persistTransformationAttempt(project, tx, goalIds);
    } else if (prior) {
      project = setInteractionState(
        project,
        storeTransformationAttempt(getActionMemory(project), {
          ...prior,
          at: new Date().toISOString(),
        }),
      );
    }
    invalidateCritiquePipelineCache(creativeDirectorFingerprint(project));

    const applied =
      !idempotent &&
      (tx.status === "applied" || tx.status === "partially_applied") &&
      !tx.skippedAsRepeat &&
      tx.operations.length > 0;

    const explanation = formatStrategicCompletionReport({
      assessment: strategic,
      strategicPreface,
      tx,
      idempotent,
    });

    return {
      ok: true,
      explanation,
      operations: idempotent ? [] : tx.operations,
      changes: idempotent ? [] : tx.changes,
      project,
      applyStatus: applied ? "applied" : "no_changes",
      decision: {
        intent: "design_redesign",
        confidence: 0.95,
        selectedAgents: ["creative_director", "editor_agent"],
        needsClarification: false,
        shouldExecuteEdits: applied,
        executionPlan: completionExecutionPlan,
        explanation:
          "Strategic Director prioritized the work; Transformation Engine executed the coordinated plan.",
        followUpSuggestions: followUpsForProject(project, [
          ...STRATEGIC_COMPLETION_FOLLOW_UPS,
        ]),
        decisionStage: "strategic_director",
        commandKind: "strategic_director",
        matchedSignals: [
          "strategic_director",
          "execute_completion",
          `leader:${strategic.recommendedLeader}`,
          "transformationHandoff",
        ],
      },
      followUpSuggestions: followUpsForProject(project, [
        ...STRATEGIC_COMPLETION_FOLLOW_UPS,
      ]),
      executionPlan: completionExecutionPlan,
      atlasMemory: project.atlasMemory,
    };
  }

  // 5) Action Memory — explicit recommendation-plan continuation only (Apply All).
  const continued = await tryContinueActionMemory({
    project: projectForTurn,
    request,
  });
  if (continued) {
    return continued;
  }

  let decision = decideAtlasBrain({
    request,
    project: projectForTurn,
    history,
    attachmentContexts: input.attachmentContexts,
  });

  const atlasRequestId =
    input.atlasRequestId?.trim() || createAiRequestId();
  if (
    decision.selectedPath === "atlas_critique_pipeline" ||
    decision.intent === "design_critique" ||
    decision.intent === "design_redesign" ||
    decision.intent === "recommend"
  ) {
    logAtlasBrainRouting({
      atlasRequestId,
      detectedIntent: decision.intent,
      selectedPath: decision.selectedPath ?? "atlas_critique_pipeline",
      confidence: decision.confidence,
      matchedSignals: decision.matchedSignals ?? [],
      pipelineVersion: CRITIQUE_PIPELINE_VERSION,
    });
  }

  // Decision engine Stage 1 may surface continue_plan if short-circuit missed.
  if (decision.intent === "continue_plan") {
    const again = await tryContinueActionMemory({
      project: projectForTurn,
      request,
    });
    if (again) return again;
  }

  const preferenceNote = formatNaturalPreferenceNote(projectForTurn.atlasMemory);
  const planText = formatExecutionPlanForUser(decision.executionPlan);

  // Sprint 28.2 — never clarify when the NL Edit Planner can execute confidently.
  if (
    decision.needsClarification &&
    isNaturalLanguageEditRequest(request)
  ) {
    const nlPlan = await planNaturalLanguageEdits({
      request,
      project: projectForTurn,
    });
    if (shouldExecuteNlEditPlan(nlPlan)) {
      decision = {
        ...decision,
        intent: "nl_edit",
        confidence: nlPlan.confidence,
        selectedAgents: ["editor_agent"],
        needsClarification: false,
        explanation: nlPlan.explanation,
        decisionStage: "nl_edit",
        selectedPath: "nl_edit_planner",
        shouldExecuteEdits: true,
        matchedSignals: nlPlan.matchedSignals,
        followUpSuggestions: [
          "Improve SEO",
          "Add subtle animations",
          "Review my website",
        ],
      };
    }
  }

  if (decision.needsClarification) {
    const actionMemory = storePendingClarification(
      getActionMemory(projectForTurn),
      {
        question:
          decision.clarificationQuestion ||
          decision.explanation ||
          ATLAS_VOICE.clarificationFallback,
        allowedAnswers: [...ATLAS_BRAIN_CLARIFICATION_OPTIONS],
      },
    );
    const project = setInteractionState(
      withMemory(projectForTurn, request, decision.memoryPatch),
      actionMemory,
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
    const project = withMemory(projectForTurn, request, decision.memoryPatch);
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

  // Strategic Director — advisory prioritization only. Completion handled above.
  if (
    (decision.commandKind === "strategic_director" ||
      decision.decisionStage === "strategic_director" ||
      isStrategicAdvisoryRequest(request)) &&
    !isStrategicCompletionRequest(request)
  ) {
    const classified = classifyStrategicRequest(request);
    const assessment = assessStrategicPriorities({
      project: projectForTurn,
      requestId: atlasRequestId,
      logDiagnostics: process.env.NODE_ENV === "development",
    });
    let explanation = formatStrategicDirectorReport(assessment, {
      mode: "advisory",
      advisoryQuestion: classified?.advisoryQuestion ?? "general_priority",
    });
    if (strategicTextExposesInternalIds(explanation)) {
      explanation =
        "Here’s the strategic priority. The largest opportunity should lead; polish and secondary refinements wait until that foundation is sound.";
    }
    if (process.env.NODE_ENV === "development") {
      console.info("[atlas:strategic-director:advisory]", {
        requestId: atlasRequestId,
        strategicRequestMode: "advisory",
        strategicAdvisoryQuestion: classified?.advisoryQuestion ?? null,
        selectedLeader: assessment.recommendedLeader,
        highestPriorityOpportunity:
          assessment.highestPriorityOpportunity?.title ?? null,
        transformationHandoff: false,
        executionStarted: false,
        blockedWork: assessment.blockedWork.map((b) => b.title),
      });
    }
    const project = withMemory(projectForTurn, request, decision.memoryPatch);
    return {
      ok: true,
      explanation,
      operations: [],
      changes: [],
      project,
      applyStatus: "no_changes",
      decision: {
        ...decision,
        commandKind: "strategic_director",
        decisionStage: "strategic_director",
        shouldExecuteEdits: false,
        needsClarification: false,
        explanation,
        matchedSignals: [
          "strategic_director",
          "advisory",
          `leader:${assessment.recommendedLeader}`,
          classified?.advisoryQuestion
            ? `question:${classified.advisoryQuestion}`
            : "question:general_priority",
        ],
      },
      followUpSuggestions: [...STRATEGIC_DIRECTOR_FOLLOW_UPS],
      executionPlan: decision.executionPlan,
      atlasMemory: project.atlasMemory,
    };
  }

  // Conversion Director — analysis only (Phase 1). Never edits / Apply All / chips.
  if (
    decision.commandKind === "conversion_director" ||
    decision.decisionStage === "conversion_director" ||
    isConversionDirectorRequest(request)
  ) {
    const evaluation = evaluateConversion({ project: projectForTurn });
    let explanation = formatConversionDirectorReport(evaluation);
    if (conversionTextExposesInternalIds(explanation)) {
      explanation =
        "Here’s a conversion-focused review — analysis only, no changes applied. Prioritize trust and proof before the ask, then tighten CTA and contact flow.";
    }
    const project = withMemory(projectForTurn, request, decision.memoryPatch);
    if (process.env.NODE_ENV === "development") {
      logScopeDiagnostics({
        requestOwner: "conversion_director",
        selectedDirector: "conversion_director",
        scopeViolations: [],
        blockedRecommendations: [],
        conversionScore: evaluation.overallConversion,
        highestPriorityImprovement: evaluation.highestPriorityImprovement,
        requestId: atlasRequestId,
      });
    }
    return {
      ok: true,
      explanation,
      operations: [],
      changes: [],
      project,
      applyStatus: "no_changes",
      decision: {
        ...decision,
        commandKind: "conversion_director",
        decisionStage: "conversion_director",
        shouldExecuteEdits: false,
        needsClarification: false,
        explanation,
      },
      followUpSuggestions: [...CONVERSION_DIRECTOR_FOLLOW_UPS],
      executionPlan: decision.executionPlan,
      atlasMemory: project.atlasMemory,
    };
  }

  // Visual Composition Engine — never stub Q&A / never fall into critique or polish.
  if (
    decision.commandKind === "visual_composition" ||
    decision.decisionStage === "visual_composition"
  ) {
    const vcExplain = tryExplainVisualComposition({
      project: projectForTurn,
      request,
      requestId: atlasRequestId,
    });
    if (vcExplain) {
      return {
        ...vcExplain,
        followUpSuggestions: followUpsForProject(
          vcExplain.project,
          vcExplain.followUpSuggestions ?? [],
        ),
        atlasMemory: vcExplain.project.atlasMemory,
      };
    }
    const vcRefine = tryApplyVisualCompositionRefinement({
      project: projectForTurn,
      request,
      requestId: atlasRequestId,
    });
    if (vcRefine) {
      return {
        ...vcRefine,
        followUpSuggestions: followUpsForProject(
          vcRefine.project,
          vcRefine.followUpSuggestions ?? [],
        ),
        atlasMemory: vcRefine.project.atlasMemory,
      };
    }
  }

  // Informational questions — explain only; never critique pipeline or edits.
  if (decision.intent === "question") {
    const project = withMemory(projectForTurn, request, decision.memoryPatch);
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

  // Sprint 28.1A — design_critique / design_redesign / recommend → unified pipeline only.
  if (
    decision.intent === "design_critique" ||
    decision.intent === "design_redesign" ||
    decision.intent === "recommend"
  ) {
    const wantsExecute =
      decision.intent === "design_redesign" ||
      decision.shouldExecuteEdits === true;
    const critiqueResult = await runAtlasCritiquePipeline({
      project: projectForTurn,
      request,
      mode: wantsExecute ? "execute" : "critique",
      history,
      atlasRequestId,
    });

    if (!critiqueResult.ok) {
      return {
        ok: true,
        explanation: `I couldn’t finish the design critique (${critiqueResult.message}). Try again in a moment, or ask for a specific change.`,
        operations: [],
        changes: [],
        project: withMemory(projectForTurn, request, decision.memoryPatch),
        applyStatus: "no_changes",
        decision,
        followUpSuggestions: ["Improve SEO", "Add testimonials", "Apply All"],
        executionPlan: decision.executionPlan,
        atlasMemory: projectForTurn.atlasMemory,
      };
    }

    // Creative Director is presentation/maturity only — not a second reasoning engine.
    const creative = reviewCreativeDirector({
      project: projectForTurn,
      limit: 1,
    });
    // v1.6.2 — Strategic Director arbitrates critique recommendations before presentation.
    // Same project truth → same highest priority as Complete (authorization UX differs).
    const strategicAssessment = assessStrategicPriorities({
      project: projectForTurn,
      requestId: atlasRequestId,
      logDiagnostics: process.env.NODE_ENV === "development",
    });
    const arbitrated = arbitrateReviewRecommendations({
      assessment: strategicAssessment,
      recommendations: critiqueResult.recommendations,
    });
    const postCompletionEvidence = hasRecentNoGainCompletion({
      lastAttempt: getActionMemory(projectForTurn).lastTransformationAttempt,
    });
    const projectRevision = projectRevisionFromFingerprint(
      creativeDirectorFingerprint(projectForTurn),
    );
    const reviewPlanSnapshot = buildReviewPlanSnapshot({
      assessment: strategicAssessment,
      projectRevision,
      recommendations: arbitrated,
      postCompletionEvidence,
    });
    const supportPlan = formatRecommendationSupportPlan(arbitrated);
    const strategicReviewExplanation = formatStrategicallyPrioritizedReview({
      assessment: strategicAssessment,
      recommendations: arbitrated,
      critiqueExplanation: critiqueResult.explanation,
    });
    const applyable = arbitrated.filter((r) => r.applyable);
    const actionMemory = storeRecommendations(getActionMemory(projectForTurn), {
      stored: arbitrated.map(enrichStoredRecommendation),
      creativeReport: {
        overallCompleteness: creative.overallCompleteness,
        maturityLevel: creative.maturityLevel,
        fingerprint: creative.fingerprint,
        reviewedAt: creative.reviewedAt,
      },
      executionPlan: decision.executionPlan,
      // Keep TX plan for Complete continuity, but Apply All uses reviewPlanSnapshot.
      transformationPlan: critiqueResult.strategy?.transformationPlan ?? null,
      reviewPlanSnapshot,
      sourceOverride: "design_critique",
    });
    if (process.env.NODE_ENV === "development") {
      logReviewPlanDiagnostics({
        snapshot: reviewPlanSnapshot,
        requestId: atlasRequestId,
      });
    }
    let project = setInteractionState(
      withMemory(projectForTurn, request, decision.memoryPatch),
      actionMemory,
    );

    if (wantsExecute && applyable.length > 0) {
      const batch = applyAllCreativeRecommendations({
        project,
        recommendations: applyable.slice(0, 6),
      });
      if (batch.ok && batch.status === "applied") {
        invalidateCritiquePipelineCache(
          creativeDirectorFingerprint(batch.project),
        );
        project = setInteractionState(
          batch.project,
          clearRecommendations(getActionMemory(batch.project)),
        );
        return {
          ok: true,
          explanation: [
            strategicReviewExplanation
              .replace(/Say Apply all when you’re ready[^\n]*/i, "")
              .trim(),
            batch.explanation,
            supportPlan,
          ]
            .filter(Boolean)
            .join("\n\n"),
          operations: applyable.flatMap((r) => r.operations).slice(0, 24),
          changes: batch.changes,
          project,
          applyStatus: "applied",
          decision,
          followUpSuggestions: [
            "Add matching images",
            "Improve SEO",
            "Add subtle animations",
          ],
          executionPlan: decision.executionPlan,
          atlasMemory: project.atlasMemory,
        };
      }
    }

    return {
      ok: true,
      explanation: [strategicReviewExplanation, "", supportPlan]
        .filter(Boolean)
        .join("\n"),
      operations: [],
      changes: [],
      project,
      applyStatus: "no_changes",
      decision,
      followUpSuggestions: [
        "Apply All",
        ...decision.followUpSuggestions.filter(
          (s) => s !== "Apply the top improvement" && s !== "Apply All",
        ),
        "Apply the top improvement",
      ].slice(0, 4),
      executionPlan: decision.executionPlan,
      atlasMemory: project.atlasMemory,
    };
  }

  let project = projectForTurn;
  const operations: Array<EditOperation | ImageOperation> = [];
  const changes: EditChangeSummary[] = [];
  let explanation = decision.explanation;
  let imageEditorState = input.imageEditorState ?? undefined;
  let applyStatus: EditorAgentResult["applyStatus"] = "no_changes";
  let reasoning: EditorAgentResult["reasoning"];

  if (planText && decision.selectedAgents.length > 1) {
    explanation = appendExplanation(planText, explanation);
  }
  if (preferenceNote) {
    explanation = appendExplanation(explanation, preferenceNote);
  }

  const agents = new Set(decision.selectedAgents);

  // Explicit section-order commands — plan → apply → verify → respond
  if (
    decision.commandKind === "section_order" ||
    isSectionOrderRequest(request)
  ) {
    const parsed = parseSectionMoveRequest(request);
    if (!parsed.ok) {
      if (parsed.reason) {
        project = withMemory(project, request, decision.memoryPatch);
        return {
          ok: true,
          explanation: parsed.reason,
          operations: [],
          changes: [],
          project,
          applyStatus: "needs_clarification",
          decision,
          followUpSuggestions: [
            "Move Contact to the bottom",
            "Put Testimonials above Services",
            "Make the hero first",
          ],
          executionPlan: decision.executionPlan,
          atlasMemory: project.atlasMemory,
        };
      }
    } else {
      const intent = parsed.intent;
      const sectionName = sectionDisplayName(intent.section);

      if (isSectionAlreadyAtIntent(project, intent)) {
        const already = verifyMoveSection(project, project, intent);
        project = rememberExecution(project, request, already, []);
        project = withMemory(project, request, decision.memoryPatch);
        return {
          ok: true,
          explanation: `${sectionName} is already in that position.`,
          operations: [],
          changes: [],
          project,
          applyStatus: "no_changes",
          decision,
          followUpSuggestions: decision.followUpSuggestions.slice(0, 1),
          executionPlan: decision.executionPlan,
          atlasMemory: project.atlasMemory,
        };
      }

      const sectionMissing = !isSectionPresentOnPage(project, intent.section);
      const anchorMissing =
        Boolean(intent.relativeTo) &&
        (intent.position === "before" || intent.position === "after") &&
        !isSectionPresentOnPage(project, intent.relativeTo!);

      if (sectionMissing && !isInsertableSectionType(intent.section)) {
        const failed: EditExecutionResult = {
          success: false,
          verified: true,
          operationType: "moveSection",
          verificationFailures: [
            `The page doesn’t contain a ${sectionName} section.`,
          ],
          createdEntities: [],
          modifiedEntities: [],
          warnings: [],
          explanation: `I can’t move ${sectionName} because the page doesn’t contain that section yet.`,
          followUpRecommendation: "Review my website",
        };
        project = rememberExecution(project, request, failed, []);
        project = withMemory(project, request, decision.memoryPatch);
        return {
          ok: true,
          explanation: failed.explanation,
          operations: [],
          changes: [],
          project,
          applyStatus: "needs_clarification",
          decision,
          followUpSuggestions: failed.followUpRecommendation
            ? [failed.followUpRecommendation]
            : [],
          executionPlan: decision.executionPlan,
          atlasMemory: project.atlasMemory,
        };
      }

      if (anchorMissing) {
        const anchorName = sectionDisplayName(intent.relativeTo!);
        const failed: EditExecutionResult = {
          success: false,
          verified: true,
          operationType: "moveSection",
          verificationFailures: [
            `The anchor section “${anchorName}” isn’t on the page.`,
          ],
          createdEntities: [],
          modifiedEntities: [],
          warnings: [],
          explanation: `I couldn’t place ${sectionName} ${intent.position} ${anchorName} because ${anchorName} isn’t on the page.`,
          followUpRecommendation: isInsertableSectionType(intent.relativeTo!)
            ? `Add ${anchorName}`
            : "Review my website",
        };
        project = rememberExecution(project, request, failed, []);
        project = withMemory(project, request, decision.memoryPatch);
        return {
          ok: true,
          explanation: failed.explanation,
          operations: [],
          changes: [],
          project,
          applyStatus: "needs_clarification",
          decision,
          followUpSuggestions: failed.followUpRecommendation
            ? [failed.followUpRecommendation]
            : [],
          executionPlan: decision.executionPlan,
          atlasMemory: project.atlasMemory,
        };
      }

      try {
        const opList: EditOperation[] = [];
        if (sectionMissing && isInsertableSectionType(intent.section)) {
          opList.push({
            operation: "insertSection",
            type: intent.section as InsertableSectionType,
          });
        }
        opList.push({
          operation: "moveSection",
          section: intent.section,
          position: intent.position,
          ...(intent.relativeTo ? { relativeTo: intent.relativeTo } : {}),
        });
        const ops = validateEditOperations(opList);
        const before = project;
        const applied = applyEditOperations(before, ops);
        const verified = verifyEditExecution(before, applied.project, ops);
        const status = applyStatusFromExecution(verified);

        if (status === "applied") {
          project = rememberExecution(
            applied.project,
            request,
            verified,
            ops,
          );
          project = touchActiveTask(project, {
            kind: "section_layout",
            target: { type: "section", section: intent.section },
            userGoal: request,
          });
          project = withMemory(project, request, decision.memoryPatch);
          const followUps = followUpsForProject(
            project,
            verified.followUpRecommendation
              ? [verified.followUpRecommendation]
              : decision.followUpSuggestions.slice(0, 1),
          );
          return {
            ok: true,
            explanation: verified.explanation,
            operations: ops,
            changes: dedupeChangeLabels(applied.changes),
            project,
            applyStatus: "applied",
            decision,
            followUpSuggestions: followUps,
            executionPlan: decision.executionPlan,
            atlasMemory: project.atlasMemory,
          };
        }

        project = rememberExecution(before, request, verified, ops);
        project = withMemory(project, request, decision.memoryPatch);
        return {
          ok: true,
          explanation:
            verified.explanation ||
            `I wasn’t able to move ${sectionName}.`,
          operations: [],
          changes: [],
          project,
          applyStatus: status,
          decision,
          followUpSuggestions: verified.followUpRecommendation
            ? [verified.followUpRecommendation]
            : decision.followUpSuggestions.slice(0, 1),
          executionPlan: decision.executionPlan,
          atlasMemory: project.atlasMemory,
        };
      } catch {
        // fall through
      }
    }
  }

  // Hero readability — local treatments only; user reports override heuristic no-op
  if (
    decision.commandKind === "hero_readability" ||
    isHeroReadabilityRequest(request)
  ) {
    const preservation = defaultHeroPreservationContext();
    const planned = planHeroReadabilityOperations(project, preservation, {
      request,
    });

    if (planned.maxRepairReached || (planned.operations.length === 0 && planned.assessment.userReportedIssue)) {
      const explanation = buildHeroReadabilityExplanation(
        planned.assessment,
        planned.assessment,
        [],
        {
          preservedPalette: true,
          repairLevelAfter: planned.repairLevelAfter,
          maxRepairReached: true,
        },
      );
      logHeroReadabilityDiagnostics(
        buildHeroReadabilityDiagnostics({
          requestId: input.atlasRequestId,
          before: project,
          after: project,
          treatments: [],
          verified: false,
          preservation,
          assessmentSource: planned.assessment.source,
          userReportedIssue: planned.assessment.userReportedIssue,
          repairLevelBefore: planned.repairLevelBefore,
          repairLevelAfter: planned.repairLevelAfter,
        }),
      );
      project = rememberExecution(
        withHeroReadabilityRepairLevel(
          withMemory(project, request, decision.memoryPatch),
          3,
        ),
        request,
        {
          success: false,
          verified: true,
          operationType: "hero_readability",
          verificationFailures: [],
          createdEntities: [],
          modifiedEntities: [],
          warnings: [],
          explanation,
        },
        [],
        { paletteBefore: planned.paletteBefore, scope: "hero" },
      );
      return {
        ok: true,
        explanation,
        operations: [],
        changes: [],
        project,
        applyStatus: "no_changes",
        decision,
        followUpSuggestions: ["Try a different hero image"],
        executionPlan: decision.executionPlan,
        atlasMemory: project.atlasMemory,
      };
    }

    if (planned.alreadyReadable || planned.operations.length === 0) {
      const explanation = buildHeroReadabilityExplanation(
        planned.assessment,
        planned.assessment,
        [],
        { preservedPalette: true },
      );
      logHeroReadabilityDiagnostics(
        buildHeroReadabilityDiagnostics({
          requestId: input.atlasRequestId,
          before: project,
          after: project,
          treatments: [],
          verified: false,
          preservation,
          assessmentSource: planned.assessment.source,
          userReportedIssue: false,
          repairLevelBefore: planned.repairLevelBefore,
          repairLevelAfter: planned.repairLevelAfter,
        }),
      );
      project = rememberExecution(
        withMemory(project, request, decision.memoryPatch),
        request,
        {
          success: false,
          verified: true,
          operationType: "hero_readability",
          verificationFailures: [],
          createdEntities: [],
          modifiedEntities: [],
          warnings: [],
          explanation,
        },
        [],
        { paletteBefore: planned.paletteBefore, scope: "hero" },
      );
      return {
        ok: true,
        explanation,
        operations: [],
        changes: [],
        project,
        applyStatus: "no_changes",
        decision,
        followUpSuggestions: planned.assessment.hasHeroImage
          ? ["Try a different hero image", "Strengthen the hero overlay"]
          : ["Review my website"],
        executionPlan: decision.executionPlan,
        atlasMemory: project.atlasMemory,
      };
    }

    try {
      const ops = validateEditOperations(
        filterOperationsForBrandPreservation(planned.operations, preservation),
      );
      const before = project;
      const applied = applyEditOperations(before, ops);
      const paletteSafe = restoreBrandPalette(
        applied.project,
        planned.paletteBefore,
      );
      const userReported = Boolean(planned.assessment.userReportedIssue);
      const scoreCheck = verifyHeroReadabilityImprovement(
        before,
        paletteSafe,
        preservation,
        { userReportedIssue: userReported },
      );
      const afterAssessment = analyzeHeroReadability(paletteSafe, preservation);
      const explanation = buildHeroReadabilityExplanation(
        planned.assessment,
        { ...afterAssessment, userReportedIssue: userReported },
        planned.assessment.recommendedTreatments,
        {
          preservedPalette: true,
          repairLevelAfter: planned.repairLevelAfter,
        },
      );

      logHeroReadabilityDiagnostics(
        buildHeroReadabilityDiagnostics({
          requestId: input.atlasRequestId,
          before,
          after: paletteSafe,
          treatments: planned.assessment.recommendedTreatments,
          verified: scoreCheck.improved,
          preservation,
          assessmentSource: planned.assessment.source,
          userReportedIssue: userReported,
          repairLevelBefore: planned.repairLevelBefore,
          repairLevelAfter: planned.repairLevelAfter,
        }),
      );

      if (
        !scoreCheck.improved ||
        scoreCheck.preservationViolation ||
        scoreCheck.globalThemeTokensChanged.length > 0
      ) {
        project = rememberExecution(
          withMemory(before, request, decision.memoryPatch),
          request,
          {
            success: false,
            verified: true,
            operationType: "hero_readability",
            verificationFailures: scoreCheck.explanationHint
              ? [scoreCheck.explanationHint]
              : [],
            createdEntities: [],
            modifiedEntities: [],
            warnings: [],
            explanation:
              scoreCheck.explanationHint ||
              "I wasn’t able to improve hero readability without changing your brand colors.",
          },
          ops,
          { paletteBefore: planned.paletteBefore, scope: "hero" },
        );
        return {
          ok: true,
          explanation:
            scoreCheck.explanationHint ||
            "I wasn’t able to improve hero readability without changing your brand colors. A stronger overlay or a different hero image would help.",
          operations: [],
          changes: [],
          project,
          applyStatus: "no_changes",
          decision,
          followUpSuggestions: [
            "Strengthen the hero overlay",
            "Try a different hero image",
          ],
          executionPlan: decision.executionPlan,
          atlasMemory: project.atlasMemory,
        };
      }

      const withLevel = withHeroReadabilityRepairLevel(
        paletteSafe,
        planned.repairLevelAfter,
      );
      const withTask = touchActiveVisualTask(
        withMemory(withLevel, request, decision.memoryPatch),
        {
          kind: "hero_readability",
          lastUserGoal: request,
          repairLevel: planned.repairLevelAfter,
        },
      );
      project = rememberExecution(
        withTask,
        request,
        {
          success: true,
          verified: true,
          operationType: "hero_readability",
          verificationFailures: [],
          createdEntities: [],
          modifiedEntities: scoreCheck.heroTokensChanged,
          warnings: [],
          explanation,
        },
        ops,
        { paletteBefore: planned.paletteBefore, scope: "hero" },
      );
      return {
        ok: true,
        explanation,
        operations: ops,
        changes: dedupeChangeLabels(applied.changes),
        project,
        applyStatus: "applied",
        decision,
        followUpSuggestions:
          planned.repairLevelAfter >= 2
            ? ["Use the full picture", "Try a different hero image"]
            : ["Review my website"],
        executionPlan: decision.executionPlan,
        atlasMemory: project.atlasMemory,
      };
    } catch {
      // fall through
    }
  }

  // Taste Engine Phase 2 — one guarded final polish pass.
  if (
    decision.commandKind === "taste_polish" ||
    isTastePolishRequest(request)
  ) {
    const polish = executeTastePolish({
      project: projectForTurn,
      requestId: atlasRequestId,
      logDiagnostics: process.env.NODE_ENV === "development",
    });
    let explanation = polish.explanation;
    if (tastePolishMentionsInternalIds(explanation)) {
      explanation =
        polish.applied
          ? "I completed a final polish pass. The content, brand, and page structure stayed unchanged."
          : polish.explanation.replace(
              /\b(tasteEvaluation|eligibleToJudge|overallTaste|setCreativePolish)\b/g,
              "the design",
            );
    }
    const project = withMemory(polish.project, request, decision.memoryPatch);
    return {
      ok: true,
      explanation,
      operations: polish.operations,
      changes:
        polish.applied && polish.operations.length > 0
          ? [
              {
                id: "taste.polish",
                label: "Final visual polish",
                ok: true as const,
              },
            ]
          : [],
      project,
      applyStatus: polish.applied
        ? "applied"
        : polish.verdict === "already_polished"
          ? "no_changes"
          : polish.verdict === "ineligible"
            ? "no_changes"
            : "no_changes",
      decision: {
        ...decision,
        commandKind: "taste_polish",
        shouldExecuteEdits: polish.applied,
        explanation,
      },
      followUpSuggestions: filterFollowUpsForOwner(
        "taste",
        polish.verdict === "ineligible"
          ? ["Review my website", "Complete my website", "Improve SEO"]
          : ["Review my website", "Improve SEO", "Open the spacing"],
      ).allowed,
      executionPlan: decision.executionPlan,
      atlasMemory: project.atlasMemory,
    };
  }

  // Explicit polish commands — apply before broader specialists
  const isMotionCommand =
    decision.commandKind === "animations" ||
    decision.commandKind === "remove_animations" ||
    decision.intent === "command_animations";
  const motionPreset = isMotionCommand
    ? (desiredMotionPresetFromRequest(request) ??
      (decision.commandKind === "remove_animations" ? "none" : "subtle"))
    : null;

  if (motionPreset && isMotionCommand) {
    if (isMotionStateActive(project, motionPreset)) {
      project = withMemory(project, request, decision.memoryPatch);
      return {
        ok: true,
        explanation: motionAlreadyActiveMessage(motionPreset),
        operations: [],
        changes: [],
        project,
        applyStatus: "no_changes",
        decision,
        followUpSuggestions: [
          "Remove all animations",
          "Improve visual hierarchy",
          "Review my website",
        ],
        executionPlan: decision.executionPlan,
        atlasMemory: project.atlasMemory,
      };
    }

    try {
      const fields = motionFieldsForPreset(motionPreset);
      const ops = validateEditOperations([
        {
          operation: "setCreativePolish",
          ...fields,
          ...(motionPreset !== "none" ? { visualHierarchy: true } : {}),
        },
      ]);
      const applied = applyEditOperations(project, ops);
      if (hasMeaningfulProjectDiff(project, applied.project)) {
        project = applied.project;
        operations.push(...ops);
        changes.push(...dedupeChangeLabels(applied.changes));
        applyStatus = "applied";
        explanation = appendExplanation(
          explanation,
          motionAppliedMessage(motionPreset),
        );
      } else {
        project = withMemory(project, request, decision.memoryPatch);
        return {
          ok: true,
          explanation: motionAlreadyActiveMessage(motionPreset),
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
    } catch {
      // fall through to editor
    }
  }

  if (decision.commandKind === "icons" || decision.intent === "command_icons") {
    try {
      const ops = validateEditOperations([
        { operation: "setCreativePolish", serviceIcons: true },
      ]);
      const applied = applyEditOperations(project, ops);
      if (hasMeaningfulProjectDiff(project, applied.project)) {
        project = applied.project;
        operations.push(...ops);
        changes.push(...applied.changes);
        applyStatus = "applied";
      }
    } catch {
      // fall through
    }
  }

  // Design System Intelligence — auto-choose language when confidence is high
  // Never auto-apply a design language over scoped surface styling.
  if (
    decision.commandKind !== "surface_style" &&
    !isSurfaceStyleRequest(request) &&
    (decision.intent === "feel_direction" ||
      decision.intent === "multi_goal" ||
      decision.intent === "explicit_design_edit")
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
      attachmentContexts: input.attachmentContexts,
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

      // Placement creates durable image-continuation context (Sprint 29.5).
      const placedHero = imageResult.operations.some(
        (op) =>
          op.operation === "replaceHeroImage" ||
          (op.operation === "replaceSectionImage" && op.section === "hero") ||
          (op.operation === "setSectionImage" && op.section === "hero") ||
          (op.operation === "replacePlaceholder" &&
            op.placeholder === "hero"),
      );
      const placedGallery = imageResult.operations.some(
        (op) => op.operation === "replaceGalleryImage",
      );
      const placedSection = imageResult.operations.find(
        (op) =>
          (op.operation === "replaceSectionImage" ||
            op.operation === "setSectionImage") &&
          op.section &&
          op.section !== "hero",
      );
      if (placedHero && project.heroImageId) {
        // Hero placement owns composition follow-ups (blur / relocate copy).
        // Keep fit continuations available via the hero_* task family.
        const placementKind =
          /use\s+(this|it)\s+as\s+the\s+hero|hero\s+image/i.test(request)
            ? ("hero_composition" as const)
            : ("hero_image_fit" as const);
        project = touchActiveTask(project, {
          kind: placementKind,
          target: { type: "hero" },
          assetId: project.heroImageId,
          userGoal: request,
        });
      } else if (placedGallery) {
        const assetId =
          input.attachmentContexts?.[0]?.assetId ??
          project.galleryImageIds?.find(Boolean) ??
          undefined;
        project = touchActiveTask(project, {
          kind: "image_placement",
          target: { type: "gallery" },
          assetId: assetId ?? null,
          userGoal: request,
        });
      } else if (placedSection && "section" in placedSection) {
        const assetId = input.attachmentContexts?.[0]?.assetId ?? undefined;
        project = touchActiveTask(project, {
          kind: "image_placement",
          target: {
            type: "section",
            section: String(placedSection.section),
          },
          assetId: assetId ?? null,
          userGoal: request,
        });
      }
    } else if (
      imageResult.applyStatus === "needs_clarification" &&
      agents.size === 1
    ) {
      project = withMemory(project, request, decision.memoryPatch);
      const asksImageTarget =
        imageResult.explanation === ATLAS_VOICE.imageHint ||
        imageResult.explanation === ATLAS_VOICE.imageAmbiguous ||
        /which image/i.test(imageResult.explanation ?? "");
      if (asksImageTarget) {
        const fitFollowUp =
          isHeroFitRequest(request) ||
          /\b(entire|full|whole|cut\s+off|crop)/i.test(request) ||
          getActiveVisualTask(getActionMemory(project))?.kind ===
            "hero_image_fit";
        const memory = storePendingClarification(getActionMemory(project), {
          question: imageResult.explanation,
          kind: "image_target",
          destination: "apply_hero_fit",
          allowedAnswers: ["Hero image", "Gallery image"],
          context: {
            intent: fitFollowUp ? "hero_full_picture" : "image_select",
            priorRequest: request,
          },
        });
        project = touchActiveVisualTask(
          setInteractionState(project, memory),
          {
            kind: "hero_image_fit",
            lastUserGoal: request,
          },
        );
      }
      return {
        ok: true,
        explanation: imageResult.explanation,
        operations: [],
        changes: [],
        project,
        applyStatus: "needs_clarification",
        decision: {
          ...decision,
          needsClarification: true,
          clarificationQuestion: imageResult.explanation,
        },
        followUpSuggestions: asksImageTarget
          ? ["Hero image", "Gallery image"]
          : decision.followUpSuggestions,
        executionPlan: decision.executionPlan,
        atlasMemory: project.atlasMemory,
        imageEditorState: imageResult.editorState,
      };
    } else if (imageResult.explanation) {
      explanation = appendExplanation(explanation, imageResult.explanation);
    }
    imageEditorState = imageResult.editorState ?? imageEditorState;
  }

  // Sprint 28.1 — feel / redesign / multi-goal always use the unified critique pipeline.
  if (
    agents.has("creative_director") &&
    (decision.intent === "feel_direction" || decision.intent === "multi_goal")
  ) {
    const wantsExecute =
      decision.intent === "feel_direction" &&
      (isDesignCritiqueExecuteRequest(request) ||
        /\b(premium|agency|redesign|luxurious|luxury)\b/i.test(request));

    const critiqueResult = await runAtlasCritiquePipeline({
      project,
      request,
      mode: wantsExecute ? "execute" : "critique",
      history,
      atlasRequestId: input.atlasRequestId,
    });

    if (critiqueResult.ok) {
      const applyable = critiqueResult.recommendations.filter((r) => r.applyable);
      const supportPlan = formatRecommendationSupportPlan(
        critiqueResult.recommendations,
      );
      const actionMemory = storeRecommendations(getActionMemory(project), {
        creative: critiqueResult.recommendations,
        executionPlan: decision.executionPlan,
      });
      project = setInteractionState(project, actionMemory);

      if (wantsExecute && applyable.length > 0) {
        const batch = applyAllCreativeRecommendations({
          project,
          recommendations: applyable.slice(0, 6),
        });
        if (batch.ok && batch.status === "applied") {
          invalidateCritiquePipelineCache(
            creativeDirectorFingerprint(batch.project),
          );
          project = setInteractionState(
            batch.project,
            clearRecommendations(getActionMemory(batch.project)),
          );
          changes.push(...batch.changes);
          operations.push(
            ...applyable.flatMap((r) => r.operations).slice(0, 24),
          );
          applyStatus = "applied";
          explanation = appendExplanation(
            critiqueResult.explanation
              .replace(/I’m applying the coordinated plan next\.?/i, "")
              .trim(),
            [batch.explanation, supportPlan].filter(Boolean).join("\n"),
          );
        } else {
          explanation = appendExplanation(
            explanation,
            [critiqueResult.explanation, supportPlan].filter(Boolean).join("\n"),
          );
        }
      } else {
        explanation = appendExplanation(
          explanation,
          [critiqueResult.explanation, supportPlan].filter(Boolean).join("\n"),
        );
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
  const skipEditorAfterExplicitApply =
    applyStatus === "applied" &&
    (decision.commandKind === "section_order" ||
      decision.commandKind === "hero_readability" ||
      decision.commandKind === "hero_balance" ||
      decision.commandKind === "surface_style" ||
      decision.commandKind === "taste_polish" ||
      decision.commandKind === "animations" ||
      decision.commandKind === "remove_animations" ||
      decision.intent === "command_animations");

  if (agents.has("editor_agent") && !skipEditorAfterExplicitApply) {
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
  const followUps = followUpsForProject(
    project,
    applyStatus === "applied"
      ? decision.followUpSuggestions
      : decision.followUpSuggestions.slice(0, 3),
  );

  if (applyStatus === "applied") {
    explanation = appendExplanation(
      explanation,
      [
        "Would you like me to:",
        ...followUps.map((item) => `• ${item}`),
      ].join("\n"),
    );
  }

  // Persist paletteBefore whenever theme tokens may have changed (brand repair).
  if (
    applyStatus === "applied" &&
    operations.some((op) => op.operation === "changeTheme")
  ) {
    const themeOps = operations.filter(
      (op): op is EditOperation => op.operation === "changeTheme",
    );
    project = rememberExecution(
      project,
      request,
      {
        success: true,
        verified: true,
        operationType: "changeTheme",
        verificationFailures: [],
        createdEntities: [],
        modifiedEntities: [
          "primaryColor",
          "accentColor",
          "secondaryColor",
          "backgroundColor",
        ],
        warnings: [],
        explanation,
      },
      themeOps,
      {
        paletteBefore: captureBrandPalette(projectForTurn),
        scope: "global",
      },
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

export async function tryRunAtlasBrain(
  input: EditorAgentInput,
): Promise<AtlasBrainResult | { ok: false; code: string; message: string }> {
  try {
    return await runAtlasBrain(input);
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
