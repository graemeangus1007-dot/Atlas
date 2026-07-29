/**
 * Prompt builders for LLM design critique (Sprint 28.0A).
 * Never include secrets, owner IDs, billing, or private lead data.
 */

import type {
  DesignCritiqueContext,
  DesignCritiqueMode,
} from "@/lib/ai/design-critique-types";

/** Senior designer / strategist persona — system role. */
export function buildDesignCritiqueSystemPrompt(): string {
  return [
    "You are Atlas: a senior web designer, brand strategist, conversion-focused marketer,",
    "and accessibility-aware UX professional reviewing a real small-business website.",
    "Exercise judgment over checklists. Prefer coordinated design systems over isolated tweaks.",
    "Ground every finding in the supplied website state — actual copy, structure, colors, typography,",
    "imagery, SEO, and maturity signals. Avoid generic filler such as “improve the design”.",
    "Prioritize business outcomes for the stated audience and industry.",
    "Preserve factual customer information (name, phone, email, location, true services).",
    "Do not invent unsupported claims, awards, or results.",
    "Do not copy named competitors or protected brand/design systems.",
    "Distinguish missing features from weak existing execution.",
    "Propose at most 5–7 coordinated improvements — no duplicates.",
  ].join(" ");
}

/** Schema + rigor rules — developer role. */
export function buildDesignCritiqueDeveloperPrompt(
  mode: DesignCritiqueMode,
): string {
  const modeLine =
    mode === "execute"
      ? "Mode is EXECUTE: produce a coordinated redesign plan with concrete proposedChanges that Atlas can apply as structured operations. Still do not return raw project JSON or code."
      : "Mode is CRITIQUE: produce a thoughtful critique and prioritized plan with proposedChanges, but Atlas will not auto-apply until the user approves.";

  return [
    "Return ONLY a single JSON object matching the atlas_design_critique schema.",
    "Do not wrap in markdown fences. Do not include commentary outside JSON.",
    modeLine,
    "Critique and operations are separate: critique explains judgment; proposedChanges are machine-executable hints.",
    "Every finding and improvement MUST cite specific evidence from the supplied website state",
    "(quote or paraphrase actual headlines, CTAs, colors, fonts, section presence, imagery gaps, SEO text).",
    "No duplicate titles or near-duplicate recommendations.",
    "No vague advice. Prefer concise but thoughtful explanations.",
    "Use safe targets like hero.title, hero.description, services[0], faq[1], design.primaryColor when referring to editable areas.",
    "proposedChanges.kind must be one of the allowed operation kinds.",
    "Leave unused string fields as empty strings and unused booleans as false.",
    "prioritizedImprovements: 5–7 items max, ordered by business impact.",
    "confidence is a number from 0 to 1.",
    "Do not include owner IDs, database IDs, billing data, API keys, tokens, or private lead data.",
  ].join(" ");
}

/**
 * User message: request + sanitized context JSON.
 * Callers must never log this payload in production logs.
 */
export function buildDesignCritiqueUserPrompt(input: {
  request: string;
  mode: DesignCritiqueMode;
  context: DesignCritiqueContext;
}): string {
  return [
    `User request: ${input.request.trim()}`,
    `Critique mode: ${input.mode}`,
    "Sanitized website context (JSON):",
    JSON.stringify(input.context),
  ].join("\n\n");
}
