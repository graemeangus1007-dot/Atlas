/**
 * Natural Language Edit Planner (Sprint 28.2).
 * Turns conversational edit requests into validated EditOperation plans.
 * Deterministic high-confidence path first; optional LLM hook for future use.
 */

import { ATLAS_VOICE } from "@/lib/ai/atlas-designer-voice";
import type { EditOperation } from "@/lib/ai/edit-operations";
import {
  parseThemeColorIntent,
  resolveNamedColor,
  NAMED_COLORS,
} from "@/lib/ai/named-colors";
import {
  isSectionOrderRequest,
  parseSectionMoveRequest,
} from "@/lib/ai/section-order";
import type { BusinessProject } from "@/types/business-project";

export const NL_EDIT_PLANNER_VERSION = "28.3.0";
export const NL_EDIT_EXECUTE_CONFIDENCE = 0.95;

export type NlEditCategory =
  | "theme_colors"
  | "button_style"
  | "readability"
  | "contrast"
  | "spacing"
  | "typography"
  | "navigation"
  | "layout"
  | "accessibility";

/** Planner schema (LLM-facing) before conversion to EditOperation. */
export type NlEditPlanStep =
  | {
      type: "updateThemeColors";
      primary?: string;
      accent?: string;
      secondary?: string;
      background?: string;
      theme?: "light" | "dark" | "auto";
      labels?: string[];
    }
  | {
      type: "improveReadability";
      targets?: Array<"text" | "buttons" | "contrast" | "spacing">;
    }
  | { type: "setButtonStyle"; value: "rounded" | "soft-rounded" | "pill" | "square" }
  | { type: "increaseSpacing" }
  | { type: "setLuxuryTypography" }
  | { type: "updateNavigation"; mode?: "sticky" | "shorten" }
  | { type: "moveContactFormHigher" }
  | {
      type: "moveSection";
      section: string;
      position: "first" | "last" | "before" | "after";
      relativeTo?: string;
    }
  | { type: "useDarkerColors" }
  | { type: "useLighterColors" };

export type NlEditPlan = {
  intent: "edit" | "ambiguous";
  confidence: number;
  steps: NlEditPlanStep[];
  operations: EditOperation[];
  explanation: string;
  categories: NlEditCategory[];
  matchedSignals: string[];
  plannerVersion: string;
};

export type NlEditPlannerInput = {
  request: string;
  project: BusinessProject;
  /** Optional injectable planner (tests / future LLM). */
  planFn?: (input: {
    request: string;
    project: BusinessProject;
  }) => NlEditPlan | Promise<NlEditPlan>;
};

const AMBIGUOUS_ONLY =
  /^(make\s+it\s+nicer|change\s+it|improve\s+it|make\s+it\s+better|update\s+it|fix\s+it)[.!?]?$/i;

const EDIT_SIGNAL =
  /\b(color|colour|colors|colours|palette|theme|green|gold|navy|button|buttons|readab|contrast|spacing|whitespace|font|typography|navigation|nav|sticky|contact\s+form|round|rounded|luxur|darker|lighter|easy\s+to\s+read|easier\s+to\s+read|stand\s+out|move\s+(?:the\s+)?(?:contact|gallery|about|services|testimonials|faq)|put\s+(?:the\s+)?(?:contact|gallery|about|services|testimonials|faq))\b/i;

const COLOR_PAIR =
  /\b(?:turn|change|update|set|make|use|switch)\b[\s\S]{0,40}\b(?:colors?|colours?|palette|theme)\b|\b(?:colors?|colours?|palette)\b[\s\S]{0,40}\b(?:to|into|as)\b|\b(green|forest\s+green|emerald|sage|olive|gold|mustard|bronze|navy|charcoal|cream|white|black)\b[\s\S]{0,30}\b(and|&)\b[\s\S]{0,10}\b(green|forest\s+green|emerald|sage|olive|gold|mustard|bronze|navy|charcoal|cream|white|black)\b/i;

function uniqOps(ops: EditOperation[]): EditOperation[] {
  const seen = new Set<string>();
  const out: EditOperation[] = [];
  for (const op of ops) {
    const key = JSON.stringify(op);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(op);
  }
  return out;
}

function extractColorPair(text: string): {
  primary?: string;
  accent?: string;
  labels: string[];
} | null {
  const lower = text.toLowerCase();
  // “green and gold”, “green & gold”, “to green and gold”
  const pair = lower.match(
    /\b(forest\s+green|emerald|sage|olive|mustard|bronze|charcoal|cream|navy|gold|green|white|black|teal|coral|silver|burgundy)\b(?:\s*(?:and|&|,)\s*)\b(forest\s+green|emerald|sage|olive|mustard|bronze|charcoal|cream|navy|gold|green|white|black|teal|coral|silver|burgundy)\b/,
  );
  if (pair?.[1] && pair[2]) {
    const a = resolveNamedColor(pair[1]);
    const b = resolveNamedColor(pair[2]);
    if (a && b) {
      // Prefer non-metallic / deeper as primary, metallic as accent when mixed.
      const accentFirst = /gold|mustard|bronze|silver|cream|white/i.test(pair[1]);
      return accentFirst
        ? { primary: b, accent: a, labels: [pair[2], pair[1]] }
        : { primary: a, accent: b, labels: [pair[1], pair[2]] };
    }
  }

  const fromTheme = parseThemeColorIntent(text);
  if (fromTheme && (fromTheme.primary || fromTheme.accent)) {
    return {
      primary: fromTheme.primary,
      accent: fromTheme.accent,
      labels: fromTheme.labels,
    };
  }

  // Single named color with color/palette wording
  if (/\b(color|colour|colors|colours|palette|theme)\b/i.test(lower)) {
    for (const name of [
      "forest green",
      "emerald",
      "sage",
      "olive",
      "mustard",
      "bronze",
      "charcoal",
      "cream",
      "navy",
      "gold",
      "green",
      "white",
      "black",
      "teal",
      "coral",
    ]) {
      if (lower.includes(name)) {
        const hex = resolveNamedColor(name);
        if (hex) return { primary: hex, labels: [name] };
      }
    }
  }

  return null;
}

function wantsReadability(text: string): boolean {
  return /\b(easier\s+to\s+read|easy\s+to\s+read|improve\s+readability|readability|increase\s+contrast|make\s+(the\s+)?(text|words|buttons?)\s+stand\s+out|clearer\s+buttons?|words?\s+and\s+buttons?\s+are\s+easy|make\s+sure\s+.{0,40}easy\s+to\s+read|everything\s+easier\s+to\s+read|hard\s+to\s+read|text\s+contrast)\b/i.test(
    text,
  );
}

function wantsRoundedButtons(text: string): boolean {
  return /\b(round\s+all\s+(the\s+)?buttons?|round(?:ed)?\s+(the\s+)?buttons?|make\s+(the\s+)?buttons?\s+round(?:ed)?|buttons?\s+round(?:ed)?)\b/i.test(
    text,
  );
}

function wantsSpacing(text: string): boolean {
  return /\b(increase\s+spacing|more\s+whitespace|more\s+space|breathing\s+room|spacing\s+between\s+sections|less\s+cramped|airy)\b/i.test(
    text,
  );
}

function wantsLuxuryFont(text: string): boolean {
  return /\b(luxur(?:y|ious)\s+font|elegant\s+font|use\s+a\s+luxur|playfair|serif\s+heading)\b/i.test(
    text,
  );
}

function wantsStickyNav(text: string): boolean {
  return /\b(sticky\s+(nav|navigation)|navigation\s+sticky|make\s+(the\s+)?(nav|navigation)\s+sticky)\b/i.test(
    text,
  );
}

function wantsContactHigher(text: string): boolean {
  return /\b(move\s+(the\s+)?contact(\s+form)?\s+higher|contact\s+form\s+(higher|up|above)|bring\s+(the\s+)?contact\s+(form\s+)?up)\b/i.test(
    text,
  );
}

function wantsDarker(text: string): boolean {
  return /\b(use\s+darker\s+colors?|darker\s+colors?|make\s+(it|this)\s+darker|darker\s+palette)\b/i.test(
    text,
  );
}

function wantsLighter(text: string): boolean {
  return /\b(use\s+lighter\s+colors?|lighter\s+colors?|make\s+(it|this)\s+lighter|lighter\s+palette)\b/i.test(
    text,
  );
}

/**
 * True when the message looks like a natural-language design edit
 * (not a vague “make it nicer” or a critique question).
 */
export function isNaturalLanguageEditRequest(request: string): boolean {
  const text = request.trim();
  if (!text || AMBIGUOUS_ONLY.test(text)) return false;
  if (/\b(how|what)\s+would\s+you\b/i.test(text)) return false;
  if (/\b(review|critique|audit)\b/i.test(text) && !EDIT_SIGNAL.test(text)) {
    return false;
  }
  return (
    EDIT_SIGNAL.test(text) ||
    COLOR_PAIR.test(text) ||
    wantsReadability(text) ||
    wantsRoundedButtons(text) ||
    wantsSpacing(text) ||
    wantsLuxuryFont(text) ||
    wantsStickyNav(text) ||
    wantsContactHigher(text) ||
    wantsDarker(text) ||
    wantsLighter(text) ||
    isSectionOrderRequest(text)
  );
}

function stepsToOperations(
  steps: NlEditPlanStep[],
  project: BusinessProject,
): { operations: EditOperation[]; categories: NlEditCategory[]; notes: string[] } {
  const operations: EditOperation[] = [];
  const categories: NlEditCategory[] = [];
  const notes: string[] = [];

  for (const step of steps) {
    switch (step.type) {
      case "updateThemeColors": {
        operations.push({
          operation: "changeTheme",
          ...(step.primary ? { primary: step.primary } : {}),
          ...(step.accent ? { accent: step.accent } : {}),
          ...(step.secondary ? { secondary: step.secondary } : {}),
          ...(step.background ? { background: step.background } : {}),
          ...(step.theme ? { theme: step.theme } : {}),
        });
        categories.push("theme_colors");
        notes.push(
          step.labels?.length
            ? `Theme colors (${step.labels.join(" + ")})`
            : "Theme colors",
        );
        break;
      }
      case "improveReadability": {
        operations.push({
          operation: "setTypography",
          headingFont: "inter",
          bodyFont: "inter",
        });
        operations.push({
          operation: "setCreativePolish",
          spacing: "airy",
          visualHierarchy: true,
        });
        operations.push({
          operation: "changeTheme",
          background: project.theme === "dark" ? "#0f1419" : "#f7f8fa",
          secondary: "#111827",
          theme: project.theme === "dark" ? "dark" : "light",
        });
        if (step.targets?.includes("buttons") || !step.targets) {
          operations.push({ operation: "setButtonStyle", value: "rounded" });
          categories.push("button_style");
          notes.push("Button styling");
        }
        categories.push("readability", "contrast", "accessibility");
        notes.push("Text contrast", "Accessibility review");
        break;
      }
      case "setButtonStyle": {
        operations.push({ operation: "setButtonStyle", value: step.value });
        categories.push("button_style");
        notes.push("Button styling");
        break;
      }
      case "increaseSpacing": {
        operations.push({
          operation: "setCreativePolish",
          spacing: "airy",
          visualHierarchy: true,
        });
        operations.push({ operation: "setSiteWidth", value: "wide" });
        categories.push("spacing");
        notes.push("Section spacing");
        break;
      }
      case "setLuxuryTypography": {
        operations.push({
          operation: "setTypography",
          headingFont: "playfair",
          bodyFont: "lora",
        });
        categories.push("typography");
        notes.push("Luxury typography");
        break;
      }
      case "updateNavigation": {
        operations.push({
          operation: "shortenNavigation",
          maxLabelLength: 12,
        });
        operations.push({
          operation: "setCreativePolish",
          visualHierarchy: true,
        });
        categories.push("navigation");
        notes.push(
          step.mode === "sticky"
            ? "Navigation (sticky / clearer labels)"
            : "Navigation",
        );
        break;
      }
      case "moveContactFormHigher": {
        operations.push({
          operation: "setCreativePolish",
          contactFormEnabled: true,
          visualHierarchy: true,
        });
        categories.push("layout");
        notes.push("Contact form prominence");
        break;
      }
      case "moveSection": {
        operations.push({
          operation: "moveSection",
          section: step.section,
          position: step.position,
          ...(step.relativeTo ? { relativeTo: step.relativeTo } : {}),
        });
        categories.push("layout");
        notes.push(`Section order (${step.section})`);
        break;
      }
      case "useDarkerColors": {
        operations.push({
          operation: "changeTheme",
          background: "#07090d",
          secondary: "#0e1218",
          theme: "dark",
        });
        categories.push("theme_colors");
        notes.push("Darker palette");
        break;
      }
      case "useLighterColors": {
        operations.push({
          operation: "changeTheme",
          background: "#f7f8fa",
          secondary: "#1a1f26",
          theme: "light",
        });
        categories.push("theme_colors");
        notes.push("Lighter palette");
        break;
      }
      default:
        break;
    }
  }

  return {
    operations: uniqOps(operations),
    categories: [...new Set(categories)],
    notes: [...new Set(notes)],
  };
}

function buildExplanation(
  steps: NlEditPlanStep[],
  notes: string[],
): string {
  const hasColors = steps.some((s) => s.type === "updateThemeColors");
  const hasRead = steps.some((s) => s.type === "improveReadability");
  const colorStep = steps.find((s) => s.type === "updateThemeColors") as
    | Extract<NlEditPlanStep, { type: "updateThemeColors" }>
    | undefined;
  const labels = colorStep?.labels ?? [];

  let lead = "I’ll update the site now.";
  if (hasColors && hasRead) {
    lead = `I’ll shift the palette to ${labels.join(" and ") || "your colors"} and increase contrast on text and buttons so the site stays easy to read.`;
  } else if (hasColors) {
    lead = `I’ll shift the color palette${labels.length ? ` to ${labels.join(" and ")}` : ""}.`;
  } else if (hasRead) {
    lead = "I’ll increase contrast on text and buttons so the page is easier to read.";
  } else if (steps.some((s) => s.type === "setButtonStyle")) {
    lead = "I’ll refine the button styling so actions feel clearer.";
  } else if (steps.some((s) => s.type === "increaseSpacing")) {
    lead = "I’ll open up spacing between sections so the page breathes.";
  } else if (steps.some((s) => s.type === "setLuxuryTypography")) {
    lead = "I’ll switch to a more refined type pairing for headings and body.";
  } else if (steps.some((s) => s.type === "updateNavigation")) {
    lead = "I’ll tighten the navigation so it’s easier to scan.";
  } else if (steps.some((s) => s.type === "moveSection")) {
    lead = "I’ll reorder the sections to match that layout.";
  } else if (steps.some((s) => s.type === "moveContactFormHigher")) {
    lead = "I’ll bring the contact form higher so reaching out feels immediate.";
  }

  if (notes.length === 0) return lead;
  return [
    lead,
    "",
    "Changes:",
    ...notes.map((n) => `✓ ${n}`),
  ].join("\n");
}

/**
 * Deterministic multi-edit extraction — confidence ≥ 0.95 for clear requests.
 */
export function extractNaturalLanguageEditPlan(input: {
  request: string;
  project: BusinessProject;
}): NlEditPlan {
  const request = input.request.trim();
  const matchedSignals: string[] = [];
  const steps: NlEditPlanStep[] = [];

  if (!request || AMBIGUOUS_ONLY.test(request)) {
    return {
      intent: "ambiguous",
      confidence: 0.35,
      steps: [],
      operations: [],
      explanation: ATLAS_VOICE.lowConfidence,
      categories: [],
      matchedSignals: ["ambiguous"],
      plannerVersion: NL_EDIT_PLANNER_VERSION,
    };
  }

  const parsedTheme = parseThemeColorIntent(request);
  const paired = extractColorPair(request);
  const colors =
    parsedTheme && (parsedTheme.primary || parsedTheme.accent || parsedTheme.background)
      ? {
          primary: parsedTheme.primary,
          accent: parsedTheme.accent,
          secondary: parsedTheme.secondary,
          background: parsedTheme.background,
          theme: parsedTheme.theme,
          labels: parsedTheme.labels,
        }
      : paired
        ? {
            primary: paired.primary,
            accent: paired.accent,
            secondary: undefined as string | undefined,
            background: undefined as string | undefined,
            theme: undefined as "light" | "dark" | "auto" | undefined,
            labels: paired.labels,
          }
        : null;

  if (colors && (colors.primary || colors.accent || colors.background)) {
    matchedSignals.push("theme_colors");
    const primary = colors.primary ?? colors.accent;
    steps.push({
      type: "updateThemeColors",
      primary,
      accent: colors.accent ?? colors.primary,
      secondary:
        colors.secondary ??
        (primary === NAMED_COLORS.green ||
        primary === NAMED_COLORS.emerald ||
        primary === NAMED_COLORS.forestGreen
          ? NAMED_COLORS.forestGreen
          : undefined),
      background: colors.background,
      theme: colors.theme,
      labels: colors.labels,
    });
  }

  if (wantsDarker(request) && !colors) {
    matchedSignals.push("darker_colors");
    steps.push({ type: "useDarkerColors" });
  }
  if (wantsLighter(request) && !colors) {
    matchedSignals.push("lighter_colors");
    steps.push({ type: "useLighterColors" });
  }

  if (wantsReadability(request)) {
    matchedSignals.push("readability");
    const targets: Array<"text" | "buttons" | "contrast" | "spacing"> = [
      "text",
      "contrast",
    ];
    if (/\bbuttons?\b/i.test(request) || /\beverything\b/i.test(request)) {
      targets.push("buttons");
    }
    steps.push({ type: "improveReadability", targets });
  }

  if (wantsRoundedButtons(request)) {
    matchedSignals.push("button_style");
    steps.push({ type: "setButtonStyle", value: "rounded" });
  }

  if (wantsSpacing(request)) {
    matchedSignals.push("spacing");
    steps.push({ type: "increaseSpacing" });
  }

  if (wantsLuxuryFont(request)) {
    matchedSignals.push("typography");
    steps.push({ type: "setLuxuryTypography" });
  }

  if (wantsStickyNav(request)) {
    matchedSignals.push("navigation");
    steps.push({ type: "updateNavigation", mode: "sticky" });
  }

  // Section-position phrases beat generic contact-form “higher” polish.
  const sectionMove = parseSectionMoveRequest(request);
  if (sectionMove.ok) {
    matchedSignals.push("section_order");
    steps.push({
      type: "moveSection",
      section: sectionMove.intent.section,
      position: sectionMove.intent.position,
      ...(sectionMove.intent.relativeTo
        ? { relativeTo: sectionMove.intent.relativeTo }
        : {}),
    });
  } else if (wantsContactHigher(request) && !isSectionOrderRequest(request)) {
    matchedSignals.push("layout");
    steps.push({ type: "moveContactFormHigher" });
  }

  if (steps.length === 0) {
    return {
      intent: "ambiguous",
      confidence: isNaturalLanguageEditRequest(request) ? 0.55 : 0.3,
      steps: [],
      operations: [],
      explanation: ATLAS_VOICE.needConcreteEdit,
      categories: [],
      matchedSignals,
      plannerVersion: NL_EDIT_PLANNER_VERSION,
    };
  }

  const { operations, categories, notes } = stepsToOperations(
    steps,
    input.project,
  );
  const confidence =
    steps.length >= 2 || matchedSignals.includes("theme_colors")
      ? 0.98
      : matchedSignals.includes("readability") ||
          matchedSignals.includes("button_style") ||
          matchedSignals.includes("spacing") ||
          matchedSignals.includes("typography") ||
          matchedSignals.includes("navigation") ||
          matchedSignals.includes("layout") ||
          matchedSignals.includes("section_order")
        ? 0.97
        : 0.9;

  return {
    intent: "edit",
    confidence,
    steps,
    operations,
    explanation: buildExplanation(steps, notes),
    categories,
    matchedSignals,
    plannerVersion: NL_EDIT_PLANNER_VERSION,
  };
}

/**
 * Canonical planner entry — uses injectable LLM/planFn when provided,
 * otherwise the deterministic extractor.
 */
export async function planNaturalLanguageEdits(
  input: NlEditPlannerInput,
): Promise<NlEditPlan> {
  if (input.planFn) {
    return input.planFn({
      request: input.request,
      project: input.project,
    });
  }
  return extractNaturalLanguageEditPlan({
    request: input.request,
    project: input.project,
  });
}

export function shouldExecuteNlEditPlan(plan: NlEditPlan): boolean {
  return (
    plan.intent === "edit" &&
    plan.confidence >= NL_EDIT_EXECUTE_CONFIDENCE &&
    plan.operations.length > 0
  );
}
