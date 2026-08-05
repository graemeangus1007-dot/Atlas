/**
 * Scoped component surface styling (v1.3.1).
 * “Text boxes” / form fields stay local — never a global theme rewrite.
 */

import { contrastRatio, meetsWcagAa } from "@/lib/ai/contrast";
import type { EditOperation } from "@/lib/ai/edit-operations";
import { NAMED_COLORS, resolveNamedColor } from "@/lib/ai/named-colors";
import type { BusinessProject } from "@/types/business-project";

export const SURFACE_TARGETS = [
  "form_fields",
  "text_panels",
  "cards",
] as const;

export type SurfaceTarget = (typeof SURFACE_TARGETS)[number];

/** Readable light-green token (not neon). */
export const LIGHT_GREEN_SURFACE = "#dcfce7";
export const LIGHT_GREEN_TEXT = "#14532d";
export const LIGHT_GREEN_BORDER = "#86efac";

export type SurfaceStylePlan =
  | {
      ok: true;
      operations: EditOperation[];
      explanation: string;
      target: SurfaceTarget;
      preserveBrandPalette: true;
      backgroundColor: string;
      textColor: string;
    }
  | {
      ok: false;
      needsClarification: true;
      explanation: string;
    }
  | {
      ok: false;
      needsClarification: false;
      explanation: string;
    };

const FORM_FIELD_PHRASE =
  /\b(text\s*boxes?|form\s*fields?|input\s*fields?|input\s*boxes?|text\s*areas?|contact\s*form\s*fields?|form\s*inputs?)\b/i;

const TEXT_PANEL_PHRASE =
  /\b(text\s*panels?|content\s*panels?|text\s*backdrops?|copy\s*panels?)\b/i;

const CARD_SURFACE_PHRASE =
  /\b(cards?|service\s*cards?|info\s*cards?)\b/i;

const SURFACE_COLOR_ACTION =
  /\b(make|turn|set|change|update|paint|color|colour)\b/i;

/**
 * True when the user is asking to restyle local surfaces (not the brand theme).
 */
export function isSurfaceStyleRequest(request: string): boolean {
  const text = request.trim();
  if (!text) return false;
  if (!SURFACE_COLOR_ACTION.test(text) && !/\blight\s+green\b/i.test(text)) {
    return false;
  }
  return (
    FORM_FIELD_PHRASE.test(text) ||
    TEXT_PANEL_PHRASE.test(text) ||
    (CARD_SURFACE_PHRASE.test(text) &&
      /\b(background|fill|surface|color|colour|green)\b/i.test(text))
  );
}

/** Soft follow-ups while a surface_style active task is sticky. */
export function isSurfaceStyleSoftContinuation(request: string): boolean {
  const text = request.trim();
  if (!text) return false;
  if (isSurfaceStyleRequest(text)) return true;
  return /\b((a\s+little\s+)?(lighter|darker|brighter)|darker\s+borders?|make\s+the\s+text\s+black|undo\s+(that\s+)?color|more\s+contrast|softer)\b/i.test(
    text,
  );
}

export function resolveSurfaceTarget(
  request: string,
): SurfaceTarget | "ambiguous" | null {
  const form = FORM_FIELD_PHRASE.test(request);
  const panels = TEXT_PANEL_PHRASE.test(request);
  const cards =
    CARD_SURFACE_PHRASE.test(request) &&
    /\b(background|fill|surface|color|colour|green)\b/i.test(request);

  const hits = [
    form ? ("form_fields" as const) : null,
    panels ? ("text_panels" as const) : null,
    cards ? ("cards" as const) : null,
  ].filter(Boolean) as SurfaceTarget[];

  if (hits.length > 1) return "ambiguous";
  if (hits.length === 1) return hits[0]!;
  if (/\btext\s*boxes?\b/i.test(request)) return "form_fields";
  return null;
}

function resolveSurfaceColor(request: string): {
  backgroundColor: string;
  textColor: string;
  borderColor: string;
  label: string;
} | null {
  if (/\blight\s+green\b|\bpale\s+green\b|\bsoft\s+green\b/i.test(request)) {
    return {
      backgroundColor: LIGHT_GREEN_SURFACE,
      textColor: LIGHT_GREEN_TEXT,
      borderColor: LIGHT_GREEN_BORDER,
      label: "light green",
    };
  }
  if (/\bsage\b/i.test(request)) {
    return {
      backgroundColor: "#e7f0e9",
      textColor: "#1f3d2a",
      borderColor: NAMED_COLORS.sage,
      label: "sage",
    };
  }
  // Single named color used as a surface fill (not theme).
  for (const name of ["cream", "white", "green", "emerald", "teal"] as const) {
    if (new RegExp(`\\b${name}\\b`, "i").test(request)) {
      const hex = resolveNamedColor(name);
      if (!hex) continue;
      const textColor =
        (contrastRatio("#101828", hex) ?? 0) >= 4.5 ? "#101828" : "#f2f4f7";
      return {
        backgroundColor: name === "green" ? LIGHT_GREEN_SURFACE : hex,
        textColor: name === "green" ? LIGHT_GREEN_TEXT : textColor,
        borderColor:
          name === "green" ? LIGHT_GREEN_BORDER : mixToward(hex, "#000000", 0.25),
        label: name === "green" ? "light green" : name,
      };
    }
  }
  return null;
}

function mixToward(hex: string, toward: string, amount: number): string {
  const parse = (value: string) => {
    const clean = value.replace("#", "");
    return {
      r: Number.parseInt(clean.slice(0, 2), 16),
      g: Number.parseInt(clean.slice(2, 4), 16),
      b: Number.parseInt(clean.slice(4, 6), 16),
    };
  };
  try {
    const a = parse(hex);
    const b = parse(toward);
    const mix = (x: number, y: number) =>
      Math.round(x + (y - x) * Math.min(1, Math.max(0, amount)));
    const to = (n: number) => n.toString(16).padStart(2, "0");
    return `#${to(mix(a.r, b.r))}${to(mix(a.g, b.g))}${to(mix(a.b, b.b))}`;
  } catch {
    return hex;
  }
}

/**
 * Plan a scoped surface style operation. Never emits changeTheme.
 * When `continueFromTask` is set, soft follow-ups (lighter / darker borders)
 * adjust the current surface without requiring the user to restate the target.
 */
export function planSurfaceStyleOperations(input: {
  request: string;
  project: BusinessProject;
  /** Active surface target from canonical activeTask (Sprint 29.5). */
  continueFromTask?: SurfaceTarget | null;
}): SurfaceStylePlan {
  const continuing =
    Boolean(input.continueFromTask) &&
    isSurfaceStyleSoftContinuation(input.request) &&
    !isSurfaceStyleRequest(input.request);

  if (!isSurfaceStyleRequest(input.request) && !continuing) {
    return {
      ok: false,
      needsClarification: false,
      explanation: "",
    };
  }

  const target = continuing
    ? (input.continueFromTask as SurfaceTarget)
    : resolveSurfaceTarget(input.request);
  if (target === "ambiguous") {
    return {
      ok: false,
      needsClarification: true,
      explanation:
        "Do you mean the contact-form fields, or the text panels across the page?",
    };
  }
  if (!target) {
    return {
      ok: false,
      needsClarification: true,
      explanation:
        "Do you mean the contact-form fields, or the text panels across the page?",
    };
  }

  const current = input.project.componentSurfaces?.[
    target === "form_fields"
      ? "formFields"
      : target === "text_panels"
        ? "textPanels"
        : "cards"
  ];

  let resolved = resolveSurfaceColor(input.request);
  if (!resolved && continuing && current?.backgroundColor) {
    const bg = current.backgroundColor;
    if (/\blighter\b/i.test(input.request)) {
      resolved = {
        backgroundColor: mixToward(bg, "#ffffff", 0.35),
        textColor: current.textColor ?? LIGHT_GREEN_TEXT,
        borderColor: mixToward(
          current.borderColor ?? bg,
          "#ffffff",
          0.2,
        ),
        label: "lighter",
      };
    } else if (/\bdarker\s+borders?\b/i.test(input.request)) {
      resolved = {
        backgroundColor: bg,
        textColor: current.textColor ?? LIGHT_GREEN_TEXT,
        borderColor: mixToward(current.borderColor ?? bg, "#000000", 0.35),
        label: "darker borders",
      };
    } else if (/\bdarker\b/i.test(input.request)) {
      resolved = {
        backgroundColor: mixToward(bg, "#000000", 0.2),
        textColor: current.textColor ?? LIGHT_GREEN_TEXT,
        borderColor: mixToward(current.borderColor ?? bg, "#000000", 0.25),
        label: "darker",
      };
    } else if (/\bmake\s+the\s+text\s+black\b/i.test(input.request)) {
      resolved = {
        backgroundColor: bg,
        textColor: "#101828",
        borderColor: current.borderColor ?? LIGHT_GREEN_BORDER,
        label: "black text",
      };
    } else if (/\bundo\s+(that\s+)?color\b/i.test(input.request)) {
      return {
        ok: false,
        needsClarification: false,
        explanation:
          "I can clear the local surface styling — tell me if you want the form fields back to the default, or restore a brand accent instead.",
      };
    }
  }

  if (!resolved) {
    return {
      ok: false,
      needsClarification: true,
      explanation:
        "What color should those surfaces be? For example, light green or cream.",
    };
  }

  const color = { ...resolved };
  if (!meetsWcagAa(color.textColor, color.backgroundColor)) {
    // Force readable text on light green / light fills.
    color.textColor =
      (contrastRatio("#101828", color.backgroundColor) ?? 0) >= 4.5
        ? "#101828"
        : "#f2f4f7";
  }

  const operations: EditOperation[] = [
    {
      operation: "setComponentSurface",
      target,
      backgroundColor: color.backgroundColor,
      textColor: color.textColor,
      borderColor: color.borderColor,
    },
  ];

  const targetLabel =
    target === "form_fields"
      ? "form fields"
      : target === "text_panels"
        ? "text panels"
        : "cards";

  return {
    ok: true,
    operations,
    target,
    preserveBrandPalette: true,
    backgroundColor: color.backgroundColor,
    textColor: color.textColor,
    explanation: `Done. I set the ${targetLabel} to a readable ${color.label} and left your brand accent unchanged.`,
  };
}

/** Strip theme ops from a list when brand palette must be preserved. */
export function stripThemeOpsForLocalSurface(
  operations: EditOperation[],
): EditOperation[] {
  return operations.filter((op) => op.operation !== "changeTheme");
}

export function surfaceStyleChangedProtectedPalette(
  before: BusinessProject,
  after: BusinessProject,
): boolean {
  return (
    before.primaryColor !== after.primaryColor ||
    before.accentColor !== after.accentColor ||
    before.secondaryColor !== after.secondaryColor ||
    before.backgroundColor !== after.backgroundColor ||
    before.theme !== after.theme
  );
}
