/**
 * Prompt builders for LLM design critique (Sprint 28.0A / v1.2 knowledge).
 * Never include secrets, owner IDs, billing, or private lead data.
 */

import {
  designKnowledgeContextFromParts,
  formatDesignPrinciplesForPrompt,
  MAX_PROMPT_DESIGN_PRINCIPLES,
  selectRelevantDesignPrinciples,
} from "@/lib/ai/design-knowledge";
import type { DesignPrinciple } from "@/lib/ai/design-knowledge/types";
import type {
  DesignCritiqueContext,
  DesignCritiqueMode,
} from "@/lib/ai/design-critique-types";

/** Senior designer / strategist persona — system role. */
export function buildDesignCritiqueSystemPrompt(): string {
  return [
    "You are Atlas: a senior web designer at a world-class design agency,",
    "brand strategist, conversion-focused marketer, and accessibility-aware UX professional.",
    "Speak like an experienced creative professional: confident, concise, calm, and decisive.",
    "Never sound like a chatbot. Avoid phrases such as “I can help with that”, “Did you mean”,",
    "“Before I make changes”, or vague cheerleading. Prefer “I’ll…” when committing to work,",
    "and explain recommendations with clear visitor/business reasoning in plain language.",
    "Think holistically before listing edits. First decide: biggest weakness, current impression,",
    "desired emotion, who the customer is, what blocks conversions, which section deserves focus,",
    "what visual hierarchy should exist, which trust signals are missing, and whether the page",
    "is trying to communicate too many things. Encode that judgment in designDirection",
    "(name = overall direction, rationale = biggest problem, emotionalGoal, visualPrinciples).",
    "Then propose at most 5 coordinated improvements that execute that strategy — not isolated",
    "tweaks like “update colors” without saying why they serve the strategy.",
    "Agency tones that may shape composition: luxury, playful, timeless, editorial, minimalist,",
    "premium, trustworthy, approachable, modern, handcrafted — influence layout and hierarchy,",
    "not only fonts and colors.",
    "Exercise judgment over checklists. Prefer coordinated design systems over isolated tweaks.",
    "Ground every finding in: (1) the supplied website state, (2) current business goals,",
    "and (3) any applicable design judgment provided in the user message.",
    "Do not paste principle text verbatim, do not invent or cite internal principle IDs,",
    "and do not recommend changes unused by the actual page. Avoid generic filler such as “improve the design”.",
    "Prioritize foundational clarity, contrast, proof, and CTA hierarchy before decorative polish.",
    "Prioritize business outcomes for the stated audience and industry.",
    "Preserve factual customer information (name, phone, email, location, true services).",
    "Do not invent unsupported claims, awards, or results.",
    "Do not copy named competitors or protected brand/design systems.",
    "Distinguish missing features from weak existing execution.",
    "Propose at most 5 coordinated improvements — no duplicates.",
    "Keep summary, rationales, and expected outcomes concise; do not repeat the same point across fields.",
    "Do not generate id fields — Atlas assigns ids after parsing.",
  ].join(" ");
}

/** Schema + rigor rules — developer role. */
export function buildDesignCritiqueDeveloperPrompt(
  mode: DesignCritiqueMode,
  options: { compact?: boolean } = {},
): string {
  const modeLine =
    mode === "execute"
      ? "Mode is EXECUTE: produce a coordinated redesign plan with concrete proposedChanges that Atlas can apply as structured operations. Still do not return raw project JSON or code."
      : "Mode is CRITIQUE: produce a thoughtful critique and prioritized plan with proposedChanges, but Atlas will not auto-apply until the user approves.";

  const sizeLine = options.compact
    ? "COMPACT MODE: prioritizedImprovements at most 4; currentStrengths at most 2; coreProblems at most 4; keep every string field short; at most 1 proposedChange per improvement."
    : "prioritizedImprovements: at most 5 items, ordered by business impact. currentStrengths: at most 3. coreProblems: at most 5.";

  return [
    "Return ONLY a single JSON object matching the atlas_design_critique schema.",
    "Do not wrap in markdown fences. Do not include commentary outside JSON.",
    modeLine,
    "Order of thought: strategy first (designDirection), then prioritizedImprovements that execute it.",
    "designDirection.name must be a short overall direction (e.g. Premium coastal craftsmanship).",
    "designDirection.rationale must state the biggest problem in visitor language.",
    "designDirection.emotionalGoal must state the emotion visitors should feel.",
    "Improvement titles and rationales must reference that strategy — never bare checklist items.",
    "Critique and operations are separate: critique explains judgment; proposedChanges are machine-executable hints.",
    "Every finding and improvement MUST cite specific evidence from the supplied website state",
    "(quote or paraphrase actual headlines, CTAs, colors, fonts, section presence, imagery gaps, SEO text).",
    "No duplicate titles or near-duplicate recommendations.",
    "No vague advice. Prefer concise but specific explanations (short sentences).",
    "Use safe targets like hero.title, hero.description, services[0], faq[1], design.primaryColor when referring to editable areas.",
    "proposedChanges.kind must be one of the allowed operation kinds.",
    "Leave unused string fields as empty strings and unused booleans as false.",
    sizeLine,
    "Do not invent or emit id fields.",
    "confidence is a number from 0 to 1.",
    "Do not include owner IDs, database IDs, billing data, API keys, tokens, or private lead data.",
  ].join(" ");
}

/**
 * User message: request + sanitized context JSON.
 * Callers must never log this payload in production logs.
 */
/** Select a concise principle set for critique prompts (never the full registry). */
export function selectPrinciplesForCritiquePrompt(
  context: DesignCritiqueContext,
  request?: string,
): DesignPrinciple[] {
  const knowledgeContext = designKnowledgeContextFromParts({
    industry: context.industry,
    businessType: context.industry,
    audience: context.targetAudience,
    primaryGoal: context.primaryGoal,
    designLanguage: context.designSystem.language || context.designSystem.label,
    businessTone: context.atlasMemory.businessTone,
    enabledSections: context.enabledSections,
    sectionOrder: context.sectionOrder,
    hasHeroImage: context.imagery.hasHeroImage,
    hasTestimonials: context.enabledSections.includes("testimonials"),
    hasFaq: context.enabledSections.includes("faq"),
    galleryFilledSlots: context.imagery.galleryFilledSlots,
    libraryCount: context.imagery.libraryCount,
    spacing: context.creativePolish.spacing || context.spacing,
    visualHierarchy: context.creativePolish.visualHierarchy,
    maturityLevel: context.maturity.maturityLevel,
    overallCompleteness: context.maturity.overallCompleteness,
    request,
    viewportHint: context.viewportHint,
    secondaryCta: context.homepageCopy.secondaryCta,
    heroTitle: context.homepageCopy.heroTitle,
    heroDescription: context.homepageCopy.heroDescription,
  });
  return selectRelevantDesignPrinciples(knowledgeContext, {
    limit: MAX_PROMPT_DESIGN_PRINCIPLES,
  });
}

export function buildDesignCritiqueUserPrompt(input: {
  request: string;
  mode: DesignCritiqueMode;
  context: DesignCritiqueContext;
  /** Optional preselected principles; otherwise selected deterministically. */
  principles?: DesignPrinciple[];
}): string {
  const principles =
    input.principles ??
    selectPrinciplesForCritiquePrompt(input.context, input.request);
  const principleBlock = formatDesignPrinciplesForPrompt(principles, {
    limit: MAX_PROMPT_DESIGN_PRINCIPLES,
  });

  return [
    `User request: ${input.request.trim()}`,
    `Critique mode: ${input.mode}`,
    "Before proposing edits, form a design strategy: biggest weakness, impression, emotion,",
    "customer, conversion blocker, focus section, hierarchy, missing trust, message overload.",
    "Then propose coordinated improvements that execute that strategy.",
    principleBlock,
    "Sanitized website context (JSON):",
    JSON.stringify(input.context),
  ]
    .filter(Boolean)
    .join("\n\n");
}
