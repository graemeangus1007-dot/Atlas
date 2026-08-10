/**
 * Critique / redesign request classification (Sprint 28.1A).
 * Deterministic semantic signals — not a single-phrase matcher.
 * Critique questions must never fall through to generic clarification.
 */

export const CRITIQUE_ROUTING_PATH = "atlas_critique_pipeline" as const;

export type CritiqueRouteIntent = "design_critique" | "design_redesign";

export type CritiqueClassification = {
  kind: "critique" | "execute" | "none";
  intent: CritiqueRouteIntent | null;
  confidence: number;
  matchedSignals: string[];
  shouldExecuteEdits: boolean;
  selectedPath: typeof CRITIQUE_ROUTING_PATH | null;
};

/** Signals used for diagnostics (never includes prompt text). */
export type CritiqueSignalId =
  | "review"
  | "critique"
  | "evaluate"
  | "assess"
  | "audit"
  | "redesign_question"
  | "what_would_you_change"
  | "what_would_you_improve"
  | "before_launch"
  | "agency_hypothetical"
  | "senior_designer"
  | "holding_back"
  | "feels_unfinished"
  | "look_more_professional"
  | "named_company_inspiration"
  | "execute_redesign"
  | "apply_improvements"
  | "suggestions_review";

type SignalRule = {
  id: CritiqueSignalId;
  pattern: RegExp;
  /** critique = advisory only; execute = plan + apply path */
  role: "critique" | "execute" | "either";
  confidence: number;
};

/** “How would you…” / hypothetical — never treat as direct execution. */
const HYPOTHETICAL_QUESTION =
  /\b((how|what)\s+would\s+(you|a|an|the)|if\s+you\s+were|pretend\s+you\s+(are|were)|as\s+if\s+you\s+(are|were))\b/i;

/** Explanation about existing choices — not a critique request. */
const EXPLANATION_QUESTION =
  /\b(why\s+did\s+you\s+(choose|pick|use|go\s+with)|why\s+is\s+(the|this)\s+design|explain\s+(the|your|this)\s+design\s+choice)\b/i;

/** Hero blur / wash questions — owned by Visual Composition, not Homepage Review. */
const VISUAL_COMPOSITION_QUESTION =
  /\bwhy\s+(is|was|did)\b[\s\S]{0,48}\b(blur|blurred|blurring|grey\s+layer|gray\s+layer|overlay|darken|covered|half\s+of\s+(the\s+)?(image|photo))\b|\bwhy\s+is\s+(half|part)\s+of\s+(the\s+)?(image|photo|picture)\b|\bwhy\s+is\s+(the\s+)?(image|photo)\s+(so\s+)?dark\b/i;

/** Hero-local composition fixes — not whole-site redesign. */
const VISUAL_COMPOSITION_FIX =
  /\b(keep\s+the\s+(photo|image)\s+clear|move\s+the\s+(text|words).{0,40}(easier|quieter)|put\s+the\s+(words|text)\s+in\s+a\s+quieter|less\s+blur|remove\s+(the\s+)?blur|stop\s+covering\s+the\s+(photo|image))\b/i;

/** Final polish / agency-quality pass — Taste Engine, not Homepage Review. */
const TASTE_POLISH_REQUEST =
  /\b(polish\s+(the\s+)?(website|site|page|design)|final\s+(agency[- ]quality\s+)?pass|agency[- ]quality\s+pass|make\s+it\s+feel\s+more\s+professional|refine\s+(the\s+)?(spacing|typography|design)|make\s+the\s+design\s+feel\s+more\s+consistent)\b/i;

/** Lead-generation / conversion analysis — Conversion Director, not critique. */
const CONVERSION_DIRECTOR_REQUEST =
  /\b(how\s+do\s+we\s+improve\s+conversion|how\s+can\s+(this\s+site\s+)?convert\s+better|improve\s+(lead\s+generation|conversion)|increase\s+(inquir(?:y|ies)|leads?|conversions?)|how\s+do\s+we\s+get\s+more\s+leads|get\s+more\s+leads|lead\s+generation)\b/i;

/** Prioritization / sequencing — Strategic Director, not Homepage Review. */
const STRATEGIC_DIRECTOR_REQUEST =
  /\b(what'?s\s+the\s+biggest\s+weakness|what\s+should\s+i\s+fix\s+first|where\s+should\s+i\s+spend\s+another\s+hour|what\s+matters\s+most|what\s+would\s+improve\s+(this\s+site|it|the\s+site)\s+the\s+most|biggest\s+(opportunity|weakness|priority)|highest[- ]impact\s+(improvement|opportunity))\b/i;

/** Genuinely vague — clarification allowed. */
const AMBIGUOUS_BETTER =
  /^(make\s+it\s+better|improve\s+it|make\s+this\s+better|can\s+you\s+improve\s+(it|this))[.!?]?$/i;

const SIGNAL_RULES: SignalRule[] = [
  {
    id: "review",
    pattern:
      /\b(review|look\s+over|take\s+a\s+look\s+at)\s+(this|my|the)\s+(homepage|home\s+page|site|website|page)\b/i,
    role: "critique",
    confidence: 0.98,
  },
  {
    id: "critique",
    pattern: /\b(critique|design\s+critique)\s+(this|my|the)\b|\bcritique\s+(this|my)\s+(homepage|site|website)\b/i,
    role: "critique",
    confidence: 0.98,
  },
  {
    id: "evaluate",
    pattern:
      /\b(evaluate|evaluation\s+of)\s+(this|my|the)\s+(homepage|site|website|page|design)\b/i,
    role: "critique",
    confidence: 0.96,
  },
  {
    id: "assess",
    pattern:
      /\b(assess|assessment\s+of)\s+(this|my|the)\s+(homepage|site|website|page|design)\b/i,
    role: "critique",
    confidence: 0.96,
  },
  {
    id: "audit",
    pattern:
      /\b(audit|ux\s+audit|design\s+audit)\s+(this|my|the)?\s*(homepage|site|website|page|design)?\b/i,
    role: "critique",
    confidence: 0.96,
  },
  {
    id: "what_would_you_improve",
    pattern:
      /\bwhat\s+would\s+you\s+improve\b|\bhow\s+can\s+i\s+improve\b|\bwhat\s+should\s+i\s+(fix|improve|change)\b/i,
    role: "critique",
    confidence: 0.95,
  },
  {
    id: "what_would_you_change",
    pattern:
      /\bwhat\s+would\s+you\s+change\b|\bwhat\s+would\s+you\s+do\s+differently\b/i,
    role: "critique",
    confidence: 0.95,
  },
  {
    id: "redesign_question",
    pattern:
      /\bhow\s+would\s+you\s+redesign\b|\bhow\s+would\s+you\s+(approach|improve)\s+(this|the)\b/i,
    role: "critique",
    confidence: 0.95,
  },
  {
    id: "agency_hypothetical",
    pattern:
      /\b(best\s+web\s+design\s+agency|top\s+(web\s+)?design\s+agency|world[- ]class\s+(web\s+)?(design\s+)?agency|premium\s+agency|professional\s+agency|what\s+would\s+a\s+(top|world[- ]class|great|premium)\s+agency)\b/i,
    role: "critique",
    confidence: 0.95,
  },
  {
    id: "senior_designer",
    pattern:
      /\b(senior\s+(web\s+)?designer|creative\s+director|design\s+director)\b/i,
    role: "critique",
    confidence: 0.95,
  },
  {
    id: "before_launch",
    pattern:
      /\b(before\s+launch|launch[- ]ready|what\s+should\s+i\s+(fix|change|improve)\s+before\s+launch)\b/i,
    role: "critique",
    confidence: 0.95,
  },
  {
    id: "holding_back",
    pattern:
      /\b(holding\s+(this|the\s+(homepage|site|website|page))\s+back|what'?s\s+holding\s+this\s+back)\b/i,
    role: "critique",
    confidence: 0.95,
  },
  {
    id: "feels_unfinished",
    pattern:
      /\b(feels?\s+unfinished|what\s+feels\s+unfinished|why\s+does\s+this\s+feel\s+(off|unfinished|amateur|cheap))\b/i,
    role: "critique",
    confidence: 0.95,
  },
  {
    id: "look_more_professional",
    pattern:
      /\b(look\s+more\s+professional|more\s+professionally\s+designed|feel\s+more\s+professional)\b/i,
    role: "either",
    confidence: 0.92,
  },
  {
    id: "named_company_inspiration",
    pattern:
      /\bhow\s+would\s+(apple|stripe|airbnb|nike|google|microsoft|tesla|notion|figma)'?s?\s+(design\s+)?(team|studio)?\b/i,
    role: "critique",
    confidence: 0.95,
  },
  {
    id: "suggestions_review",
    pattern:
      /\b(any\s+suggestions?|how\s+launch[- ]ready\s+is\s+this|review\s+my\s+(site|website|homepage))\b/i,
    role: "critique",
    confidence: 0.94,
  },
  {
    id: "execute_redesign",
    pattern:
      /\b(redesign\s+(this|it|my)\s+(homepage|home\s+page|site|website)|redesign\s+(this|it)\b|make\s+(this|it)\s+look\s+like\s+a\s+premium\s+agency|premium\s+agency\s+designed|make\s+(this|it)\s+look\s+professionally\s+designed|redesign\s+(this|my)\s+(homepage|site|website)\s+like\b)/i,
    role: "execute",
    confidence: 0.95,
  },
  {
    id: "apply_improvements",
    pattern:
      /\b(apply\s+the\s+(improvements|recommendations|critique\s+plan)\s*(you\s+recommend)?|make\s+all\s+of\s+(those|these)\s+improvements)\b/i,
    role: "execute",
    confidence: 0.96,
  },
];

function collectSignals(request: string): Array<{
  id: CritiqueSignalId;
  role: SignalRule["role"];
  confidence: number;
}> {
  const hits: Array<{
    id: CritiqueSignalId;
    role: SignalRule["role"];
    confidence: number;
  }> = [];
  for (const rule of SIGNAL_RULES) {
    if (rule.pattern.test(request)) {
      hits.push({
        id: rule.id,
        role: rule.role,
        confidence: rule.confidence,
      });
    }
  }
  return hits;
}

/**
 * Classify a message as critique-only, redesign execution, or neither.
 */
export function classifyCritiqueRequest(request: string): CritiqueClassification {
  const text = request.trim();
  if (!text) {
    return {
      kind: "none",
      intent: null,
      confidence: 0,
      matchedSignals: [],
      shouldExecuteEdits: false,
      selectedPath: null,
    };
  }

  if (
    AMBIGUOUS_BETTER.test(text) ||
    EXPLANATION_QUESTION.test(text) ||
    VISUAL_COMPOSITION_QUESTION.test(text) ||
    VISUAL_COMPOSITION_FIX.test(text) ||
    TASTE_POLISH_REQUEST.test(text) ||
    CONVERSION_DIRECTOR_REQUEST.test(text) ||
    STRATEGIC_DIRECTOR_REQUEST.test(text) ||
    /^(improve\s+conversion|increase\s+inquiries|what\s+should\s+i\s+fix\s+first|what\s+matters\s+most)[.!?]?$/i.test(
      text,
    )
  ) {
    return {
      kind: "none",
      intent: null,
      confidence: 0,
      matchedSignals: [],
      shouldExecuteEdits: false,
      selectedPath: null,
    };
  }

  const hits = collectSignals(text);
  if (!hits.length) {
    return {
      kind: "none",
      intent: null,
      confidence: 0,
      matchedSignals: [],
      shouldExecuteEdits: false,
      selectedPath: null,
    };
  }

  const matchedSignals = [...new Set(hits.map((h) => h.id))];
  const confidence = Math.max(...hits.map((h) => h.confidence));
  const hypothetical = HYPOTHETICAL_QUESTION.test(text);
  const questionShape =
    /^(who|what|why|how|when|where|which)\b|\?\s*$/i.test(text);
  const hardExecute = hits.some((h) => h.role === "execute");
  const softEither = hits.some((h) => h.role === "either");
  const hasCritiqueSignal = hits.some((h) => h.role === "critique");

  // Hypothetical / “how would you…” → critique only, never auto-edit.
  if (hypothetical) {
    return {
      kind: "critique",
      intent: "design_critique",
      confidence: Math.max(confidence, 0.95),
      matchedSignals,
      shouldExecuteEdits: false,
      selectedPath: CRITIQUE_ROUTING_PATH,
    };
  }

  // Imperative redesign / apply — execution path.
  if (hardExecute && !questionShape) {
    return {
      kind: "execute",
      intent: "design_redesign",
      confidence,
      matchedSignals,
      shouldExecuteEdits: true,
      selectedPath: CRITIQUE_ROUTING_PATH,
    };
  }

  // “look more professional” as a question → critique; as a command → execute.
  if (softEither && !hasCritiqueSignal && !hardExecute) {
    if (questionShape) {
      return {
        kind: "critique",
        intent: "design_critique",
        confidence,
        matchedSignals,
        shouldExecuteEdits: false,
        selectedPath: CRITIQUE_ROUTING_PATH,
      };
    }
    return {
      kind: "execute",
      intent: "design_redesign",
      confidence,
      matchedSignals,
      shouldExecuteEdits: true,
      selectedPath: CRITIQUE_ROUTING_PATH,
    };
  }

  if (hasCritiqueSignal || hardExecute || softEither) {
    return {
      kind: "critique",
      intent: "design_critique",
      confidence,
      matchedSignals,
      shouldExecuteEdits: false,
      selectedPath: CRITIQUE_ROUTING_PATH,
    };
  }

  return {
    kind: "none",
    intent: null,
    confidence: 0,
    matchedSignals: [],
    shouldExecuteEdits: false,
    selectedPath: null,
  };
}

export function isCritiqueOrRedesignRequest(request: string): boolean {
  const c = classifyCritiqueRequest(request);
  return c.kind === "critique" || c.kind === "execute";
}

/**
 * True when a pending clarification must yield to a new owned director ask.
 */
export function shouldOverridePendingClarification(request: string): boolean {
  const text = request.trim();
  if (!text) return false;
  if (isCritiqueOrRedesignRequest(text)) return true;
  if (TASTE_POLISH_REQUEST.test(text)) return true;
  if (VISUAL_COMPOSITION_QUESTION.test(text) || VISUAL_COMPOSITION_FIX.test(text)) {
    return true;
  }
  if (
    CONVERSION_DIRECTOR_REQUEST.test(text) ||
    /^(improve\s+conversion|increase\s+inquiries)[.!?]?$/i.test(text)
  ) {
    return true;
  }
  if (STRATEGIC_DIRECTOR_REQUEST.test(text)) return true;
  if (
    /\b(complete\s+((my|the)\s+)?(website|site)|finish\s+((my|the)\s+)?(website|site)|make\s+((the|my)\s+)?(website|site)\s+complete|make\s+it\s+launch[- ]ready)\b/i.test(
      text,
    )
  ) {
    return true;
  }
  return false;
}
