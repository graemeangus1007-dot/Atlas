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
  getActiveVisualTask,
  shouldContinueActiveHeroTask,
  touchActiveVisualTask,
} from "@/lib/ai/active-visual-task";
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

function applyActionMemoryRecommendations(input: {
  project: BusinessProject;
  memory: AtlasActionMemory;
  request: string;
  destination?: ClarificationDestination | null;
  recommendationIds?: string[];
}): AtlasBrainResult {
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

function tryApplyHeroBalanceRepair(input: {
  project: BusinessProject;
  request: string;
  requestId?: string | null;
}): AtlasBrainResult | null {
  if (
    !isHeroImageVisibilityComplaint(input.request) &&
    !isSoftHeroVisibilityRequest(input.request)
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

  // Gallery lightbox / metadata — first-class, never Action Memory.
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

  // 3–4) Active hero visual task + explicit hero edits.
  const heroProfessional = tryApplyHeroProfessionalComposition({
    project: projectForTurn,
    request,
    requestId: input.atlasRequestId,
  });
  if (heroProfessional) {
    return {
      ...heroProfessional,
      followUpSuggestions: followUpsForProject(
        heroProfessional.project,
        heroProfessional.followUpSuggestions ?? [],
      ),
      atlasMemory: heroProfessional.project.atlasMemory,
    };
  }

  const heroFit = tryApplyHeroFit({
    project: projectForTurn,
    request,
    requestId: input.atlasRequestId,
  });
  if (heroFit) {
    return {
      ...heroFit,
      followUpSuggestions: followUpsForProject(
        heroFit.project,
        heroFit.followUpSuggestions ?? [],
      ),
      atlasMemory: heroFit.project.atlasMemory,
    };
  }

  // Hero image visibility after overlay — balance repair (never empty Action Memory).
  const heroBalanced = tryApplyHeroBalanceRepair({
    project: projectForTurn,
    request,
    requestId: input.atlasRequestId,
  });
  if (heroBalanced) {
    return {
      ...heroBalanced,
      followUpSuggestions: followUpsForProject(
        heroBalanced.project,
        heroBalanced.followUpSuggestions ?? [],
      ),
      atlasMemory: heroBalanced.project.atlasMemory,
    };
  }

  // 5) Action Memory — explicit recommendation-plan continuation only.
  const continued = await tryContinueActionMemory({
    project: projectForTurn,
    request,
  });
  if (continued) {
    return continued;
  }

  // Complete my website with no applyable plan → fresh strategy/critique pipeline.
  const completeMemory = getActionMemory(projectForTurn);
  const hasApplyable = (completeMemory.activePlan?.recommendations ?? []).some(
    (r) => r.applyable,
  );
  if (isCompleteWebsiteRequest(request) && !hasApplyable) {
    const critiqueResult = await runAtlasCritiquePipeline({
      project: projectForTurn,
      request:
        "Complete my website for launch — form a design strategy, then prioritize and apply the highest-impact coordinated improvements.",
      mode: "execute",
      history,
      atlasRequestId: input.atlasRequestId,
      allowFingerprintReuse: true,
    });

    if (!critiqueResult.ok) {
      return {
        ok: true,
        explanation: `I couldn’t finish the launch-ready plan (${critiqueResult.message}). Try again in a moment.`,
        operations: [],
        changes: [],
        project: withMemory(projectForTurn, request),
        applyStatus: "no_changes",
        decision: confirmDecision(
          "Complete website",
          "Critique pipeline could not complete.",
        ),
        followUpSuggestions: [
          "Review my website",
          "Improve SEO",
          "Add testimonials",
        ],
        atlasMemory: projectForTurn.atlasMemory,
      };
    }

    const creative = reviewCreativeDirector({
      project: projectForTurn,
      limit: 1,
    });
    const supportPlan = formatRecommendationSupportPlan(
      critiqueResult.recommendations,
    );
    const applyable = critiqueResult.recommendations.filter((r) => r.applyable);
    const completionExecutionPlan = {
      goal: "Complete the website for launch",
      steps: [
        {
          id: "complete.strategy",
          agent: "creative_director" as const,
          label: "Form the design strategy",
        },
        {
          id: "complete.apply",
          agent: "creative_director" as const,
          label: "Apply every supported improvement",
        },
      ],
      estimatedImpact: "high" as const,
    };
    const actionMemory = storeRecommendations(getActionMemory(projectForTurn), {
      creative: critiqueResult.recommendations,
      creativeReport: {
        overallCompleteness: creative.overallCompleteness,
        maturityLevel: creative.maturityLevel,
        fingerprint: creative.fingerprint,
        reviewedAt: creative.reviewedAt,
      },
      executionPlan: completionExecutionPlan,
    });
    let project = setInteractionState(
      withMemory(projectForTurn, request),
      actionMemory,
    );

    if (applyable.length > 0) {
      const batch = applyAllCreativeRecommendations({
        project,
        recommendations: applyable.slice(0, 8),
      });
      if (batch.ok && batch.status === "applied") {
        invalidateCritiquePipelineCache(
          creativeDirectorFingerprint(batch.project),
        );
        project = setInteractionState(
          batch.project,
          clearRecommendations(getActionMemory(batch.project)),
        );
        const strategyName =
          critiqueResult.strategy?.overallDirection ?? "the launch plan";
        return {
          ok: true,
          explanation: [
            critiqueResult.explanation
              .replace(/I’m applying the coordinated plan next\.?/i, "")
              .trim(),
            "",
            `Done. I applied the supported improvements from ${strategyName}.`,
            batch.explanation,
            supportPlan,
          ]
            .filter(Boolean)
            .join("\n"),
          operations: applyable.flatMap((r) => r.operations).slice(0, 32),
          changes: batch.changes,
          project,
          applyStatus: "applied",
          decision: {
            intent: "design_redesign",
            confidence: 0.95,
            selectedAgents: ["creative_director", "editor_agent"],
            needsClarification: false,
            shouldExecuteEdits: true,
            executionPlan:
              actionMemory.activePlan?.executionPlan ?? completionExecutionPlan,
            explanation: "I completed the website using a design strategy.",
            followUpSuggestions: followUpsForProject(project, [
              "Add matching images",
              "Improve SEO",
              "Review my website",
            ]),
          },
          followUpSuggestions: followUpsForProject(project, [
            "Add matching images",
            "Improve SEO",
            "Review my website",
          ]),
          executionPlan:
            actionMemory.activePlan?.executionPlan ?? completionExecutionPlan,
          atlasMemory: project.atlasMemory,
        };
      }
    }

    return {
      ok: true,
      explanation: [
        critiqueResult.explanation,
        "",
        supportPlan,
        "",
        applyable.length === 0
          ? "I’ve prepared the strategy — some items need uploads or aren’t available to apply yet."
          : "Say Apply All when you want me to make these changes.",
      ]
        .filter(Boolean)
        .join("\n"),
      operations: [],
      changes: [],
      project,
      applyStatus: "no_changes",
      decision: {
        intent: "recommend",
        confidence: 0.94,
        selectedAgents: ["creative_director"],
        needsClarification: false,
        executionPlan:
          actionMemory.activePlan?.executionPlan ?? completionExecutionPlan,
        explanation: "I prepared a strategy-led completion plan.",
        followUpSuggestions: followUpsForProject(project, [
          "Apply All",
          "Improve SEO",
          "Add subtle animations",
        ]),
      },
      followUpSuggestions: followUpsForProject(project, [
        "Apply All",
        "Improve SEO",
        "Add subtle animations",
      ]),
      executionPlan:
        actionMemory.activePlan?.executionPlan ?? completionExecutionPlan,
      atlasMemory: project.atlasMemory,
    };
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
    const supportPlan = formatRecommendationSupportPlan(
      critiqueResult.recommendations,
    );
    const applyable = critiqueResult.recommendations.filter((r) => r.applyable);
    const actionMemory = storeRecommendations(getActionMemory(projectForTurn), {
      creative: critiqueResult.recommendations,
      creativeReport: {
        overallCompleteness: creative.overallCompleteness,
        maturityLevel: creative.maturityLevel,
        fingerprint: creative.fingerprint,
        reviewedAt: creative.reviewedAt,
      },
      executionPlan: decision.executionPlan,
    });
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
            critiqueResult.explanation
              .replace(/I’m applying the coordinated plan next\.?/i, "")
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
      explanation: [critiqueResult.explanation, "", supportPlan]
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
        project = touchActiveTask(project, {
          kind: "hero_image_fit",
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
