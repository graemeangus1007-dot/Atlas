/**
 * Translate design principles into designer-voice explanations.
 * Never expose principle IDs to end users.
 */

import { getDesignPrincipleById } from "@/lib/ai/design-knowledge/registry";
import { textExposesDesignPrincipleIds } from "@/lib/ai/design-knowledge/selectors";
import type { DesignKnowledgeEvidence } from "@/lib/ai/design-knowledge/types";

/**
 * Natural-language explanation grounded in a principle + observed site signal.
 */
export function explainFromDesignKnowledge(input: {
  principleId: string;
  observedSignal: string;
  siteDetail?: string;
}): string {
  const principle = getDesignPrincipleById(input.principleId);
  if (!principle) {
    return input.siteDetail?.trim() || "I’d tighten hierarchy so the next step is obvious.";
  }

  const detail = input.siteDetail?.trim();
  const signal = input.observedSignal.trim();

  // Category-specific natural framings (no IDs).
  if (principle.id === "trust.proof_before_high_commitment" ||
      principle.id === "homepage.trust_near_first_ask" ||
      principle.id === "conversion.sequence_before_ask") {
    return (
      detail ||
      "Visitors are being asked to take a high-commitment step before they’ve seen enough proof. I’d place testimonials closer to the hero so trust lands earlier in the decision journey."
    );
  }
  if (principle.id === "homepage.one_dominant_cta" ||
      principle.id === "hierarchy.cta_prominence") {
    return (
      detail ||
      "The hero currently asks visitors to choose between competing actions. I’d make the primary request the clear path and soften everything else."
    );
  }
  if (
    principle.id === "homepage.purposeful_hero_imagery" ||
    principle.id === "imagery.authentic_over_stock"
  ) {
    return (
      detail ||
      "The first screen still lacks purposeful photography, so the offer is explained without being felt. I’d lead with authentic project imagery."
    );
  }
  if (
    principle.id === "color.accessible_controls" ||
    principle.id === "accessibility.text_control_contrast"
  ) {
    return (
      detail ||
      "Key controls don’t have enough contrast to feel dependable. I’d fix button and text contrast before any decorative polish."
    );
  }
  if (principle.id === "typography.clear_heading_hierarchy") {
    return (
      detail ||
      "Headings are readable but visually flat. I’d strengthen the scale so the page scans with a clear hierarchy."
    );
  }
  if (principle.id === "typography.controlled_paragraph_width") {
    return (
      detail ||
      "Long passages stretch wider than comfortable reading. I’d tighten measure and break dense blocks so the offer stays scannable."
    );
  }

  const base = `${principle.reasoning.replace(/\.$/, "")}.`;
  const withSignal = signal
    ? `${base} Right now I’m seeing ${signal}${detail ? ` — ${detail}` : ""}.`
    : detail
      ? `${base} ${detail}`
      : base;

  return withSignal.replace(/\s+/g, " ").trim();
}

/** Explain from evidence list — first usable principle wins. */
export function explainFromEvidence(
  evidence: DesignKnowledgeEvidence[] | undefined,
  fallback: string,
): string {
  if (!evidence?.length) return fallback;
  const first = evidence[0]!;
  const text = explainFromDesignKnowledge({
    principleId: first.principleId,
    observedSignal: first.observedSignal,
    siteDetail: fallback,
  });
  return textExposesDesignPrincipleIds(text) ? fallback : text;
}

/** Strip accidental ID leaks from assistant-facing strings. */
export function sanitizeDesignKnowledgeUserText(text: string): string {
  if (!textExposesDesignPrincipleIds(text)) return text;
  return text
    .replace(/\baccording to principle\s+[a-z0-9_.]+\b/gi, "")
    .replace(
      /\b(?:homepage|typography|spacing|layout|hierarchy|trust|color|imagery|conversion|accessibility|branding)\.[a-z0-9_]+\b/gi,
      "",
    )
    .replace(/\s{2,}/g, " ")
    .trim();
}
