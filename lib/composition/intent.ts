/**
 * Visual composition intent — explanation vs hero-local refinement.
 * Must win over whole-site review / NL polish / transformation plans.
 */

export type VisualCompositionIntentKind =
  | "visual_composition_explanation"
  | "visual_composition_refinement";

export type VisualCompositionIntent = {
  kind: VisualCompositionIntentKind;
  confidence: number;
  matchedSignals: string[];
};

/** Why / explain questions about current blur, wash, covering, darkness. */
const EXPLANATION_PATTERNS: Array<{ id: string; pattern: RegExp }> = [
  {
    id: "why_blurred",
    pattern:
      /\bwhy\s+(is|was|did)\b[\s\S]{0,40}\b(blur|blurred|blurring)\b|\bwhy\s+is\s+(half|part)\s+of\s+(the\s+)?(image|photo|picture)\s+blur/i,
  },
  {
    id: "why_half_covered",
    pattern:
      /\bwhy\s+is\s+(half|part)\s+of\s+(the\s+)?(image|photo|picture)\b|\bwhy\s+is\s+(the\s+)?(image|photo|picture)\s+(half\s+)?(covered|hidden|darkened|dark)\b/i,
  },
  {
    id: "why_darkened",
    pattern:
      /\bwhy\s+(did\s+you\s+)?(darken|cover|wash|blur)\b|\bwhy\s+is\s+there\s+a\s+(grey|gray)\s+(layer|area|block|wash)\b|\bwhy\s+is\s+(the\s+)?(image|photo)\s+(so\s+)?dark\b/i,
  },
  {
    id: "why_overlay",
    pattern:
      /\bwhy\s+(is|did)\b[\s\S]{0,32}\b(overlay|scrim|gradient|grey\s+layer|gray\s+layer)\b/i,
  },
];

/** Explicit requests to clear the photo and relocate copy. */
const REFINEMENT_PATTERNS: Array<{ id: string; pattern: RegExp }> = [
  {
    id: "keep_photo_clear",
    pattern:
      /\b(keep|make)\s+(the\s+)?(photo|image|picture)\s+(clear|visible|open)\b|\bstop\s+covering\s+(the\s+)?(photo|image|picture)\b|\b(use\s+)?less\s+blur\b|\bremove\s+(the\s+)?blur\b/i,
  },
  {
    id: "move_text_quieter",
    pattern:
      /\bmove\s+(the\s+)?(text|words|copy|headline)\b[\s\S]{0,40}\b(easier\s+to\s+read|quieter|clearer|elsewhere|somewhere)\b|\bput\s+(the\s+)?(words|text|copy)\s+in\s+a\s+quieter\s+part\b/i,
  },
  {
    id: "image_visible_text_readable",
    pattern:
      /\bkeep\s+(the\s+)?(image|photo)\s+visible\b[\s\S]{0,48}\b(text|words|headline)\s+readable\b|\b(text|words)\s+readable\b[\s\S]{0,48}\b(image|photo)\s+visible\b/i,
  },
  {
    id: "fix_blur_composition",
    pattern:
      /\b(fix\s+it|fix\s+this|fix\s+the\s+hero)\b[\s\S]{0,80}\b(photo|image|blur|text|clear|quieter)\b|\b(fix\s+it)\b/i,
  },
  {
    id: "hero_prettier",
    pattern:
      /\b(make\s+(the\s+)?hero\s+(prettier|nicer|more\s+beautiful|look\s+better)|prettier\s+hero|beautify\s+(the\s+)?hero)\b/i,
  },
];

const QUESTION_SHAPE =
  /^(who|what|why|how|when|where|which)\b|\?\s*$/i;

export function isVisualCompositionExplanationRequest(request: string): boolean {
  const text = request.trim();
  if (!text) return false;
  return EXPLANATION_PATTERNS.some((r) => r.pattern.test(text));
}

export function isVisualCompositionRefinementRequest(request: string): boolean {
  const text = request.trim();
  if (!text) return false;
  if (isVisualCompositionExplanationRequest(text) && QUESTION_SHAPE.test(text)) {
    // Pure why-questions are explanation-only even if they mention blur.
    return false;
  }
  return REFINEMENT_PATTERNS.some((r) => r.pattern.test(text));
}

/**
 * Classify visual-composition intent. Explanation wins over refinement when
 * the utterance is a why-question about current treatment.
 */
export function classifyVisualCompositionIntent(
  request: string,
): VisualCompositionIntent | null {
  const text = request.trim();
  if (!text) return null;

  const explanationHits = EXPLANATION_PATTERNS.filter((r) =>
    r.pattern.test(text),
  ).map((r) => r.id);
  if (explanationHits.length > 0) {
    return {
      kind: "visual_composition_explanation",
      confidence: 0.98,
      matchedSignals: explanationHits,
    };
  }

  const refinementHits = REFINEMENT_PATTERNS.filter((r) =>
    r.pattern.test(text),
  ).map((r) => r.id);
  if (refinementHits.length > 0) {
    // Bare "Fix it." alone is weak unless hero/composition context continues it.
    if (refinementHits.length === 1 && refinementHits[0] === "fix_blur_composition") {
      if (/^fix\s+it[.!?]?$/i.test(text)) {
        return {
          kind: "visual_composition_refinement",
          confidence: 0.72,
          matchedSignals: refinementHits,
        };
      }
    }
    return {
      kind: "visual_composition_refinement",
      confidence: 0.97,
      matchedSignals: refinementHits,
    };
  }

  return null;
}

/** Strong refinement that should execute even without an active hero task. */
export function isExplicitVisualCompositionCommand(request: string): boolean {
  const intent = classifyVisualCompositionIntent(request);
  if (!intent || intent.kind !== "visual_composition_refinement") return false;
  return intent.confidence >= 0.9;
}
