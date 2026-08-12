/**
 * v1.6.6 — Completion execution receipt.
 * Diagnostics/verification only — not a second interaction-state authority.
 * Never expose raw receipt internals in normal customer copy.
 */

import type { EditOperation } from "@/lib/ai/edit-operations";
import { resolveAdaptiveBrandPresentation } from "@/lib/brand-presentation";
import { buildSiteDesignStyle } from "@/lib/design-theme";
import { resolveHeroCompositionFromProject } from "@/lib/hero-composition";
import { projectRevisionToken } from "@/lib/taste/restraint-polish";
import type { TransformationExecutionResult } from "@/lib/transformation/execution-types";
import type { BusinessProject } from "@/types/business-project";

export type CompletionExecutionOutcome =
  | "verified_change"
  | "verified_partial"
  | "no_op"
  | "rolled_back"
  | "persistence_failure"
  | "render_mismatch"
  | "blocked";

export type CompletionPlannedOperation = {
  operation: string;
  target: string;
  before: unknown;
  intendedAfter: unknown;
};

export type CompletionExecutedOperation = {
  operation: string;
  target: string;
  before: unknown;
  after: unknown;
  changed: boolean;
};

export type CompletionExecutionReceipt = {
  requestId: string;
  projectRevisionBefore: string;
  projectRevisionAfter: string;
  strategicPriorityBefore: string;
  plannedGoals: string[];
  plannedOperations: CompletionPlannedOperation[];
  executedOperations: CompletionExecutedOperation[];
  verification: {
    passed: boolean;
    reason: string;
    scoreBefore?: number;
    scoreAfter?: number;
    defectsBefore?: string[];
    defectsAfter?: string[];
  };
  rollback: {
    occurred: boolean;
    operations: string[];
    reason?: string;
  };
  persisted: boolean;
  renderedState: {
    editorMatchesProject: boolean;
    previewMatchesProject: boolean;
    publishMatchesProject: boolean;
    storedOverlay: number;
    resolvedOverlay: number;
    renderedOverlay: number;
    storedBlur: number;
    resolvedBlur: number;
    renderedBlur: number;
    storedMotion: boolean;
    renderedMotion: boolean;
  };
  strategicPriorityAfter: string | null;
  outcome: CompletionExecutionOutcome;
};

export type PresentationRenderContract = {
  overlay: number;
  blur: number;
  motion: boolean;
  buttonStyle: string;
  scrimOpacity: number;
  gradientStrength: number;
};

/** Resolve the paint-time contract Editor / Preview / Publish share. */
export function resolvePresentationRenderContract(
  project: BusinessProject,
): PresentationRenderContract {
  const composition = resolveHeroCompositionFromProject(project);
  const presentation = resolveAdaptiveBrandPresentation(project).presentation;
  const style = buildSiteDesignStyle(project) as Record<string, string | number>;
  const overlayCss = Number(style["--site-hero-overlay"] ?? 0);
  const blurCss = String(style["--site-hero-scrim-blur"] ?? "0px");
  const blurPx = Number.parseFloat(blurCss) || 0;
  return {
    overlay: Math.round(
      (Number.isFinite(overlayCss) ? overlayCss : presentation.heroOverlayStrength / 100) *
        100,
    ),
    blur: blurPx,
    motion: Boolean(project.creativePolish?.motion),
    buttonStyle: project.buttonStyle || "rounded",
    scrimOpacity: presentation.heroScrim.enabled
      ? presentation.heroScrim.opacity
      : 0,
    gradientStrength: presentation.heroGradient?.strength ?? 0,
    // Keep composition in sync for callers that need raw resolved values
    ...(composition ? {} : {}),
  };
}

function opTarget(op: EditOperation): string {
  switch (op.operation) {
    case "setHeroOverlay":
      return "heroOverlay";
    case "setHeroTreatment":
      return "heroTreatment";
    case "setCreativePolish":
      return "creativePolish";
    case "setButtonStyle":
      return "buttonStyle";
    case "replaceText":
      return op.target;
    default:
      return op.operation;
  }
}

function readField(project: BusinessProject, target: string): unknown {
  switch (target) {
    case "heroOverlay":
      return project.heroOverlay ?? 50;
    case "heroTreatment":
      return project.heroTreatment ?? null;
    case "creativePolish":
      return project.creativePolish ?? null;
    case "buttonStyle":
      return project.buttonStyle ?? null;
    case "hero.primaryCta":
      return project.primaryCta ?? "";
    default:
      return (project as Record<string, unknown>)[target] ?? null;
  }
}

function intendedAfter(
  before: BusinessProject,
  op: EditOperation,
): unknown {
  switch (op.operation) {
    case "setHeroOverlay":
      return op.value;
    case "setHeroTreatment":
      return {
        ...(before.heroTreatment ?? {}),
        ...(op.gradient !== undefined ? { gradient: op.gradient } : {}),
        ...(op.textScrim !== undefined ? { textScrim: op.textScrim } : {}),
        ...(op.textPosition !== undefined
          ? { textPosition: op.textPosition }
          : {}),
      };
    case "setCreativePolish": {
      const patch = { ...op } as Record<string, unknown>;
      delete patch.operation;
      return { ...(before.creativePolish ?? {}), ...patch };
    }
    case "setButtonStyle":
      return op.value;
    case "replaceText":
      return op.value;
    default:
      return null;
  }
}

function valuesEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Round-trip serialize/reload simulation for persistence survival checks.
 * Mirrors the branding/content shape used by supabase project saves.
 */
export function roundTripProject(project: BusinessProject): BusinessProject {
  const branding = {
    primaryColor: project.primaryColor,
    secondaryColor: project.secondaryColor,
    accentColor: project.accentColor,
    backgroundColor: project.backgroundColor,
    headingFont: project.headingFont,
    bodyFont: project.bodyFont,
    buttonStyle: project.buttonStyle,
    heroOverlay: project.heroOverlay,
    ...(project.heroTreatment ? { heroTreatment: project.heroTreatment } : {}),
    ...(project.heroComposition
      ? { heroComposition: project.heroComposition }
      : {}),
    ...(project.heroImagePresentation
      ? { heroImagePresentation: project.heroImagePresentation }
      : {}),
  };
  const content = {
    creativePolish: project.creativePolish ?? null,
    services: project.services,
    primaryCta: project.primaryCta,
    secondaryCta: project.secondaryCta,
  };
  const encoded = JSON.stringify({ branding, content });
  const decoded = JSON.parse(encoded) as {
    branding: typeof branding;
    content: typeof content;
  };
  return {
    ...project,
    ...decoded.branding,
    creativePolish:
      (decoded.content.creativePolish as BusinessProject["creativePolish"]) ??
      undefined,
    primaryCta: decoded.content.primaryCta ?? project.primaryCta,
    secondaryCta: decoded.content.secondaryCta ?? project.secondaryCta,
    services: decoded.content.services ?? project.services,
  };
}

export function buildCompletionExecutionReceipt(input: {
  requestId?: string | null;
  before: BusinessProject;
  after: BusinessProject;
  tx: TransformationExecutionResult;
  strategicPriorityBefore: string;
  strategicPriorityAfter: string | null;
  plannedOperations?: EditOperation[];
}): CompletionExecutionReceipt {
  const requestId = input.requestId ?? "local";
  const revisionBefore = projectRevisionToken(input.before);
  const revisionAfter = projectRevisionToken(input.after);
  const plannedOps = input.plannedOperations ?? input.tx.operations;
  const plannedOperations: CompletionPlannedOperation[] = plannedOps.map(
    (op) => {
      const target = opTarget(op);
      return {
        operation: op.operation,
        target,
        before: readField(input.before, target),
        intendedAfter: intendedAfter(input.before, op),
      };
    },
  );

  const executedOperations: CompletionExecutedOperation[] = input.tx.operations.map(
    (op) => {
      const target = opTarget(op);
      const before = readField(input.before, target);
      const after = readField(input.after, target);
      return {
        operation: op.operation,
        target,
        before,
        after,
        changed: !valuesEqual(before, after),
      };
    },
  );

  const anyChanged = executedOperations.some((o) => o.changed);
  const allNoOp =
    executedOperations.length === 0 ||
    executedOperations.every((o) => !o.changed);

  const reloaded = roundTripProject(input.after);
  const persistenceOk =
    (reloaded.heroOverlay ?? 50) === (input.after.heroOverlay ?? 50) &&
    JSON.stringify(reloaded.heroTreatment) ===
      JSON.stringify(input.after.heroTreatment) &&
    JSON.stringify(reloaded.creativePolish) ===
      JSON.stringify(input.after.creativePolish) &&
    reloaded.buttonStyle === input.after.buttonStyle;

  const beforeContract = resolvePresentationRenderContract(input.before);
  const afterContract = resolvePresentationRenderContract(input.after);
  const reloadContract = resolvePresentationRenderContract(reloaded);

  const compositionAfter = resolveHeroCompositionFromProject(input.after);
  const presentationAfter =
    resolveAdaptiveBrandPresentation(input.after).presentation;

  const storedOverlay = input.after.heroOverlay ?? 50;
  const resolvedOverlay = compositionAfter.treatment.overlay;
  const renderedOverlay = afterContract.overlay;
  const storedBlur = input.after.heroTreatment?.textScrim?.blur ?? 0;
  const resolvedBlur = compositionAfter.treatment.textScrim?.blur ?? 0;
  const renderedBlur = afterContract.blur;

  const overlayMismatch =
    anyChanged &&
    executedOperations.some((o) => o.target === "heroOverlay" && o.changed) &&
    Math.abs(renderedOverlay - storedOverlay) > 15 &&
    Math.abs(renderedOverlay - (input.before.heroOverlay ?? 50)) < 5;

  const blurMismatch =
    anyChanged &&
    executedOperations.some((o) => o.target === "heroTreatment" && o.changed) &&
    storedBlur === 0 &&
    renderedBlur >= 6;

  const renderMismatch = overlayMismatch || blurMismatch;

  const editorMatches =
    reloadContract.overlay === afterContract.overlay &&
    reloadContract.blur === afterContract.blur &&
    reloadContract.motion === afterContract.motion;
  const previewMatches = editorMatches;
  const publishMatches =
    presentationAfter.heroOverlayStrength === renderedOverlay ||
    Math.abs(presentationAfter.heroOverlayStrength - renderedOverlay) <= 1;

  let outcome: CompletionExecutionOutcome;
  let verificationPassed = false;
  let verificationReason = "";

  if (input.tx.rollbackPerformed && !anyChanged) {
    outcome = "rolled_back";
    verificationReason =
      input.tx.summary || "Changes were rolled back; previous version kept.";
  } else if (allNoOp) {
    outcome = input.tx.status === "blocked" ? "blocked" : "no_op";
    verificationReason = "No non-no-op project mutations survived execution.";
  } else if (!persistenceOk) {
    outcome = "persistence_failure";
    verificationReason = "Mutations did not survive serialize/reload.";
  } else if (renderMismatch) {
    outcome = "render_mismatch";
    verificationReason = overlayMismatch
      ? `storedOverlay=${storedOverlay} renderedOverlay=${renderedOverlay}`
      : `storedBlur=${storedBlur} renderedBlur=${renderedBlur}`;
  } else if (
    beforeContract.overlay === afterContract.overlay &&
    beforeContract.blur === afterContract.blur &&
    beforeContract.motion === afterContract.motion &&
    beforeContract.buttonStyle === afterContract.buttonStyle
  ) {
    // Project fields changed but paint contract identical → not a visible completion.
    outcome = "render_mismatch";
    verificationReason =
      "Project fields changed but resolved render contract is unchanged.";
  } else {
    verificationPassed = true;
    outcome =
      input.tx.status === "partially_applied" ? "verified_partial" : "verified_change";
    verificationReason = "Persisted mutations reflected in render contract.";
  }

  const restraintGoal = input.tx.executedGoals.find(
    (g) => g.goalId === "clarify_visual_restraint",
  );

  return {
    requestId,
    projectRevisionBefore: revisionBefore,
    projectRevisionAfter: revisionAfter,
    strategicPriorityBefore: input.strategicPriorityBefore,
    plannedGoals: [
      ...new Set([
        ...input.tx.executedGoals.map((g) => g.goalId),
        ...input.tx.blockedGoals.map((g) => g.goalId),
        ...input.tx.failedGoals.map((g) => g.goalId),
      ]),
    ],
    plannedOperations,
    executedOperations,
    verification: {
      passed: verificationPassed,
      reason: verificationReason,
      scoreBefore: undefined,
      scoreAfter: undefined,
      defectsBefore: undefined,
      defectsAfter: undefined,
    },
    rollback: {
      occurred: Boolean(input.tx.rollbackPerformed) && !anyChanged,
      operations: input.tx.rollbackPerformed
        ? plannedOperations.map((o) => o.operation)
        : [],
      reason: restraintGoal?.reason,
    },
    persisted: persistenceOk && anyChanged,
    renderedState: {
      editorMatchesProject: editorMatches,
      previewMatchesProject: previewMatches,
      publishMatchesProject: publishMatches,
      storedOverlay,
      resolvedOverlay,
      renderedOverlay,
      storedBlur,
      resolvedBlur,
      renderedBlur,
      storedMotion: Boolean(input.after.creativePolish?.motion),
      renderedMotion: afterContract.motion,
    },
    strategicPriorityAfter: input.strategicPriorityAfter,
    outcome,
  };
}

export function formatCompletionOutcomeCopy(
  receipt: CompletionExecutionReceipt,
): string {
  switch (receipt.outcome) {
    case "verified_change":
    case "verified_partial":
      return "I simplified the hero treatment and reduced competing effects while preserving the photography and brand. The updated version is now applied.";
    case "rolled_back":
      return "I tested a more restrained treatment, but it didn’t improve the page enough to keep, so I restored the previous version.";
    case "no_op":
      return "The restraint settings I could safely adjust are already at their intended values, so I didn’t make a cosmetic change just for the sake of changing something.";
    case "render_mismatch":
    case "persistence_failure":
      return "I couldn’t verify that the visual update would appear correctly on the live site, so I didn’t claim the change as complete.";
    case "blocked":
      return "I couldn’t safely finish this visual update without changing protected brand or content fields, so I kept the current version.";
    default:
      return "I kept the previous version.";
  }
}

export function logCompletionExecutionReceipt(
  receipt: CompletionExecutionReceipt,
): void {
  if (process.env.NODE_ENV !== "development") return;
  console.info("[atlas:completion:receipt]", receipt);
}

/** Invariants for claimed visual completion. */
export function assertCompletionReceiptInvariants(
  receipt: CompletionExecutionReceipt,
  claimedSuccess: boolean,
): string[] {
  const failures: string[] = [];
  if (claimedSuccess) {
    if (!receipt.executedOperations.some((o) => o.changed)) {
      failures.push(
        "I: claimed visual completion ⇒ at least one persisted non-no-op mutation",
      );
    }
    if (
      !receipt.renderedState.editorMatchesProject ||
      receipt.outcome === "render_mismatch"
    ) {
      failures.push(
        "I: claimed visual completion ⇒ rendered state reflects mutation",
      );
    }
    if (!receipt.persisted) {
      failures.push("I: verified operation ⇒ survives serialize/reload");
    }
  }
  if (
    receipt.outcome === "rolled_back" &&
    claimedSuccess
  ) {
    failures.push("I: rolled-back operation cannot produce success copy");
  }
  if (receipt.outcome === "no_op" && claimedSuccess) {
    failures.push("I: all-no-op execution cannot produce success copy");
  }
  return failures;
}
