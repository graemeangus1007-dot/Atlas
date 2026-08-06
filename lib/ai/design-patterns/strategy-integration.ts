/**
 * Integrate Design Pattern Engine into Design Strategy (advisory only).
 * Does not rewrite websites or change chat routing.
 */

import {
  composeDesignPatterns,
  compositionSectionFlowLabels,
} from "@/lib/ai/design-patterns/composition";
import { explainDesignPatternComposition } from "@/lib/ai/design-patterns/explain";
import type { DesignPatternStrategyAttachment } from "@/lib/ai/design-patterns/types";
import type {
  DesignStrategy,
  DesignStrategyInput,
} from "@/lib/ai/design-strategy-types";

export function designPatternContextFromStrategyInput(
  input: DesignStrategyInput,
  agencyTones?: DesignStrategy["agencyTones"],
): Parameters<typeof composeDesignPatterns>[0] {
  return {
    industry: input.industry,
    businessType: input.industry,
    businessDescription: input.businessDescription,
    audience: input.targetAudience,
    primaryGoal: input.primaryGoal,
    designLanguage: input.designLanguage,
    businessTone: input.businessTone,
    agencyTones: agencyTones,
    hasHeroImage: input.hasHeroImage,
    hasTestimonials: input.hasTestimonials,
    galleryFilledSlots: input.galleryFilledSlots,
    libraryCount: input.libraryCount,
    enabledSections: input.enabledSections,
    request: input.request,
  };
}

/**
 * Build pattern composition attachment for a strategy.
 */
export function buildDesignPatternStrategyAttachment(
  input: DesignStrategyInput,
  agencyTones: DesignStrategy["agencyTones"],
): DesignPatternStrategyAttachment {
  const ctx = designPatternContextFromStrategyInput(input, agencyTones);
  const composition = composeDesignPatterns(ctx);
  return {
    patternIds: composition.patternIds,
    compositionScore: composition.score,
    dimensions: composition.dimensions,
    explanation: explainDesignPatternComposition(composition, ctx),
    sectionFlow: compositionSectionFlowLabels(composition),
  };
}

/**
 * Attach pattern composition to an existing strategy object (mutates return copy).
 */
export function attachDesignPatternsToStrategy(
  strategy: DesignStrategy,
  input: DesignStrategyInput,
): DesignStrategy {
  const patternComposition = buildDesignPatternStrategyAttachment(
    input,
    strategy.agencyTones,
  );
  return {
    ...strategy,
    patternComposition,
  };
}
