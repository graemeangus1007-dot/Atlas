/**
 * Visual restraint polish — close the diagnose → execute → verify loop.
 * Concrete defects → smallest allowlisted mutations → reevaluate → keep or rollback.
 * Does not redesign the site or change brand/content/assets.
 */

import { HERO_OVERLAY_STEPS, type HeroOverlayStep } from "@/data/design-options";
import type { EditOperation } from "@/lib/ai/edit-operations";
import { applyEditOperations } from "@/lib/ai/apply-edit-operations";
import { createRevisionId } from "@/lib/ai/editor-revisions";
import { validateEditOperations } from "@/lib/ai/validate-edit-operations";
import {
  analyzeProjectVisualComposition,
  evaluateVisualComposition,
  scorePhotographyPreservation,
} from "@/lib/composition";
import { resolveHeroCompositionFromProject } from "@/lib/hero-composition";
import { collectTasteSignals, evaluateTaste } from "@/lib/taste/evaluation";
import { scoreRestraint } from "@/lib/taste/restraint";
import type { TasteEvaluation, TasteSignals } from "@/lib/taste/types";
import type { BusinessProject } from "@/types/business-project";

export const RESTRAINT_POLISH_VERSION = "1.0.0";

export type RestraintDefect =
  | "excessive_hero_overlay"
  | "hero_blur"
  | "competing_gradients"
  | "too_many_accent_treatments"
  | "excessive_motion"
  | "weak_visual_priority"
  | "cta_competition"
  | "inconsistent_button_treatment"
  | "overdecorated_sections"
  | "excessive_effect_density";

export type RestraintPolishPlan = {
  defects: RestraintDefect[];
  operations: EditOperation[];
  expectedImprovements: string[];
  preservedDomains: string[];
  confidence: number;
  alreadyRestrained: boolean;
  blockedReason: string | null;
};

export type RestraintVerification = {
  scoreBefore: number;
  scoreAfter: number;
  defectsBefore: RestraintDefect[];
  defectsAfter: RestraintDefect[];
  resolvedDefects: RestraintDefect[];
  remainingDefects: RestraintDefect[];
  photographyPreservationBefore: number;
  photographyPreservationAfter: number;
  readabilityBefore: number;
  readabilityAfter: number;
  brandPreserved: boolean;
  scopePreserved: boolean;
  materiallyImproved: boolean;
};

export type RestraintPolishVerdict =
  | "applied"
  | "already_restrained"
  | "no_gain"
  | "rolled_back"
  | "blocked"
  | "no_operations";

export type RestraintPolishResult = {
  version: string;
  verdict: RestraintPolishVerdict;
  applied: boolean;
  project: BusinessProject;
  plan: RestraintPolishPlan | null;
  operations: EditOperation[];
  verification: RestraintVerification | null;
  explanation: string;
  rollbackPerformed: boolean;
  revisionId: string | null;
  keptOperations: EditOperation[];
  rolledBackOperations: EditOperation[];
  diagnostics: RestraintPolishDiagnostics;
};

export type RestraintPolishDiagnostics = {
  restraintDefectsBefore: RestraintDefect[];
  restraintPlan: RestraintPolishPlan | null;
  restraintOperations: string[];
  actualMutationDomains: string[];
  restraintScoreBefore: number;
  restraintScoreAfter: number;
  resolvedDefects: RestraintDefect[];
  remainingDefects: RestraintDefect[];
  photographyPreservationBefore: number;
  photographyPreservationAfter: number;
  readabilityBefore: number;
  readabilityAfter: number;
  projectRevisionBefore: string;
  projectRevisionAfter: string;
  strategicAssessmentRevision: string | null;
  keptOperations: string[];
  rolledBackOperations: string[];
  finalStrategicPriority: string | null;
  verified: boolean;
};

const PRESERVED_DOMAINS = [
  "brand_palette",
  "fonts",
  "business_facts",
  "hero_asset",
  "gallery_assets",
  "section_order",
  "services",
  "testimonials",
  "contact_information",
  "seo",
  "cta_wording",
] as const;

const ALLOWED_MUTATION_ROOTS = new Set([
  "heroOverlay",
  "heroTreatment",
  "creativePolish",
  "buttonStyle",
  "atlasActionMemory",
  "atlasMemory",
  "designAssistant",
]);

function cloneProject(project: BusinessProject): BusinessProject {
  return JSON.parse(JSON.stringify(project)) as BusinessProject;
}

function snapOverlay(value: number): HeroOverlayStep {
  let best: HeroOverlayStep = HERO_OVERLAY_STEPS[0]!;
  let bestDist = Infinity;
  for (const step of HERO_OVERLAY_STEPS) {
    const dist = Math.abs(step - value);
    if (dist < bestDist) {
      best = step;
      bestDist = dist;
    }
  }
  return best;
}

function effectStack(signals: TasteSignals): number {
  let stack = 0;
  if (signals.motionEnabled) stack += 1;
  if (signals.hoverEffects) stack += 1;
  if (signals.sectionReveal) stack += 1;
  if (signals.heroScrimBlur >= 6) stack += 1;
  if (signals.heroOverlay >= 60) stack += 1;
  if (signals.hasHeroTreatmentGradient && signals.heroOverlay >= 50) stack += 1;
  return stack;
}

export function projectRevisionToken(project: BusinessProject): string {
  const key = [
    project.heroOverlay ?? 50,
    project.heroTreatment?.textScrim?.blur ?? 0,
    project.heroTreatment?.textScrim?.opacity ?? 0,
    Boolean(project.heroTreatment?.gradient),
    project.creativePolish?.motion ? 1 : 0,
    project.creativePolish?.hoverEffects ? 1 : 0,
    project.creativePolish?.sectionReveal ? 1 : 0,
    project.creativePolish?.visualHierarchy ? 1 : 0,
    project.buttonStyle ?? "",
    project.primaryCta ?? "",
    project.heroImageId ?? "",
    project.primaryColor ?? "",
    project.status ?? "",
  ].join("|");
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  return `rev-${hash.toString(16).padStart(8, "0")}`;
}

export function detectRestraintDefects(
  project: BusinessProject,
  signals?: TasteSignals,
): RestraintDefect[] {
  const s = signals ?? collectTasteSignals({ project });
  const defects: RestraintDefect[] = [];
  const stack = effectStack(s);

  if (s.heroOverlay >= 60) defects.push("excessive_hero_overlay");
  if (s.heroScrimBlur >= 6) defects.push("hero_blur");
  if (s.hasHeroTreatmentGradient && s.heroOverlay >= 50) {
    defects.push("competing_gradients");
  }
  if (s.distinctBrandColors >= 4) defects.push("too_many_accent_treatments");

  const motionCount =
    Number(s.motionEnabled) + Number(s.hoverEffects) + Number(s.sectionReveal);
  if (motionCount >= 2) defects.push("excessive_motion");

  if (!s.visualHierarchy && (s.hasSecondaryCta || s.motionEnabled)) {
    defects.push("weak_visual_priority");
  }
  if (s.hasSecondaryCta && (!s.visualHierarchy || s.motionEnabled)) {
    defects.push("cta_competition");
  }
  if (s.buttonStyle === "square" || !s.buttonStyle) {
    defects.push("inconsistent_button_treatment");
  }
  if (s.serviceIcons && motionCount >= 2) {
    defects.push("overdecorated_sections");
  }
  if (stack >= 3) defects.push("excessive_effect_density");

  return [...new Set(defects)];
}

function photographyAndReadability(project: BusinessProject): {
  photography: number;
  readability: number;
} {
  const composition = resolveHeroCompositionFromProject(project);
  const visual = analyzeProjectVisualComposition({ project, composition });
  const photo = scorePhotographyPreservation({ visual, composition });
  const evaluation = evaluateVisualComposition({ visual, composition });
  return {
    photography: photo.overall,
    readability: evaluation.textRelationship,
  };
}

function restraintScoreFor(project: BusinessProject): {
  score: number;
  signals: TasteSignals;
  taste: TasteEvaluation;
} {
  const taste = evaluateTaste({ project });
  const signals = collectTasteSignals({ project });
  return {
    score: scoreRestraint(signals).score,
    signals,
    taste,
  };
}

function brandPreserved(before: BusinessProject, after: BusinessProject): boolean {
  return (
    before.primaryColor === after.primaryColor &&
    before.secondaryColor === after.secondaryColor &&
    before.accentColor === after.accentColor &&
    before.backgroundColor === after.backgroundColor &&
    before.headingFont === after.headingFont &&
    before.bodyFont === after.bodyFont &&
    before.heroImageId === after.heroImageId &&
    JSON.stringify(before.galleryImageIds ?? []) ===
      JSON.stringify(after.galleryImageIds ?? []) &&
    before.primaryCta === after.primaryCta &&
    before.heroHeadline === after.heroHeadline &&
    before.businessName === after.businessName
  );
}

function scopePreserved(before: BusinessProject, after: BusinessProject): boolean {
  const beforeKeys = Object.keys(before) as Array<keyof BusinessProject>;
  for (const key of beforeKeys) {
    if (ALLOWED_MUTATION_ROOTS.has(String(key))) continue;
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
      return false;
    }
  }
  return (
    JSON.stringify(before.sectionOrder ?? []) ===
      JSON.stringify(after.sectionOrder ?? []) &&
    JSON.stringify(before.services ?? []) === JSON.stringify(after.services ?? [])
  );
}

function mutationDomains(
  before: BusinessProject,
  after: BusinessProject,
): string[] {
  const domains: string[] = [];
  if ((before.heroOverlay ?? 50) !== (after.heroOverlay ?? 50)) {
    domains.push("heroOverlay");
  }
  if (JSON.stringify(before.heroTreatment) !== JSON.stringify(after.heroTreatment)) {
    domains.push("heroTreatment");
  }
  if (
    JSON.stringify(before.creativePolish) !== JSON.stringify(after.creativePolish)
  ) {
    domains.push("creativePolish");
  }
  if (before.buttonStyle !== after.buttonStyle) domains.push("buttonStyle");
  return domains;
}

/**
 * Build the smallest useful restraint polish plan from observed defects.
 */
export function planRestraintPolish(input: {
  project: BusinessProject;
}): RestraintPolishPlan {
  const { score, signals } = restraintScoreFor(input.project);
  const defects = detectRestraintDefects(input.project, signals);
  const executable = defects.filter((d) => d !== "too_many_accent_treatments");

  if (executable.length === 0 && score >= 74) {
    return {
      defects,
      operations: [],
      expectedImprovements: [],
      preservedDomains: [...PRESERVED_DOMAINS],
      confidence: 0.95,
      alreadyRestrained: true,
      blockedReason: null,
    };
  }

  if (executable.length === 0 && defects.includes("too_many_accent_treatments")) {
    return {
      defects,
      operations: [],
      expectedImprovements: [],
      preservedDomains: [...PRESERVED_DOMAINS],
      confidence: 0.9,
      alreadyRestrained: false,
      blockedReason:
        "Accent competition comes from the brand palette, which restraint polish must not change.",
    };
  }

  const ops: EditOperation[] = [];
  const expected: string[] = [];
  const project = input.project;
  const polishPatch: Extract<
    EditOperation,
    { operation: "setCreativePolish" }
  > = { operation: "setCreativePolish" };
  let needPolish = false;

  const needsMotionQuiet =
    executable.includes("excessive_motion") ||
    executable.includes("excessive_effect_density") ||
    executable.includes("overdecorated_sections");

  if (needsMotionQuiet) {
    polishPatch.motion = false;
    polishPatch.motionPreset = "none";
    polishPatch.hoverEffects = false;
    polishPatch.sectionReveal = false;
    polishPatch.respectReducedMotion = true;
    needPolish = true;
    expected.push("Reduce unnecessary motion and effect stacking");
  }

  if (
    executable.includes("weak_visual_priority") ||
    executable.includes("cta_competition")
  ) {
    polishPatch.visualHierarchy = true;
    needPolish = true;
    expected.push("Restore a clearer primary/secondary visual hierarchy");
  }

  if (needPolish) ops.push(polishPatch);

  if (
    executable.includes("excessive_hero_overlay") ||
    executable.includes("competing_gradients") ||
    executable.includes("excessive_effect_density")
  ) {
    const overlay = project.heroOverlay ?? 50;
    if (overlay >= 50) {
      const next = snapOverlay(Math.min(overlay, 25));
      if (next !== overlay) {
        ops.push({ operation: "setHeroOverlay", value: next });
        expected.push("Soften the competing hero wash");
      }
    }
  }

  if (
    executable.includes("hero_blur") ||
    (executable.includes("competing_gradients") &&
      (project.heroTreatment?.textScrim?.blur ?? 0) >= 6)
  ) {
    const scrim = project.heroTreatment?.textScrim;
    if (scrim?.blur && scrim.blur >= 6) {
      ops.push({
        operation: "setHeroTreatment",
        gradient: project.heroTreatment?.gradient ?? null,
        textScrim: {
          enabled: scrim.enabled ?? true,
          opacity: Math.min(0.22, scrim.opacity ?? 0.2),
          blur: 0,
        },
        textPosition: project.heroTreatment?.textPosition,
      });
      expected.push("Remove unnecessary hero blur while keeping text readable");
    }
  }

  if (executable.includes("inconsistent_button_treatment")) {
    if (project.buttonStyle === "square" || !project.buttonStyle) {
      ops.push({ operation: "setButtonStyle", value: "rounded" });
      expected.push("Unify button treatment so CTAs don’t compete visually");
    }
  }

  let operations: EditOperation[] = [];
  try {
    operations = ops.length > 0 ? validateEditOperations(ops) : [];
  } catch {
    operations = [];
  }

  if (operations.length === 0) {
    return {
      defects,
      operations: [],
      expectedImprovements: [],
      preservedDomains: [...PRESERVED_DOMAINS],
      confidence: 0.7,
      alreadyRestrained: executable.length === 0,
      blockedReason:
        executable.length > 0
          ? "No safe restraint mutation was available for the observed defects."
          : null,
    };
  }

  return {
    defects,
    operations,
    expectedImprovements: [...new Set(expected)],
    preservedDomains: [...PRESERVED_DOMAINS],
    confidence: Math.min(0.96, 0.78 + executable.length * 0.03),
    alreadyRestrained: false,
    blockedReason: null,
  };
}

export function verifyRestraintPolish(input: {
  before: BusinessProject;
  after: BusinessProject;
  plan: RestraintPolishPlan;
}): RestraintVerification {
  const before = restraintScoreFor(input.before);
  const after = restraintScoreFor(input.after);
  const defectsBefore = detectRestraintDefects(input.before, before.signals);
  const defectsAfter = detectRestraintDefects(input.after, after.signals);
  const resolvedDefects = defectsBefore.filter((d) => !defectsAfter.includes(d));
  const remainingDefects = defectsAfter;
  const photoReadBefore = photographyAndReadability(input.before);
  const photoReadAfter = photographyAndReadability(input.after);
  const brandOk = brandPreserved(input.before, input.after);
  const scopeOk = scopePreserved(input.before, input.after);

  const scoreImproved = after.score >= before.score + 2;
  const defectReduced = resolvedDefects.length > 0;
  const photoOk =
    photoReadAfter.photography + 1 >= photoReadBefore.photography;
  const readOk = photoReadAfter.readability + 1 >= photoReadBefore.readability;
  const photoRegression =
    photoReadAfter.photography + 4 < photoReadBefore.photography;
  const readRegression =
    photoReadAfter.readability + 4 < photoReadBefore.readability;

  const materiallyImproved =
    brandOk &&
    scopeOk &&
    !photoRegression &&
    !readRegression &&
    photoOk &&
    readOk &&
    (scoreImproved || defectReduced) &&
    after.score >= before.score;

  return {
    scoreBefore: before.score,
    scoreAfter: after.score,
    defectsBefore,
    defectsAfter,
    resolvedDefects,
    remainingDefects,
    photographyPreservationBefore: photoReadBefore.photography,
    photographyPreservationAfter: photoReadAfter.photography,
    readabilityBefore: photoReadBefore.readability,
    readabilityAfter: photoReadAfter.readability,
    brandPreserved: brandOk,
    scopePreserved: scopeOk,
    materiallyImproved,
  };
}

export function formatRestraintExecutionCopy(input: {
  verification: RestraintVerification | null;
  verdict: RestraintPolishVerdict;
}): string {
  if (input.verdict === "already_restrained") {
    return "The visual treatment is already restrained, so I kept the current version.";
  }
  if (
    input.verdict === "no_gain" ||
    input.verdict === "rolled_back" ||
    !input.verification?.materiallyImproved
  ) {
    return "I tested a more restrained treatment, but it didn’t improve the page enough to justify the change, so I kept the previous version.";
  }
  if (input.verification.remainingDefects.length === 0) {
    return "I simplified the competing visual treatments in the hero and reduced unnecessary effects while keeping the photography, brand, and content intact. The page now has a clearer visual focus.";
  }
  return "I simplified the hero treatment and kept the improvement. Visual focus is better, but one competing treatment remains the largest polish opportunity.";
}

export function logRestraintPolishDiagnostics(
  diag: RestraintPolishDiagnostics,
  requestId?: string | null,
): void {
  if (process.env.NODE_ENV !== "development") return;
  console.info("[atlas:taste:restraint-polish]", {
    requestId: requestId ?? null,
    ...diag,
  });
}

/**
 * Apply one guarded restraint polish pass with keep-better / rollback.
 */
export function executeRestraintPolish(input: {
  project: BusinessProject;
  requestId?: string | null;
  logDiagnostics?: boolean;
  strategicAssessmentRevision?: string | null;
}): RestraintPolishResult {
  const baseline = cloneProject(input.project);
  const revisionBefore = projectRevisionToken(baseline);
  const plan = planRestraintPolish({ project: baseline });
  const beforeMetrics = restraintScoreFor(baseline);
  const photoReadBefore = photographyAndReadability(baseline);

  const emptyDiagnostics = (
    verdict: RestraintPolishVerdict,
    verified: boolean,
  ): RestraintPolishDiagnostics => ({
    restraintDefectsBefore: plan.defects,
    restraintPlan: plan,
    restraintOperations: plan.operations.map((o) => o.operation),
    actualMutationDomains: [],
    restraintScoreBefore: beforeMetrics.score,
    restraintScoreAfter: beforeMetrics.score,
    resolvedDefects: [],
    remainingDefects: plan.defects,
    photographyPreservationBefore: photoReadBefore.photography,
    photographyPreservationAfter: photoReadBefore.photography,
    readabilityBefore: photoReadBefore.readability,
    readabilityAfter: photoReadBefore.readability,
    projectRevisionBefore: revisionBefore,
    projectRevisionAfter: revisionBefore,
    strategicAssessmentRevision: input.strategicAssessmentRevision ?? null,
    keptOperations: [],
    rolledBackOperations: plan.operations.map((o) => o.operation),
    finalStrategicPriority: null,
    verified,
  });

  if (plan.alreadyRestrained) {
    const result: RestraintPolishResult = {
      version: RESTRAINT_POLISH_VERSION,
      verdict: "already_restrained",
      applied: false,
      project: baseline,
      plan,
      operations: [],
      verification: null,
      explanation: formatRestraintExecutionCopy({
        verification: null,
        verdict: "already_restrained",
      }),
      rollbackPerformed: false,
      revisionId: null,
      keptOperations: [],
      rolledBackOperations: [],
      diagnostics: emptyDiagnostics("already_restrained", true),
    };
    if (input.logDiagnostics) {
      logRestraintPolishDiagnostics(result.diagnostics, input.requestId);
    }
    return result;
  }

  if (plan.blockedReason) {
    const result: RestraintPolishResult = {
      version: RESTRAINT_POLISH_VERSION,
      verdict: "blocked",
      applied: false,
      project: baseline,
      plan,
      operations: [],
      verification: null,
      explanation:
        "I couldn’t safely improve visual focus without changing the brand palette or other protected parts of the site, so I kept the current version.",
      rollbackPerformed: false,
      revisionId: null,
      keptOperations: [],
      rolledBackOperations: [],
      diagnostics: emptyDiagnostics("blocked", false),
    };
    if (input.logDiagnostics) {
      logRestraintPolishDiagnostics(result.diagnostics, input.requestId);
    }
    return result;
  }

  if (plan.operations.length === 0) {
    const result: RestraintPolishResult = {
      version: RESTRAINT_POLISH_VERSION,
      verdict: "no_operations",
      applied: false,
      project: baseline,
      plan,
      operations: [],
      verification: null,
      explanation:
        "I couldn’t find a safe restraint change that would improve focus without redesigning the site.",
      rollbackPerformed: false,
      revisionId: null,
      keptOperations: [],
      rolledBackOperations: [],
      diagnostics: emptyDiagnostics("no_operations", false),
    };
    if (input.logDiagnostics) {
      logRestraintPolishDiagnostics(result.diagnostics, input.requestId);
    }
    return result;
  }

  let appliedProject: BusinessProject;
  try {
    appliedProject = applyEditOperations(
      baseline,
      validateEditOperations(plan.operations),
    ).project;
  } catch {
    const result: RestraintPolishResult = {
      version: RESTRAINT_POLISH_VERSION,
      verdict: "blocked",
      applied: false,
      project: baseline,
      plan,
      operations: [],
      verification: null,
      explanation:
        "I couldn’t safely apply a more restrained treatment, so I kept the current version.",
      rollbackPerformed: false,
      revisionId: null,
      keptOperations: [],
      rolledBackOperations: plan.operations,
      diagnostics: emptyDiagnostics("blocked", false),
    };
    if (input.logDiagnostics) {
      logRestraintPolishDiagnostics(result.diagnostics, input.requestId);
    }
    return result;
  }

  const verification = verifyRestraintPolish({
    before: baseline,
    after: appliedProject,
    plan,
  });
  const domains = mutationDomains(baseline, appliedProject);
  const revisionAfter = projectRevisionToken(appliedProject);

  if (!verification.materiallyImproved) {
    const verdict: RestraintPolishVerdict =
      !verification.brandPreserved ||
      !verification.scopePreserved ||
      verification.photographyPreservationAfter + 4 <
        verification.photographyPreservationBefore ||
      verification.readabilityAfter + 4 < verification.readabilityBefore
        ? "rolled_back"
        : "no_gain";
    const diagnostics: RestraintPolishDiagnostics = {
      restraintDefectsBefore: verification.defectsBefore,
      restraintPlan: plan,
      restraintOperations: plan.operations.map((o) => o.operation),
      actualMutationDomains: domains,
      restraintScoreBefore: verification.scoreBefore,
      restraintScoreAfter: verification.scoreBefore,
      resolvedDefects: [],
      remainingDefects: verification.defectsBefore,
      photographyPreservationBefore: verification.photographyPreservationBefore,
      photographyPreservationAfter: verification.photographyPreservationBefore,
      readabilityBefore: verification.readabilityBefore,
      readabilityAfter: verification.readabilityBefore,
      projectRevisionBefore: revisionBefore,
      projectRevisionAfter: revisionBefore,
      strategicAssessmentRevision: input.strategicAssessmentRevision ?? null,
      keptOperations: [],
      rolledBackOperations: plan.operations.map((o) => o.operation),
      finalStrategicPriority: null,
      verified: false,
    };
    const result: RestraintPolishResult = {
      version: RESTRAINT_POLISH_VERSION,
      verdict,
      applied: false,
      project: baseline,
      plan,
      operations: [],
      verification: { ...verification, materiallyImproved: false },
      explanation: formatRestraintExecutionCopy({
        verification,
        verdict,
      }),
      rollbackPerformed: true,
      revisionId: null,
      keptOperations: [],
      rolledBackOperations: plan.operations,
      diagnostics,
    };
    if (input.logDiagnostics) {
      logRestraintPolishDiagnostics(diagnostics, input.requestId);
    }
    return result;
  }

  const diagnostics: RestraintPolishDiagnostics = {
    restraintDefectsBefore: verification.defectsBefore,
    restraintPlan: plan,
    restraintOperations: plan.operations.map((o) => o.operation),
    actualMutationDomains: domains,
    restraintScoreBefore: verification.scoreBefore,
    restraintScoreAfter: verification.scoreAfter,
    resolvedDefects: verification.resolvedDefects,
    remainingDefects: verification.remainingDefects,
    photographyPreservationBefore: verification.photographyPreservationBefore,
    photographyPreservationAfter: verification.photographyPreservationAfter,
    readabilityBefore: verification.readabilityBefore,
    readabilityAfter: verification.readabilityAfter,
    projectRevisionBefore: revisionBefore,
    projectRevisionAfter: revisionAfter,
    strategicAssessmentRevision: input.strategicAssessmentRevision ?? null,
    keptOperations: plan.operations.map((o) => o.operation),
    rolledBackOperations: [],
    finalStrategicPriority: null,
    verified: true,
  };

  const result: RestraintPolishResult = {
    version: RESTRAINT_POLISH_VERSION,
    verdict: "applied",
    applied: true,
    project: appliedProject,
    plan,
    operations: plan.operations,
    verification,
    explanation: formatRestraintExecutionCopy({
      verification,
      verdict: "applied",
    }),
    rollbackPerformed: false,
    revisionId: createRevisionId(),
    keptOperations: plan.operations,
    rolledBackOperations: [],
    diagnostics,
  };
  if (input.logDiagnostics) {
    logRestraintPolishDiagnostics(diagnostics, input.requestId);
  }
  return result;
}

/** True when the site has restraint defects worth a polish pass. */
export function needsRestraintPolish(project: BusinessProject): boolean {
  const { score, signals } = restraintScoreFor(project);
  const defects = detectRestraintDefects(project, signals).filter(
    (d) => d !== "too_many_accent_treatments",
  );
  return defects.length > 0 && score < 78;
}
