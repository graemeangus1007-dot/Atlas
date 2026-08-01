/**
 * Atlas designer voice — shared copy for a senior web designer (not a chatbot).
 * Capabilities stay the same; wording is standardized here.
 */

/** Clarification chips — only when the request is genuinely ambiguous. */
export const ATLAS_DESIGNER_CLARIFICATION_OPTIONS = [
  "Richer photos",
  "Sharper writing",
  "Stronger calls to action",
  "Something else",
] as const;

/** Map clarification answers → routing destinations (includes legacy labels). */
export const ATLAS_CLARIFICATION_DESTINATIONS: Record<
  string,
  "visuals" | "copy" | "conversions" | "other"
> = {
  "Richer photos": "visuals",
  "Sharper writing": "copy",
  "Stronger calls to action": "conversions",
  "Something else": "other",
  // Legacy answers still resolve if pending from older sessions
  "Better visuals": "visuals",
  "Better copy": "copy",
  "Better conversions": "conversions",
};

export const ATLAS_VOICE = {
  /** Composer / empty conversation */
  composerPlaceholder: "Describe a change — color, copy, layout, or imagery…",
  emptyConversation:
    "Ask for a specific improvement, or ask me to review the homepage.",

  /** Streaming / status */
  progressDefault: "Reviewing the homepage layout…",
  statusReady: "Ready",
  statusWorking: "Working",
  statusReviewing: "Reviewing",
  statusDone: "Done",
  statusFailed: "Couldn’t finish",
  statusWaiting: "One question",

  /** Applied summaries */
  appliedTitle: "Done",
  viewDetails: "View details",

  /** Errors */
  genericError: "I couldn’t finish that edit.",
  applyFailed: "That change didn’t take. Try once more, or rephrase it.",
  imageApplyFailed: "I couldn’t update that image. Try again, or pick another photo.",
  incompleteResponse: "I didn’t get a complete response. Try that again.",
  networkFallbackNote: "Working offline with local design tools.",

  /** No-op / already done */
  alreadyMatched:
    "Already in place — the site already reflects that request.",
  imagesAlreadyMatched:
    "Already in place — the imagery already matches that request.",
  noSafeEdit:
    "I couldn’t map that to a safe design edit. Try something concrete — for example, “Make the hero more modern,” “Add an FAQ,” or “Shift the palette to green and gold.”",
  preserveWordingNoOp:
    "No design changes were needed while keeping your wording as-is.",

  /** Clarification (vague only) */
  clarificationLead:
    "I want to be precise. What should lead the next pass?",
  clarificationFallback:
    "What should I focus on — visuals, writing, or calls to action?",
  lowConfidence:
    "I’m not sure what to change yet. Describe the outcome you want — for example, a calmer layout, sharper headline, or stronger contact path.",

  /** Welcome after onboarding */
  welcome: (businessName: string) => {
    const name = businessName.trim() || "your business";
    return `Your site for ${name} is ready. I’ll sharpen the first impression next — tell me what feels off, or ask me to review the homepage.`;
  },

  /** Image clarify */
  noImagesYet:
    "There aren’t any uploaded images yet. Upload photos in Media and I’ll place them on the site.",
  imageAmbiguous:
    "Which image should I change — the hero image, or the first gallery image?",
  imageHint:
    "Tell me which image to change — for example, “Replace the hero image” or “Move the gallery above Testimonials.”",

  /** NL planner ambiguous with edit-ish wording */
  needConcreteEdit:
    "What should change first — colors, buttons, spacing, or copy?",

  /** Client fallbacks when API omits explanation */
  askMore: "What should I focus on for this pass?",
  designUpdatesApplied: "Done. I’ve applied those design updates.",
  noChangesNeeded: "Already in place — nothing new to apply.",

  /** Review / plan UI */
  completeWebsite: "Finish the homepage",
  applyingImprovements: "Applying those improvements…",
  applyLabel: "Apply",
  applyingLabel: "Working…",
  noVisibleChange: "Already in place",
  recApplying: "Working",
  recApplied: "Applied",
  recFailed: "Couldn’t apply",

  /** Panel error chrome */
  somethingWrongTitle: "That didn’t go through",
  retry: "Retry",
} as const;

/** Phrases Atlas must not use in customer-facing responses. */
export const ATLAS_BANNED_PHRASES = [
  "I can help with that",
  "Before I make changes",
  "Did you mean",
  "Better visuals",
  "Better copy",
  "Better conversions",
  "No changes needed",
  "Something went wrong",
  "Website updated",
  "Thinking…",
  "Applying operations",
  "Running planner",
  "Executing changes",
  "Atlas AI could not",
] as const;

/**
 * Progress line while Atlas works — design process language, not engine jargon.
 */
export function atlasProgressLabel(request?: string | null): string {
  const t = (request ?? "").toLowerCase();
  if (!t.trim()) return ATLAS_VOICE.progressDefault;
  if (
    /\b(color|colour|palette|theme|green|gold|navy|blue|accent)\b/.test(t)
  ) {
    return "Updating the color palette…";
  }
  if (/\b(font|typograph|typeface|heading|type)\b/.test(t)) {
    return "Refining typography and spacing…";
  }
  if (/\b(button|cta|call[- ]to[- ]action|contrast|readab)/.test(t)) {
    return "Improving the call-to-action hierarchy…";
  }
  if (/\b(image|photo|gallery|logo|imagery)\b/.test(t)) {
    return "Updating imagery…";
  }
  if (/\b(space|spacing|layout|whitespace|margin)\b/.test(t)) {
    return "Refining typography and spacing…";
  }
  if (/\b(review|critique|audit|improve|complete)\b/.test(t)) {
    return "Reviewing the homepage layout…";
  }
  if (/\b(copy|headline|rewrite|wording|text)\b/.test(t)) {
    return "Refining the writing…";
  }
  return ATLAS_VOICE.progressDefault;
}

/** Applied-change one-liner under “Done”. */
export function atlasAppliedSummary(input: {
  count: number;
  areas: string[];
}): string {
  const areas = input.areas.filter(Boolean);
  if (input.count <= 0) {
    return "The site is up to date.";
  }
  if (areas.length === 0) {
    return input.count === 1
      ? "One update is live on the canvas."
      : `${input.count} updates are live on the canvas.`;
  }
  const list = areas.slice(0, 3).join(" · ");
  if (areas.length === 1) {
    return `Stronger ${areas[0]!.toLowerCase()} on the homepage.`;
  }
  return `Updates across ${list}.`;
}

/**
 * Build the vague-request clarification message (designer voice).
 */
export function buildClarificationQuestion(
  options: readonly string[] = ATLAS_DESIGNER_CLARIFICATION_OPTIONS,
): string {
  return [
    ATLAS_VOICE.clarificationLead,
    "",
    ...options.map((option) => `• ${option}`),
  ].join("\n");
}

/** Soft-assert helper for tests — returns first banned phrase found. */
export function findBannedPhrase(text: string): string | null {
  const lower = text.toLowerCase();
  for (const phrase of ATLAS_BANNED_PHRASES) {
    if (lower.includes(phrase.toLowerCase())) return phrase;
  }
  return null;
}

/**
 * v1.2 — designer-voice explanation from knowledge evidence (no principle IDs).
 */
export {
  explainFromDesignKnowledge,
  explainFromEvidence,
  sanitizeDesignKnowledgeUserText,
} from "@/lib/ai/design-knowledge/explain";
