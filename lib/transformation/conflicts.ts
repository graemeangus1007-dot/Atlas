/**
 * Detect conflicting transformation intents — never silently ignore.
 */

import type { DesignStrategy } from "@/lib/ai/design-strategy-types";
import type { CreativeDirectorEvaluation } from "@/lib/creative-director";
import { detectDependencyCycle } from "@/lib/transformation/dependencies";
import type {
  TransformationConflict,
  TransformationDependency,
  TransformationGoal,
  WebsiteVision,
} from "@/lib/transformation/types";

export function detectTransformationConflicts(input: {
  goals: TransformationGoal[];
  dependencies: TransformationDependency[];
  vision: WebsiteVision;
  strategy: DesignStrategy;
  evaluation?: CreativeDirectorEvaluation | null;
}): TransformationConflict[] {
  const conflicts: TransformationConflict[] = [];
  const ids = new Set(input.goals.map((g) => g.id));

  if (detectDependencyCycle(input.goals, input.dependencies)) {
    conflicts.push({
      kind: "dependency_cycle",
      severity: "high",
      goalIds: input.goals.map((g) => g.id),
      explanation:
        "The transformation graph contains a dependency cycle and cannot be ordered safely.",
      resolution:
        "Remove or reverse one dependency edge so foundation work precedes conversion work.",
    });
  }

  // Premature conversion: CTA goal without trust/proof goals when trust is weak
  if (
    ids.has("simplify_conversion") &&
    input.evaluation &&
    input.evaluation.trust.score < 55 &&
    !ids.has("establish_trust") &&
    !ids.has("strengthen_proof") &&
    !ids.has("sequence_proof_before_ask")
  ) {
    conflicts.push({
      kind: "premature_conversion",
      severity: "high",
      goalIds: ["simplify_conversion"],
      explanation:
        "The plan strengthens conversion before building trust — visitors would still lack evidence.",
      resolution:
        "Add trust/proof goals and keep conversion after proof-before-ask sequencing.",
    });
  }

  // Tone clash: luxury/premium vision vs playful conversion language in strategy
  const luxury = input.vision.agencyTones.some((t) =>
    ["luxury", "premium", "timeless", "editorial"].includes(t),
  );
  const playfulAsk = /playful|bright|fun|emoji|wow/i.test(
    [
      input.strategy.desiredEmotion,
      input.strategy.overallDirection,
      ...input.strategy.designGoals,
    ].join(" "),
  );
  if (luxury && playfulAsk && ids.has("simplify_conversion")) {
    conflicts.push({
      kind: "tone_clash",
      severity: "medium",
      goalIds: ["set_page_direction", "simplify_conversion"],
      explanation:
        "A luxury redesign conflicts with a bright playful conversion tone.",
      resolution:
        "Keep conversion wording calm, confident, and premium — not playful.",
    });
  }

  // Direction mismatch: pattern explanation vs vision
  const patternText = input.strategy.patternComposition?.explanation ?? "";
  if (
    luxury &&
    /playful|bold\s+and\s+loud|neon/i.test(patternText) &&
    ids.has("set_page_direction")
  ) {
    conflicts.push({
      kind: "direction_mismatch",
      severity: "medium",
      goalIds: ["set_page_direction"],
      explanation:
        "Selected composition direction fights the luxury/premium vision.",
      resolution:
        "Prefer a calmer premium composition that matches the vision personality.",
    });
  }

  // Opposing section intents in goal set (proof add vs messaging that removes proof)
  if (
    ids.has("strengthen_proof") &&
    ids.has("tighten_messaging") &&
    input.goals.some(
      (g) =>
        g.id === "tighten_messaging" &&
        /remove\s+testimonial|drop\s+proof|cut\s+gallery/i.test(
          g.objective + g.reason,
        ),
    )
  ) {
    conflicts.push({
      kind: "proof_removal_vs_proof_add",
      severity: "high",
      goalIds: ["strengthen_proof", "tighten_messaging"],
      explanation:
        "One goal adds proof while another removes testimonials/gallery.",
      resolution:
        "Keep proof assets; tighten copy without deleting trust sections.",
    });
  }

  // Opposing: sequence proof earlier vs goals that imply proof is optional later
  if (
    ids.has("sequence_proof_before_ask") &&
    ids.has("simplify_conversion") &&
    !ids.has("establish_trust") &&
    !ids.has("strengthen_proof") &&
    (input.evaluation?.trust.score ?? 100) < 60
  ) {
    conflicts.push({
      kind: "opposing_section_intent",
      severity: "medium",
      goalIds: ["sequence_proof_before_ask", "simplify_conversion"],
      explanation:
        "Proof sequencing is planned without a trust-building goal to support it.",
      resolution: "Include establish_trust or strengthen_proof in the same plan.",
    });
  }

  return conflicts;
}
