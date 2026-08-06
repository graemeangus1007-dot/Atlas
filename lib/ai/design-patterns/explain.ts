/**
 * Natural-language explanations of pattern compositions.
 * Never exposes internal pattern IDs.
 */

import { compositionSectionFlowLabels } from "@/lib/ai/design-patterns/composition";
import { getDesignPatternById } from "@/lib/ai/design-patterns/registry";
import { textExposesDesignPatternIds } from "@/lib/ai/design-patterns/registry";
import type {
  DesignPatternComposition,
  DesignPatternSelectionContext,
} from "@/lib/ai/design-patterns/types";

function strengthPhrase(patternId: string | null | undefined): string | null {
  if (!patternId) return null;
  const p = getDesignPatternById(patternId);
  if (!p?.strengths?.[0]) return null;
  return p.strengths[0].replace(/\.$/, "");
}

/**
 * Explain a composition in designer voice — no IDs, no jargon dumps.
 */
export function explainDesignPatternComposition(
  composition: DesignPatternComposition,
  ctx: DesignPatternSelectionContext = {},
): string {
  const heroId = composition.patternIds.find((id) => id.startsWith("hero."));
  const trustId = composition.patternIds.find((id) => id.startsWith("trust."));
  const servicesId = composition.patternIds.find((id) =>
    id.startsWith("services."),
  );
  const galleryId = composition.patternIds.find((id) =>
    id.startsWith("gallery."),
  );
  const ctaId = composition.patternIds.find((id) => id.startsWith("cta."));

  const hero = heroId ? getDesignPatternById(heroId) : null;
  const industry = (ctx.industry || ctx.businessType || "your business").trim();

  const parts: string[] = [];

  if (hero) {
    const why =
      strengthPhrase(hero.id) ||
      "it sets a clear first impression";
    if (ctx.hasHeroImage || (ctx.libraryCount ?? 0) > 0) {
      parts.push(
        `I used a ${hero.name.toLowerCase()} hero because ${why.toLowerCase()}, which fits ${industry}.`,
      );
    } else {
      parts.push(
        `I favored a ${hero.name.toLowerCase()} hero so the first viewport stays clear for ${industry}.`,
      );
    }
  }

  if (trustId) {
    const trust = getDesignPatternById(trustId);
    if (trust) {
      parts.push(
        `Then I followed with ${trust.name.toLowerCase()} so visitors see proof before diving into services.`,
      );
    }
  }

  if (servicesId) {
    const services = getDesignPatternById(servicesId);
    if (services) {
      parts.push(
        `Services use ${services.name.toLowerCase()} to keep the offer scannable.`,
      );
    }
  }

  if (galleryId && (ctx.galleryFilledSlots ?? 0) > 0) {
    const gallery = getDesignPatternById(galleryId);
    if (gallery) {
      parts.push(
        `Your project photography is shown with a ${gallery.name.toLowerCase()} layout so craftsmanship stays visible.`,
      );
    }
  }

  if (ctaId) {
    const cta = getDesignPatternById(ctaId);
    if (cta) {
      parts.push(
        `The page closes with a ${cta.name.toLowerCase()} action so the next step is obvious.`,
      );
    }
  }

  let text = parts.join(" ").replace(/\s+/g, " ").trim();
  if (!text) {
    text =
      "I coordinated the hero, trust, services, and call-to-action so the page reads like a professional agency homepage.";
  }

  if (textExposesDesignPatternIds(text)) {
    // Strip any accidental ids
    text = text.replace(/\b(?:hero|trust|services|gallery|cta)\.[a-z0-9_]+\b/gi, "");
    text = text.replace(/\s+/g, " ").trim();
  }

  return text;
}

export function explainCompositionSectionFlow(
  composition: DesignPatternComposition,
): string {
  const labels = compositionSectionFlowLabels(composition);
  return `Page flow: ${labels.join(" → ")}.`;
}
