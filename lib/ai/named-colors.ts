/**
 * Deterministic named-color → hex map for Design Assistant theme intents.
 */

export const NAMED_COLORS = {
  gold: "#d4af37",
  navy: "#0b1d36",
  emerald: "#047857",
  burgundy: "#7f1d1d",
  charcoal: "#1f2937",
  cream: "#f5f0e8",
  silver: "#94a3b8",
  teal: "#0d9488",
  coral: "#ff6f61",
  /** Supporting shades for “dark navy” surfaces. */
  darkNavy: "#07111f",
  navySecondary: "#12253f",
  navyPrimary: "#14314f",
} as const;

export type NamedColorId = keyof typeof NAMED_COLORS;

const NAME_ALIASES: Array<{ id: NamedColorId; pattern: RegExp }> = [
  { id: "gold", pattern: /\bgolds?\b|\bgolden\b/i },
  { id: "navy", pattern: /\bnavys?\b|\bnavy blue\b/i },
  { id: "emerald", pattern: /\bemeralds?\b/i },
  { id: "burgundy", pattern: /\bburgundys?\b|\bmaroons?\b/i },
  { id: "charcoal", pattern: /\bcharcoals?\b/i },
  { id: "cream", pattern: /\bcreams?\b|\bivory\b/i },
  { id: "silver", pattern: /\bsilvers?\b/i },
  { id: "teal", pattern: /\bteals?\b/i },
  { id: "coral", pattern: /\bcorals?\b/i },
];

export function namedColorHex(id: NamedColorId): string {
  return NAMED_COLORS[id];
}

export function resolveNamedColor(raw: string): string | null {
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed) return null;
  if (trimmed in NAMED_COLORS) {
    return NAMED_COLORS[trimmed as NamedColorId];
  }
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
 * Example: "dark navy theme with gold accents" → navy surfaces + gold accent.
 */
export function parseThemeColorIntent(text: string): ParsedThemeColors | null {
  const lower = text.toLowerCase();
  const labels: string[] = [];
  let primary: string | undefined;
  let secondary: string | undefined;
  let accent: string | undefined;
  let background: string | undefined;
  let theme: ParsedThemeColors["theme"];

  const accentMatch = lower.match(
    /(?:with|and)\s+([a-z]+)\s+accents?\b|\b([a-z]+)\s+accents?\b|\baccents?\s+(?:in|of|are)\s+([a-z]+)\b/,
  );
  const accentName = accentMatch?.[1] || accentMatch?.[2] || accentMatch?.[3];
  if (accentName) {
    const hex = resolveNamedColor(accentName);
    if (hex) {
      accent = hex;
      labels.push(`${accentName} accents`);
    }
  }

  // “dark navy theme”, “navy theme”, “navy and gold”
  const themeColorMatch = lower.match(
    /\b(?:dark\s+)?(navy|emerald|burgundy|charcoal|cream|silver|teal|coral|gold)\s+theme\b|\btheme\s+(?:in|of|to)\s+(?:dark\s+)?(navy|emerald|burgundy|charcoal|cream|silver|teal|coral|gold)\b/,
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

  // Explicit “primary/accent is X” phrasing
  const primaryMatch = lower.match(
    /\bprimary(?:\s+color)?\s+(?:to|as|is|=)?\s+([a-z]+)\b/,
  );
  if (primaryMatch?.[1]) {
    const hex = resolveNamedColor(primaryMatch[1]);
    if (hex) {
      primary = hex;
      labels.push(`${primaryMatch[1]} primary`);
    }
  }

  if (!accent) {
    // “gold accents” already handled; also “accent gold” / “accents gold”
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

  // “navy … gold” without the word accent — treat second color as accent when theme is navy.
  if (primary && !accent) {
    for (const entry of NAME_ALIASES) {
      if (entry.id === "navy") continue;
      if (entry.pattern.test(lower) && entry.id !== themeName) {
        // Prefer gold/silver/coral as accent candidates when paired with a theme color.
        if (["gold", "silver", "coral", "cream", "teal", "emerald"].includes(entry.id)) {
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
  return name === "cream" || name === "silver" || name === "gold";
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
