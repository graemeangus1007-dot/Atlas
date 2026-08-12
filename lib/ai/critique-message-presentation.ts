/**
 * Parse Atlas assistant critique text into compact UI sections (Sprint 28.1B).
 * Deterministic — no LLM. Works with formatDesignCritiqueExplanation output.
 */

export type CritiqueImprovementCard = {
  index: number;
  title: string;
  why: string;
  impact: string;
  timeEstimate: string;
};

export type ParsedCritiqueMessage = {
  kind: "critique" | "plain";
  /** Short executive summary (2–4 sentences when possible). */
  executiveSummary: string;
  designDirection: string | null;
  strengths: string[];
  /** v1.6.3 — strategic highest priority title when present. */
  highestPriority?: string | null;
  /** v1.6.3 — items that need real business input. */
  needsInput?: string[];
  improvements: CritiqueImprovementCard[];
  /** v1.6.6 — Complete focus items (never render heading without items). */
  focusItems?: string[];
  expectedOutcome: string | null;
  /** Full original body for collapsed “View full critique”. */
  fullText: string;
  /** True when the message is long enough that collapse is recommended. */
  shouldCollapseFull: boolean;
  wordCount: number;
  applyAllReady: boolean;
};

const SECTION_HEADINGS =
  /^(Overall direction|Biggest problem|Current impression|Customer|Desired emotion|Design goals|Missing trust signals|Execution plan|Design direction|Strengths|What's working|Highest priority|Next improvements|Needs your input|Top improvements|Expected outcome|What I[’']ll focus on|Plan:)$/i;

/** Collapse plain messages well below a “wall of text” threshold. */
const LONG_MESSAGE_WORDS = 80;

const FOCUS_HEADING = /^What I[’']ll focus on\s*:?\s*$/i;

/**
 * Split completion/advisory bodies so focus lists never enter the executive
 * summary word-cap (production: "What I'll focus on 1.").
 */
export function splitFocusSection(text: string): {
  prose: string;
  focusItems: string[];
} {
  const lines = text.split("\n");
  const prose: string[] = [];
  const focusItems: string[] = [];
  let inFocus = false;
  for (const raw of lines) {
    const line = raw.trim();
    if (FOCUS_HEADING.test(line)) {
      inFocus = true;
      continue;
    }
    if (inFocus) {
      if (!line) {
        if (focusItems.length > 0) inFocus = false;
        continue;
      }
      const numbered = line.match(/^\d+\.\s+(.+)$/);
      if (numbered && numbered[1]!.trim().length > 0) {
        focusItems.push(numbered[1]!.trim());
        continue;
      }
      const bullet = line.match(/^[-•]\s+(.+)$/);
      if (bullet && bullet[1]!.trim().length > 0) {
        focusItems.push(bullet[1]!.trim());
        continue;
      }
      // Incomplete "1." / "• 1." with no title — skip.
      if (/^(\d+\.|[•·]\s*\d+\.?)$/.test(line)) continue;
      inFocus = false;
      prose.push(raw);
      continue;
    }
    prose.push(raw);
  }
  return {
    prose: prose.join("\n").trim(),
    focusItems,
  };
}

function wordCount(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).filter(Boolean).length;
}

function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .trim()
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Keep 2–4 short sentences (hard-capped ~60 words) for the executive summary. */
export function toExecutiveSummary(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return "";

  const capWords = (value: string, max = 55): string => {
    const parts = value.split(/\s+/).filter(Boolean);
    if (parts.length <= max) return value.trim();
    return `${parts.slice(0, max).join(" ")}…`;
  };

  const sentences = splitSentences(trimmed);
  // No real sentence breaks (e.g. word soup) → hard-cap words.
  if (sentences.length <= 1 && !/[.!?]/.test(trimmed)) {
    return capWords(trimmed);
  }

  const picked =
    sentences.length <= 4
      ? sentences.join(" ")
      : sentences.slice(0, 3).join(" ");
  return capWords(picked);
}

function parseImprovementBlock(block: string): CritiqueImprovementCard[] {
  const lines = block.split("\n").map((l) => l.trimEnd());
  const cards: CritiqueImprovementCard[] = [];
  let current: {
    index: number;
    title: string;
    why: string;
    impact: string;
  } | null = null;

  const flush = () => {
    if (!current) return;
    cards.push({
      index: current.index,
      title: current.title,
      why: current.why || "Improves clarity and polish.",
      impact: current.impact || "High",
      timeEstimate: "< 30 seconds",
    });
    current = null;
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    const numbered = line.match(/^(\d+)\.\s+(.+)$/);
    if (numbered) {
      flush();
      current = {
        index: Number(numbered[1]),
        title: numbered[2]!.trim(),
        why: "",
        impact: "High",
      };
      continue;
    }
    const bullet = line.match(/^[-•]\s+(.+)$/);
    if (bullet && !current) {
      cards.push({
        index: cards.length + 1,
        title: bullet[1]!.trim(),
        why: "Improves clarity and polish.",
        impact: "High",
        timeEstimate: "< 30 seconds",
      });
      continue;
    }
    if (!current) continue;
    const why = line.match(/^why(?:\s+it\s+matters)?\s*:\s*(.+)$/i);
    if (why) {
      current.why = why[1]!.trim();
      continue;
    }
    const impact = line.match(/^(?:impact|business\s+impact)\s*:\s*(.+)$/i);
    if (impact) {
      current.impact = impact[1]!.trim();
      continue;
    }
    const time = line.match(/^(?:time|estimate|estimated\s+time)\s*:\s*(.+)$/i);
    if (time) {
      // stash on next flush via impact field reuse — keep why if empty
      if (!current.why) current.why = time[1]!.trim();
      continue;
    }
    // Continuation lines under a numbered item
    if (!current.why) current.why = line.replace(/^[-•]\s*/, "");
    else current.why = `${current.why} ${line}`;
  }
  flush();
  return cards;
}

function parseStrengths(block: string): string[] {
  return block
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) =>
      l
        .replace(/^[-–—*•●◦]\s*/, "")
        .replace(/^\d+\.\s*/, "")
        .trim(),
    )
    .filter(Boolean);
}

/**
 * Parse assistant message content into compact critique sections.
 */
export function parseCritiqueMessage(content: string): ParsedCritiqueMessage {
  const fullText = content.trim();
  const words = wordCount(fullText);
  const applyAllReady = /\bapply\s+all\b/i.test(fullText);

  const hasCritiqueShape =
    /\bTop improvements\b/i.test(fullText) ||
    /\bNext improvements\b/i.test(fullText) ||
    /\bHighest priority\b/i.test(fullText) ||
    /\bWhat's working\b/i.test(fullText) ||
    /\bExpected outcome\b/i.test(fullText) ||
    /\bDesign direction\b/i.test(fullText) ||
    /\bOverall direction\b/i.test(fullText) ||
    /\bBiggest problem\b/i.test(fullText) ||
    /\bExecution plan\b/i.test(fullText) ||
    /\bDesign goals\b/i.test(fullText) ||
    /\bWhy it matters\b/i.test(fullText) ||
    (/^\d+\.\s+/m.test(fullText) && /\bPlan:\b/i.test(fullText)) ||
    (/\bimprovements? ready\b/i.test(fullText) && /\bApply all\b/i.test(fullText));

  // Multi-heading structured bodies should never render as a raw wall.
  const headingHits = fullText
    .split("\n")
    .filter((line) => SECTION_HEADINGS.test(line.trim())).length;
  const looksStructured = hasCritiqueShape || headingHits >= 2;

  if (!looksStructured) {
    const { prose, focusItems } = splitFocusSection(fullText);
    const summarySource = prose || fullText;
    const wordsProse = wordCount(summarySource);
    const dense =
      wordsProse >= LONG_MESSAGE_WORDS ||
      (summarySource.split("\n").filter((l) => l.trim()).length >= 6 &&
        wordsProse >= 40);
    return {
      kind: "plain",
      executiveSummary: toExecutiveSummary(summarySource),
      designDirection: null,
      strengths: [],
      highestPriority: null,
      needsInput: [],
      improvements: [],
      focusItems,
      expectedOutcome: null,
      fullText,
      shouldCollapseFull: dense,
      wordCount: words,
      applyAllReady,
    };
  }

  const sections: Record<string, string> = {};
  let preamble = "";
  let currentKey: string | null = null;
  const buf: string[] = [];

  const flushSection = () => {
    if (currentKey) {
      sections[currentKey] = buf.join("\n").trim();
    } else {
      preamble = buf.join("\n").trim();
    }
    buf.length = 0;
  };

  for (const line of fullText.split("\n")) {
    const trimmed = line.trim();
    if (SECTION_HEADINGS.test(trimmed)) {
      flushSection();
      currentKey = trimmed.replace(/:$/, "").toLowerCase();
      if (currentKey === "plan") currentKey = "plan";
      continue;
    }
    buf.push(line);
  }
  flushSection();

  let improvements = parseImprovementBlock(
    sections["next improvements"] ?? sections["top improvements"] ?? "",
  );
  // Strategy-only bodies: surface execution plan steps as compact cards.
  if (improvements.length === 0 && sections["execution plan"]) {
    improvements = parseImprovementBlock(sections["execution plan"]);
  }
  if (improvements.length === 0 && sections.plan) {
    improvements = parseImprovementBlock(sections.plan);
  }
  const strengths = parseStrengths(
    sections["what's working"] ?? sections.strengths ?? "",
  );
  const highestPriority = (sections["highest priority"] ?? "").trim() || null;
  const needsInput = parseStrengths(sections["needs your input"] ?? "");
  const designDirection =
    sections["overall direction"] || sections["design direction"] || null;
  const expectedOutcome = sections["expected outcome"] || null;
  const focusBlock =
    sections["what i’ll focus on"] ||
    sections["what i'll focus on"] ||
    "";
  const focusFromSection = parseImprovementBlock(focusBlock)
    .map((c) => c.title.trim())
    .filter(Boolean);
  const focusItems =
    focusFromSection.length > 0
      ? focusFromSection
      : splitFocusSection(fullText).focusItems;
  const summarySource =
    preamble ||
    sections["biggest problem"] ||
    designDirection ||
    fullText.split("\n")[0] ||
    "";

  return {
    kind: "critique",
    executiveSummary: toExecutiveSummary(summarySource),
    designDirection,
    strengths,
    highestPriority,
    needsInput,
    improvements,
    focusItems,
    expectedOutcome,
    fullText,
    shouldCollapseFull: true,
    wordCount: words,
    applyAllReady: applyAllReady || improvements.length > 0,
  };
}

/** Apply phrasing that Action Memory ordinal detection understands. */
export function applyImprovementRequest(index: number): string {
  const ordinals = ["first", "second", "third", "fourth", "fifth"];
  const word = ordinals[index] ?? `${index + 1}`;
  return `Apply the ${word} one`;
}
