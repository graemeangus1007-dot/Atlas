/**
 * Deterministic Taste → safe EditOperation polish plan.
 * Never rewrites brand, copy, section order, or layout family.
 */

import { HERO_OVERLAY_STEPS, type HeroOverlayStep } from "@/data/design-options";
import type { EditOperation } from "@/lib/ai/edit-operations";
import { validateEditOperations } from "@/lib/ai/validate-edit-operations";
import { assessTastePolishEligibility } from "@/lib/taste/polish-eligibility";
import { TASTE_POLISH_ALLOWED_ROOTS } from "@/lib/taste/polish-scope";
import {
  TASTE_POLISH_DIMENSIONS,
  TASTE_POLISH_VERSION,
  type TastePolishDimension,
  type TastePolishPlan,
} from "@/lib/taste/polish-types";
import { evaluateTaste } from "@/lib/taste/evaluation";
import { tasteDimensionLabel } from "@/lib/taste/registry";
import type { TasteEvaluation } from "@/lib/taste/types";
import type { CreativeDirectorEvaluation } from "@/lib/creative-director/types";
import type { BusinessProject } from "@/types/business-project";

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

function isPolishDimension(id: string): id is TastePolishDimension {
  return (TASTE_POLISH_DIMENSIONS as readonly string[]).includes(id);
}

function weakPolishDimensions(taste: TasteEvaluation): TastePolishDimension[] {
  return taste.dimensions
    .filter((d) => isPolishDimension(d.id) && d.score < 78)
    .sort((a, b) => a.score - b.score)
    .map((d) => d.id as TastePolishDimension)
    .slice(0, 4);
}

function alreadyLooksPolished(
  project: BusinessProject,
  taste: TasteEvaluation,
): boolean {
  const polish = project.creativePolish;
  const spacingOk =
    polish?.spacing === "comfortable" || polish?.spacing === "airy";
  const hierarchyOk = Boolean(polish?.visualHierarchy);
  const restraintOk =
    !polish?.motion &&
    !polish?.hoverEffects &&
    !polish?.sectionReveal &&
    (project.heroOverlay ?? 50) <= 50;
  // Finishing flags already consistent and taste is solid enough — no churn.
  if (spacingOk && hierarchyOk && restraintOk && taste.overallTaste >= 74) {
    return true;
  }
  const weak = weakPolishDimensions(taste);
  return spacingOk && hierarchyOk && restraintOk && weak.length === 0;
}

/**
 * Build one coordinated polish plan from the highest-priority taste gaps.
 */
export function planTastePolish(
  project: BusinessProject,
  tasteEvaluation?: TasteEvaluation | null,
  evaluation?: CreativeDirectorEvaluation | null,
): TastePolishPlan {
  const taste =
    tasteEvaluation ??
    evaluateTaste({
      project,
      evaluation: evaluation ?? null,
    });

  const eligibility = assessTastePolishEligibility({
    project,
    taste,
    evaluation,
  });

  if (!eligibility.allowed) {
    return {
      version: TASTE_POLISH_VERSION,
      baselineTaste: taste.overallTaste,
      targetDimensions: [],
      rationale: eligibility.reasons[0] ?? "Taste polish is not eligible yet.",
      operations: [],
      allowedMutationPaths: [...TASTE_POLISH_ALLOWED_ROOTS],
      expectedDelta: 0,
      confidence: 0.9,
      alreadyPolished: false,
      ineligibleReason: eligibility.reasons.join(" "),
    };
  }

  if (alreadyLooksPolished(project, taste)) {
    return {
      version: TASTE_POLISH_VERSION,
      baselineTaste: taste.overallTaste,
      targetDimensions: [],
      rationale:
        "The site’s visual polish is already consistent; I didn’t add unnecessary styling.",
      operations: [],
      allowedMutationPaths: [...TASTE_POLISH_ALLOWED_ROOTS],
      expectedDelta: 0,
      confidence: 0.95,
      alreadyPolished: true,
      ineligibleReason: null,
    };
  }

  let targets = weakPolishDimensions(taste);
  if (
    taste.highestPriorityImprovement &&
    isPolishDimension(taste.highestPriorityImprovement) &&
    !targets.includes(taste.highestPriorityImprovement)
  ) {
    targets = [taste.highestPriorityImprovement, ...targets].slice(0, 4);
  }
  if (targets.length === 0) {
    // Eligible but no weak polish dims — treat as already polished.
    return {
      version: TASTE_POLISH_VERSION,
      baselineTaste: taste.overallTaste,
      targetDimensions: [],
      rationale:
        "The site’s visual polish is already consistent; I didn’t add unnecessary styling.",
      operations: [],
      allowedMutationPaths: [...TASTE_POLISH_ALLOWED_ROOTS],
      expectedDelta: 0,
      confidence: 0.92,
      alreadyPolished: true,
      ineligibleReason: null,
    };
  }

  const ops: EditOperation[] = [];
  const polishPatch: Extract<
    EditOperation,
    { operation: "setCreativePolish" }
  > = { operation: "setCreativePolish" };
  let needPolish = false;

  const needsSpacing = targets.some(
    (t) =>
      t === "spacingHarmony" ||
      t === "visualRhythm" ||
      t === "scanability",
  );
  const needsHierarchy = targets.some(
    (t) =>
      t === "typographyHarmony" ||
      t === "ctaPresence" ||
      t === "visualWeight" ||
      t === "scanability" ||
      t === "proportion",
  );
  const needsRestraint = targets.some(
    (t) => t === "restraint" || t === "visualWeight" || t === "componentConsistency",
  );
  const needsAlignment = targets.includes("alignmentQuality");
  const needsCta = targets.some(
    (t) => t === "ctaPresence" || t === "proportion",
  );

  if (needsSpacing) {
    const current = project.creativePolish?.spacing ?? "default";
    polishPatch.spacing =
      current === "airy" ? "airy" : current === "comfortable" ? "airy" : "comfortable";
    needPolish = true;
  }

  if (needsHierarchy) {
    polishPatch.visualHierarchy = true;
    needPolish = true;
  }

  if (needsRestraint) {
    polishPatch.motion = false;
    polishPatch.motionPreset = "none";
    polishPatch.hoverEffects = false;
    polishPatch.sectionReveal = false;
    polishPatch.respectReducedMotion = true;
    needPolish = true;
  }

  if (needPolish) {
    ops.push(polishPatch);
  }

  // Overlay / treatment restraint — hero-local only.
  if (needsRestraint || targets.includes("visualWeight")) {
    const overlay = project.heroOverlay ?? 50;
    if (overlay >= 50) {
      ops.push({
        operation: "setHeroOverlay",
        value: snapOverlay(Math.min(overlay, 25)),
      });
    }
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
    }
  }

  // Alignment / CTA cluster — normalize text position + button silhouette.
  if (needsAlignment || needsCta) {
    const pos = project.heroTreatment?.textPosition;
    if (!pos) {
      ops.push({
        operation: "setHeroTreatment",
        gradient: project.heroTreatment?.gradient ?? undefined,
        textScrim: project.heroTreatment?.textScrim ?? undefined,
        textPosition: "left",
      });
    }
    if (project.buttonStyle === "square" || !project.buttonStyle) {
      ops.push({
        operation: "setButtonStyle",
        value: "rounded",
      });
    }
  }

  if (targets.includes("componentConsistency") && project.buttonStyle === "square") {
    if (!ops.some((o) => o.operation === "setButtonStyle")) {
      ops.push({ operation: "setButtonStyle", value: "rounded" });
    }
  }

  let operations: EditOperation[] = [];
  try {
    operations = ops.length > 0 ? validateEditOperations(ops) : [];
  } catch {
    operations = [];
  }

  const labels = targets.map((t) => tasteDimensionLabel(t).toLowerCase());
  const rationale =
    operations.length > 0
      ? `I’ll apply one coordinated polish pass focused on ${labels.slice(0, 3).join(", ")} — without changing brand, content, or structure.`
      : "No safe polish operations were available for the current taste gaps.";

  return {
    version: TASTE_POLISH_VERSION,
    baselineTaste: taste.overallTaste,
    targetDimensions: targets,
    rationale,
    operations,
    allowedMutationPaths: [...TASTE_POLISH_ALLOWED_ROOTS],
    expectedDelta: Math.min(12, 4 + targets.length * 2),
    confidence: Math.min(0.96, 0.82 + targets.length * 0.03),
    alreadyPolished: false,
    ineligibleReason: null,
  };
}
