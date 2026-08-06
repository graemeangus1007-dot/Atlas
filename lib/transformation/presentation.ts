/**
 * Natural-language transformation presentation — no operation lists.
 */

import type {
  TransformationGoal,
  TransformationPhase,
  TransformationPlan,
  WebsiteVision,
} from "@/lib/transformation/types";

const INTERNAL_ID_LEAK =
  /\b(imp-|principle\.|hero\.[a-z_]+|trust\.[a-z_]+|set_page_direction|strengthen_hero|establish_trust)\b/i;

export function transformationTextExposesInternalIds(text: string): boolean {
  return INTERNAL_ID_LEAK.test(text);
}

function phaseSentence(phase: TransformationPhase, goals: TransformationGoal[]): string {
  const phaseGoals = goals.filter((g) => phase.goalIds.includes(g.id));
  if (phaseGoals.length === 0) return "";
  const lead = phaseGoals[0]!;
  switch (phase.id) {
    case "direction":
      return `I'd redesign this as ${lead.objective.replace(/^Set\s+/i, "").replace(/\.$/, "")}.`;
    case "first_impression":
      return "First I'd strengthen the first impression.";
    case "trust":
      return "Then I'd establish trust before asking visitors to contact you.";
    case "offer":
      return "I'd clarify the offer so services feel specific and scannable.";
    case "proof":
      return "I'd make proof unmistakable — imagery and testimonials that earn the ask.";
    case "conversion":
      return "Finally I'd simplify the conversion path so every section leads naturally to the next.";
    case "polish":
      return "I'd finish with pacing and messaging polish so the page feels intentional end to end.";
    default:
      return lead.objective;
  }
}

export function explainTransformationPlan(plan: TransformationPlan): string {
  const lines: string[] = [];
  const visionLine = explainWebsiteVision(plan.vision);
  lines.push(visionLine);

  for (const phase of plan.phases) {
    const sentence = phaseSentence(phase, plan.goals);
    if (sentence) lines.push(sentence);
  }

  if (plan.conflicts.some((c) => c.severity === "high")) {
    lines.push(
      "I also noted conflicts that must be resolved before execution so the plan stays consistent.",
    );
  }

  return lines.join("\n\n");
}

export function explainWebsiteVision(vision: WebsiteVision): string {
  const personality =
    vision.personality.length > 0
      ? `${vision.personality.slice(0, 2).join(" ")} `
      : "";
  const direction = vision.overallDirection.replace(/\.$/, "");
  return `I'd redesign this as a ${personality}${direction}.`.replace(
    /\s+/g,
    " ",
  );
}

export function logTransformationDiagnostics(
  plan: TransformationPlan,
  requestId?: string | null,
): void {
  if (typeof console === "undefined" || !console.info) return;
  console.info("[atlas:transformation]", {
    requestId: requestId ?? null,
    vision: plan.vision.overallDirection,
    transformationPlan: plan.explanation.slice(0, 240),
    graph: plan.graph.dependencyOrder,
    dependencyOrder: plan.graph.dependencyOrder,
    conflicts: plan.conflicts.map((c) => c.kind),
    expectedScoreDelta: plan.expectedScoreDelta,
    confidence: plan.confidence,
  });
}
