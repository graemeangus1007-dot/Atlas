/**
 * Deterministic named-color → hex map for Design Assistant theme intents.
 * Sprint 28.2 — expanded palette for natural-language edit planning.
 */

export const NAMED_COLORS = {
  gold: "#d4af37",
  mustard: "#ca8a04",
  bronze: "#b45309",
  navy: "#0b1d36",
  emerald: "#047857",
  green: "#0f766e",
  forestGreen: "#14532d",
  sage: "#6b8f71",
  olive: "#556b2f",
  burgundy: "#7f1d1d",
  charcoal: "#1f2937",
  cream: "#f5f0e8",
  silver: "#94a3b8",
  teal: "#0d9488",
  coral: "#ff6f61",
  white: "#ffffff",
  black: "#0a0a0a",
  /** Supporting shades for “dark navy” surfaces. */
  darkNavy: "#07111f",
  navySecondary: "#12253f",
  navyPrimary: "#14314f",
} as const;

export type NamedColorId = keyof typeof NAMED_COLORS;

const NAME_ALIASES: Array<{ id: NamedColorId; pattern: RegExp }> = [
  { id: "gold", pattern: /\bgolds?\b|\bgolden\b/i },
  { id: "mustard", pattern: /\bmustards?\b/i },
  { id: "bronze", pattern: /\bbronzes?\b/i },
  { id: "navy", pattern: /\bnavys?\b|\bnavy blue\b/i },
  { id: "emerald", pattern: /\bemeralds?\b/i },
  { id: "forestGreen", pattern: /\bforest\s+greens?\b/i },
  { id: "sage", pattern: /\bsages?\b/i },
  { id: "olive", pattern: /\bolives?\b/i },
  { id: "green", pattern: /\bgreens?\b/i },
  { id: "burgundy", pattern: /\bburgundys?\b|\bmaroons?\b/i },
  { id: "charcoal", pattern: /\bcharcoals?\b/i },
  { id: "cream", pattern: /\bcreams?\b|\bivory\b/i },
  { id: "silver", pattern: /\bsilvers?\b/i },
  { id: "teal", pattern: /\bteals?\b/i },
  { id: "coral", pattern: /\bcorals?\b/i },
  { id: "white", pattern: /\bwhites?\b/i },
  { id: "black", pattern: /\bblacks?\b/i },
];

const COLOR_NAME =
  "forest\\s+green|emerald|sage|olive|mustard|bronze|charcoal|cream|navy|gold|green|white|black|teal|coral|silver|burgundy";

export function namedColorHex(id: NamedColorId): string {
  return NAMED_COLORS[id];
}

export function resolveNamedColor(raw: string): string | null {
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed) return null;
  if (trimmed === "forest green") return NAMED_COLORS.forestGreen;
  if (trimmed in NAMED_COLORS) {
    return NAMED_COLORS[trimmed as NamedColorId];
  }
  // Prefer longer / more specific aliases first (forest green before green).
  for (const entry of NAME_ALIASES) {
    if (entry.pattern.test(trimmed)) return NAMED_COLORS[entry.id];
  }
  return null;
}

export type ParsedThemeColors = {
  primary?: string;
  secondary?: string;
  accent?: string;
  background?: string;
  theme?: "light" | "dark" | "auto";
  /** Human labels used in explanations. */
  labels: string[];
};

/**
 * Extract theme + accent colors from natural language.
 * Examples:
 * - "dark navy theme with gold accents"
 * - "turn the colors to green and gold"
 * - "use green and gold"
 */
export function parseThemeColorIntent(text: string): ParsedThemeColors | null {
  const lower = text.toLowerCase();
  const labels: string[] = [];
  let primary: string | undefined;
  let secondary: string | undefined;
  let accent: string | undefined;
  let background: string | undefined;
  let theme: ParsedThemeColors["theme"];

  // Paired colors: “green and gold”, “to green and gold”
  const pair = lower.match(
    new RegExp(
      `\\b(${COLOR_NAME})\\b(?:\\s*(?:and|&|,)\\s*)\\b(${COLOR_NAME})\\b`,
      "i",
    ),
  );
  if (pair?.[1] && pair[2]) {
    const aHex = resolveNamedColor(pair[1]);
    const bHex = resolveNamedColor(pair[2]);
    if (aHex && bHex) {
      const aIsAccent = /gold|mustard|bronze|silver|cream|white/i.test(pair[1]);
      if (aIsAccent) {
        primary = bHex;
        accent = aHex;
        labels.push(pair[2], pair[1]);
      } else {
        primary = aHex;
        accent = bHex;
        labels.push(pair[1], pair[2]);
      }
      if (/green|emerald|forest|olive|sage/i.test(labels[0] ?? "")) {
        secondary = NAMED_COLORS.forestGreen;
      }
      return {
        primary,
        accent,
        ...(secondary ? { secondary } : {}),
        labels,
      };
    }
  }

  const accentMatch = lower.match(
    /(?:with|and)\s+([a-z]+(?:\s+green)?)\s+accents?\b|\b([a-z]+(?:\s+green)?)\s+accents?\b|\baccents?\s+(?:in|of|are)\s+([a-z]+(?:\s+green)?)\b/,
  );
  const accentName = accentMatch?.[1] || accentMatch?.[2] || accentMatch?.[3];
  if (accentName) {
    const hex = resolveNamedColor(accentName);
    if (hex) {
      accent = hex;
      labels.push(`${accentName} accents`);
    }
  }

  // “dark navy theme”, “navy theme”
  const themeColorMatch = lower.match(
    new RegExp(
      `\\b(?:dark\\s+)?(${COLOR_NAME})\\s+theme\\b|\\btheme\\s+(?:in|of|to)\\s+(?:dark\\s+)?(${COLOR_NAME})\\b`,
      "i",
    ),
  );
  const themeName = themeColorMatch?.[1] || themeColorMatch?.[2];
  if (themeName === "navy" || (/\bnavy\b/.test(lower) && /\btheme\b|\bdark\b/.test(lower))) {
    background = NAMED_COLORS.darkNavy;
    secondary = NAMED_COLORS.navySecondary;
    primary = NAMED_COLORS.navyPrimary;
    theme = "dark";
    labels.push("dark navy theme");
  } else if (themeName) {
    const hex = resolveNamedColor(themeName);
    if (hex) {
      primary = hex;
      background = hex;
      theme = isLightNamed(themeName) ? "light" : "dark";
      labels.push(`${themeName} theme`);
    }
  }

  // “turn/change/set colors to X”
  const turnMatch = lower.match(
    new RegExp(
      `\\b(?:turn|change|update|set|make|switch)\\b[\\s\\S]{0,40}\\b(?:colors?|colours?|palette)\\b[\\s\\S]{0,20}\\b(?:to|into)\\s+(${COLOR_NAME})\\b`,
      "i",
    ),
  );
  if (turnMatch?.[1] && !primary) {
    const hex = resolveNamedColor(turnMatch[1]);
    if (hex) {
      primary = hex;
      labels.push(turnMatch[1]);
    }
  }

  // Explicit “primary/accent is X” phrasing
  const primaryMatch = lower.match(
    /\bprimary(?:\s+color)?\s+(?:to|as|is|=)?\s+([a-z]+(?:\s+green)?)\b/,
  );
  if (primaryMatch?.[1]) {
    const hex = resolveNamedColor(primaryMatch[1]);
    if (hex) {
      primary = hex;
      labels.push(`${primaryMatch[1]} primary`);
    }
  }

  if (!accent) {
    for (const entry of NAME_ALIASES) {
      if (
        entry.id !== "navy" &&
        entry.pattern.test(lower) &&
        /\baccents?\b/.test(lower)
      ) {
        accent = NAMED_COLORS[entry.id];
        labels.push(`${entry.id} accents`);
        break;
      }
    }
  }

  // “navy … gold” without the word accent — second color as accent.
  if (primary && !accent) {
    for (const entry of NAME_ALIASES) {
      if (entry.id === "navy" || entry.id === "green") continue;
      if (entry.pattern.test(lower)) {
        if (
          ["gold", "silver", "coral", "cream", "teal", "emerald", "mustard", "bronze"].includes(
            entry.id,
          )
        ) {
          accent = NAMED_COLORS[entry.id];
          labels.push(`${entry.id} accents`);
          break;
        }
      }
    }
  }

  if (!primary && !secondary && !accent && !background) return null;

  return {
    ...(primary ? { primary } : {}),
    ...(secondary ? { secondary } : {}),
    ...(accent ? { accent } : {}),
    ...(background ? { background } : {}),
    ...(theme ? { theme } : {}),
    labels,
  };
}

function isLightNamed(name: string): boolean {
  return /cream|silver|gold|white|sage/i.test(name);
}

/** True when the user asked to leave copy untouched. */
export function wantsPreserveWording(text: string): boolean {
  return (
    /keep\s+(all\s+)?(wording|copy|text)\b/i.test(text) ||
    /wording\s+exactly\s+the\s+same/i.test(text) ||
    /don'?t\s+change\s+(the\s+)?(text|copy|wording)/i.test(text) ||
    /preserve\s+(all\s+)?(text|copy|wording)/i.test(text) ||
    /without\s+changing\s+(the\s+)?(text|copy|wording)/i.test(text)
  );
}
