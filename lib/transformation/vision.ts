/**
 * Build Website Vision from Creative Director + Design Strategy + Patterns.
 */

import type { DesignStrategy } from "@/lib/ai/design-strategy-types";
import type { DesignStrategyInput } from "@/lib/ai/design-strategy-types";
import type { CreativeDirectorEvaluation } from "@/lib/creative-director";
import type { WebsiteVision } from "@/lib/transformation/types";

export function buildWebsiteVision(input: {
  strategy: DesignStrategy;
  strategyInput: DesignStrategyInput;
  evaluation?: CreativeDirectorEvaluation | null;
}): WebsiteVision {
  const { strategy, strategyInput, evaluation } = input;
  const cd = evaluation ?? strategy.creativeDirectorEvaluation;
  const personality =
    cd?.personality.primary.map(String) ??
    strategy.agencyTones.map(String).slice(0, 3);

  const journey =
    cd?.flow.actualPath?.length
      ? cd.flow.actualPath
      : strategyInput.sectionOrder.length > 0
        ? strategyInput.sectionOrder
        : ["hero", "services", "contact"];

  const idealJourney = cd?.flow.idealPath?.length
    ? cd.flow.idealPath
    : ["hero", "services", "gallery", "testimonials", "contact"];

  const highestPriorityProblem =
    cd?.executiveSummary.biggestWeakness || strategy.biggestProblem;

  const trustStrategy =
    cd && cd.trust.score < 65
      ? "Earn belief with proof and testimonials before any strong contact ask."
      : strategy.missingTrustSignals.length > 0
        ? `Strengthen trust with ${strategy.missingTrustSignals.slice(0, 2).join(" and ").toLowerCase()}.`
        : "Keep proof close to the offer so confidence stays high through contact.";

  const conversionStrategy =
    cd && cd.conversion.decisionConfidence < 60
      ? "Simplify the next step only after trust and offer clarity are in place."
      : "Guide visitors from promise → proof → a single clear contact action.";

  const successDefinition = cd
    ? `Raise overall design score while fixing “${highestPriorityProblem}” without changing brand identity.`
    : "A coordinated homepage that builds trust before conversion and feels professionally designed.";

  const constraints = [
    "Do not change stored brand palette",
    "Do not redesign the editor",
    "Preserve business identity and contact facts",
    "Prefer coordinated phases over isolated edits",
  ];

  if (strategy.patternComposition?.patternIds?.length) {
    constraints.push("Stay compatible with the selected composition direction");
  }

  const positioning = `${strategyInput.businessName} — ${strategyInput.industry} for ${strategyInput.targetAudience}, oriented toward ${strategyInput.primaryGoal.toLowerCase()}.`;

  return {
    overallDirection: strategy.overallDirection,
    personality: [...new Set(personality)].slice(0, 4),
    businessPositioning: positioning,
    visitorJourney: idealJourney.length ? idealJourney : journey,
    trustStrategy,
    conversionStrategy,
    designGoals: strategy.designGoals.slice(0, 5),
    highestPriorityProblem,
    successDefinition,
    constraints,
    agencyTones: strategy.agencyTones,
  };
}
