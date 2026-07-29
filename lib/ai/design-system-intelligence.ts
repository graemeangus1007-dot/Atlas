/**
 * Atlas Design System Intelligence (Sprint 27.0A).
 * Translates abstract design intent into concrete website decisions.
 */

import type { EditOperation } from "@/lib/ai/edit-operations";
import type {
  BorderRadiusStrategy,
  ButtonLanguage,
  ColorStrategy,
  DesignLanguageId,
  DesignSystem,
  DesignSystemInput,
  DesignSystemResolution,
  ElevationStrategy,
  ImageryStyle,
  IconStyle,
  LayoutDensity,
  MotionStyle,
  PersistedDesignSystem,
  SectionHierarchyItem,
  SpacingStrategy,
  TypographyStrategy,
} from "@/lib/ai/design-system-types";
import { DESIGN_LANGUAGE_IDS } from "@/lib/ai/design-system-types";
import type { ButtonStyleId, SiteWidthId } from "@/data/design-options";
import type { TemplateId } from "@/lib/templates/types";
import type { BusinessProject } from "@/types/business-project";

const AUTO_APPLY_CONFIDENCE = 0.78;

type LanguageDefinition = {
  id: DesignLanguageId;
  label: string;
  typography: TypographyStrategy;
  spacing: SpacingStrategy;
  borderRadius: BorderRadiusStrategy;
  elevation: ElevationStrategy;
  colorStrategy: ColorStrategy;
  imageryStyle: ImageryStyle;
  iconStyle: IconStyle;
  motionStyle: MotionStyle;
  layoutDensity: LayoutDensity;
  buttonLanguage: ButtonLanguage;
  sectionHierarchy: SectionHierarchyItem[];
  templateId: TemplateId;
  buttonStyle: ButtonStyleId;
  siteWidth: SiteWidthId;
  heroOverlay: number;
  imageryKeywords: string[];
  /** Short principle blurb used in explanations. */
  principle: string;
};

const HERO: SectionHierarchyItem = {
  id: "hero",
  emphasis: "primary",
  reason: "First impression and brand promise",
};
const SERVICES: SectionHierarchyItem = {
  id: "services",
  emphasis: "secondary",
  reason: "Clarify what you offer",
};
const GALLERY: SectionHierarchyItem = {
  id: "gallery",
  emphasis: "secondary",
  reason: "Show proof through imagery",
};
const ABOUT: SectionHierarchyItem = {
  id: "about",
  emphasis: "tertiary",
  reason: "Build trust and story",
};
const CONTACT: SectionHierarchyItem = {
  id: "contact",
  emphasis: "primary",
  reason: "Make the next step obvious",
};
const FEATURES: SectionHierarchyItem = {
  id: "features",
  emphasis: "secondary",
  reason: "Highlight differentiators",
};

/** Built-in design languages — deterministic catalog. */
export const DESIGN_LANGUAGES: Record<DesignLanguageId, LanguageDefinition> = {
  luxury: {
    id: "luxury",
    label: "Luxury",
    typography: {
      headingFont: "playfair",
      bodyFont: "lora",
      principle: "Serif headings with refined body text",
    },
    spacing: "generous",
    borderRadius: "sharp",
    elevation: "flat",
    colorStrategy: {
      primary: "#8b7355",
      secondary: "#161412",
      accent: "#c4a574",
      background: "#faf8f5",
      theme: "light",
      principle: "Muted, warm palette with restrained contrast",
    },
    imageryStyle: "large_hero",
    iconStyle: "line",
    motionStyle: "restrained",
    layoutDensity: "airy",
    buttonLanguage: "refined",
    sectionHierarchy: [HERO, GALLERY, SERVICES, ABOUT, CONTACT],
    templateId: "elegant",
    buttonStyle: "square",
    siteWidth: "boxed",
    heroOverlay: 45,
    imageryKeywords: ["elegant", "premium", "craft", "detail", "luxury"],
    principle: "premium craftsmanship with restrained elegance",
  },
  minimal: {
    id: "minimal",
    label: "Minimal",
    typography: {
      headingFont: "inter",
      bodyFont: "inter",
      principle: "Clean sans-serif throughout",
    },
    spacing: "generous",
    borderRadius: "soft",
    elevation: "flat",
    colorStrategy: {
      primary: "#2a2a2a",
      secondary: "#1a1a1a",
      accent: "#4a4a4a",
      background: "#fafafa",
      theme: "light",
      principle: "Near-monochrome with strong whitespace",
    },
    imageryStyle: "minimal_negative_space",
    iconStyle: "line",
    motionStyle: "none",
    layoutDensity: "airy",
    buttonLanguage: "quiet",
    sectionHierarchy: [HERO, SERVICES, ABOUT, CONTACT],
    templateId: "minimal",
    buttonStyle: "rounded",
    siteWidth: "wide",
    heroOverlay: 30,
    imageryKeywords: ["simple", "clean", "negative space", "minimal"],
    principle: "clarity through subtraction",
  },
  modern: {
    id: "modern",
    label: "Modern",
    typography: {
      headingFont: "manrope",
      bodyFont: "manrope",
      principle: "Contemporary geometric sans",
    },
    spacing: "comfortable",
    borderRadius: "rounded",
    elevation: "subtle",
    colorStrategy: {
      primary: "#3db8a8",
      secondary: "#0e1218",
      accent: "#3db8a8",
      background: "#07090d",
      theme: "dark",
      principle: "Contemporary contrast with a clear accent",
    },
    imageryStyle: "product_focus",
    iconStyle: "line",
    motionStyle: "subtle",
    layoutDensity: "balanced",
    buttonLanguage: "confident",
    sectionHierarchy: [HERO, FEATURES, SERVICES, GALLERY, CONTACT],
    templateId: "modern",
    buttonStyle: "rounded",
    siteWidth: "full",
    heroOverlay: 50,
    imageryKeywords: ["modern", "contemporary", "sleek", "studio"],
    principle: "fresh, contemporary craftsmanship that stays approachable",
  },
  corporate: {
    id: "corporate",
    label: "Corporate",
    typography: {
      headingFont: "inter",
      bodyFont: "inter",
      principle: "Neutral professional sans",
    },
    spacing: "comfortable",
    borderRadius: "soft",
    elevation: "subtle",
    colorStrategy: {
      primary: "#2563eb",
      secondary: "#1a1f26",
      accent: "#3b82f6",
      background: "#f7f8fa",
      theme: "light",
      principle: "Trustworthy blues with restrained neutrals",
    },
    imageryStyle: "clinical_clean",
    iconStyle: "line",
    motionStyle: "restrained",
    layoutDensity: "balanced",
    buttonLanguage: "confident",
    sectionHierarchy: [HERO, SERVICES, FEATURES, ABOUT, CONTACT],
    templateId: "minimal",
    buttonStyle: "rounded",
    siteWidth: "wide",
    heroOverlay: 35,
    imageryKeywords: ["office", "professional", "team", "meeting"],
    principle: "clarity, trust, and business credibility",
  },
  friendly: {
    id: "friendly",
    label: "Friendly",
    typography: {
      headingFont: "manrope",
      bodyFont: "inter",
      principle: "Approachable sans with soft hierarchy",
    },
    spacing: "comfortable",
    borderRadius: "rounded",
    elevation: "lifted",
    colorStrategy: {
      primary: "#5a9e6f",
      secondary: "#1e2a24",
      accent: "#7cb88a",
      background: "#f5f7f4",
      theme: "light",
      principle: "Warm greens and soft neutrals",
    },
    imageryStyle: "warm_lifestyle",
    iconStyle: "filled",
    motionStyle: "subtle",
    layoutDensity: "balanced",
    buttonLanguage: "friendly",
    sectionHierarchy: [HERO, ABOUT, SERVICES, GALLERY, CONTACT],
    templateId: "modern",
    buttonStyle: "soft-rounded",
    siteWidth: "wide",
    heroOverlay: 40,
    imageryKeywords: ["warm", "welcoming", "people", "smile", "cozy"],
    principle: "warmth and approachability without losing polish",
  },
  playful: {
    id: "playful",
    label: "Playful",
    typography: {
      headingFont: "poppins",
      bodyFont: "inter",
      principle: "Expressive display sans",
    },
    spacing: "comfortable",
    borderRadius: "pill",
    elevation: "lifted",
    colorStrategy: {
      primary: "#e85d4c",
      secondary: "#1a1210",
      accent: "#f4a261",
      background: "#fff8f5",
      theme: "light",
      principle: "Energetic accents on a light canvas",
    },
    imageryStyle: "warm_lifestyle",
    iconStyle: "filled",
    motionStyle: "playful",
    layoutDensity: "balanced",
    buttonLanguage: "friendly",
    sectionHierarchy: [HERO, GALLERY, SERVICES, FEATURES, CONTACT],
    templateId: "bold",
    buttonStyle: "pill",
    siteWidth: "wide",
    heroOverlay: 40,
    imageryKeywords: ["fun", "colorful", "playful", "bright", "joyful"],
    principle: "personality and energy that still feels intentional",
  },
  editorial: {
    id: "editorial",
    label: "Editorial",
    typography: {
      headingFont: "playfair",
      bodyFont: "lora",
      principle: "Magazine-like serif pairing",
    },
    spacing: "generous",
    borderRadius: "sharp",
    elevation: "flat",
    colorStrategy: {
      primary: "#1a1a1a",
      secondary: "#111111",
      accent: "#b91c1c",
      background: "#f4f1ea",
      theme: "light",
      principle: "Ink-forward palette with a sharp accent",
    },
    imageryStyle: "editorial_story",
    iconStyle: "none",
    motionStyle: "restrained",
    layoutDensity: "airy",
    buttonLanguage: "quiet",
    sectionHierarchy: [HERO, ABOUT, GALLERY, SERVICES, CONTACT],
    templateId: "elegant",
    buttonStyle: "square",
    siteWidth: "boxed",
    heroOverlay: 35,
    imageryKeywords: ["editorial", "story", "portrait", "magazine", "art"],
    principle: "storytelling hierarchy and typographic presence",
  },
  industrial: {
    id: "industrial",
    label: "Industrial",
    typography: {
      headingFont: "poppins",
      bodyFont: "inter",
      principle: "Bold utilitarian sans",
    },
    spacing: "compact",
    borderRadius: "sharp",
    elevation: "flat",
    colorStrategy: {
      primary: "#f59e0b",
      secondary: "#0a0a0a",
      accent: "#f59e0b",
      background: "#121212",
      theme: "dark",
      principle: "High-contrast dark with amber accents",
    },
    imageryStyle: "industrial_texture",
    iconStyle: "filled",
    motionStyle: "subtle",
    layoutDensity: "dense",
    buttonLanguage: "bold",
    sectionHierarchy: [HERO, SERVICES, GALLERY, FEATURES, CONTACT],
    templateId: "bold",
    buttonStyle: "square",
    siteWidth: "full",
    heroOverlay: 60,
    imageryKeywords: ["workshop", "steel", "tools", "industrial", "concrete"],
    principle: "strength, utility, and honest materials",
  },
  medical: {
    id: "medical",
    label: "Medical",
    typography: {
      headingFont: "inter",
      bodyFont: "inter",
      principle: "Clear, trustworthy sans",
    },
    spacing: "generous",
    borderRadius: "rounded",
    elevation: "subtle",
    colorStrategy: {
      primary: "#3b82f6",
      secondary: "#1e3a5f",
      accent: "#60a5fa",
      background: "#f0f7fc",
      theme: "light",
      principle: "Soft blues, whitespace, and calm trust cues",
    },
    imageryStyle: "clinical_clean",
    iconStyle: "line",
    motionStyle: "restrained",
    layoutDensity: "airy",
    buttonLanguage: "confident",
    sectionHierarchy: [HERO, SERVICES, ABOUT, FEATURES, CONTACT],
    templateId: "minimal",
    buttonStyle: "soft-rounded",
    siteWidth: "wide",
    heroOverlay: 25,
    imageryKeywords: ["clinic", "care", "clean", "medical", "trust", "team"],
    principle: "trust, calm, and professional care",
  },
  restaurant: {
    id: "restaurant",
    label: "Restaurant",
    typography: {
      headingFont: "playfair",
      bodyFont: "lora",
      principle: "Warm editorial serifs for hospitality",
    },
    spacing: "comfortable",
    borderRadius: "soft",
    elevation: "subtle",
    colorStrategy: {
      primary: "#c45c26",
      secondary: "#2a1810",
      accent: "#e8a87c",
      background: "#faf6f1",
      theme: "light",
      principle: "Warm food-forward colors",
    },
    imageryStyle: "food_first",
    iconStyle: "line",
    motionStyle: "subtle",
    layoutDensity: "balanced",
    buttonLanguage: "friendly",
    sectionHierarchy: [HERO, GALLERY, SERVICES, ABOUT, CONTACT],
    templateId: "elegant",
    buttonStyle: "soft-rounded",
    siteWidth: "wide",
    heroOverlay: 45,
    imageryKeywords: ["food", "dish", "menu", "kitchen", "dining", "plate"],
    principle: "food-first photography and inviting hospitality",
  },
  trades: {
    id: "trades",
    label: "Trades",
    typography: {
      headingFont: "poppins",
      bodyFont: "inter",
      principle: "Bold, readable sans for quick scanning",
    },
    spacing: "compact",
    borderRadius: "soft",
    elevation: "lifted",
    colorStrategy: {
      primary: "#ea580c",
      secondary: "#0a0a0a",
      accent: "#f97316",
      background: "#ffffff",
      theme: "light",
      principle: "High-visibility CTA colors on a clean canvas",
    },
    imageryStyle: "before_after",
    iconStyle: "filled",
    motionStyle: "subtle",
    layoutDensity: "dense",
    buttonLanguage: "urgent",
    sectionHierarchy: [HERO, SERVICES, GALLERY, ABOUT, CONTACT],
    templateId: "bold",
    buttonStyle: "pill",
    siteWidth: "wide",
    heroOverlay: 55,
    imageryKeywords: ["before", "after", "job", "work", "crew", "truck"],
    principle: "phone-first CTAs, proof photos, and trust signals",
  },
  creative: {
    id: "creative",
    label: "Creative",
    typography: {
      headingFont: "manrope",
      bodyFont: "inter",
      principle: "Distinctive modern sans",
    },
    spacing: "comfortable",
    borderRadius: "rounded",
    elevation: "dramatic",
    colorStrategy: {
      primary: "#7c3aed",
      secondary: "#0f0a1a",
      accent: "#a78bfa",
      background: "#0c0a12",
      theme: "dark",
      principle: "Expressive accents on a dark stage",
    },
    imageryStyle: "portfolio",
    iconStyle: "duotone",
    motionStyle: "cinematic",
    layoutDensity: "balanced",
    buttonLanguage: "confident",
    sectionHierarchy: [HERO, GALLERY, FEATURES, SERVICES, CONTACT],
    templateId: "modern",
    buttonStyle: "rounded",
    siteWidth: "full",
    heroOverlay: 50,
    imageryKeywords: ["portfolio", "creative", "studio", "art", "project"],
    principle: "agency-grade expression with portfolio emphasis",
  },
  premium_saas: {
    id: "premium_saas",
    label: "Premium SaaS",
    typography: {
      headingFont: "inter",
      bodyFont: "inter",
      principle: "Apple-like simplicity — precise sans hierarchy",
    },
    spacing: "generous",
    borderRadius: "rounded",
    elevation: "subtle",
    colorStrategy: {
      primary: "#0ea5e9",
      secondary: "#0f172a",
      accent: "#38bdf8",
      background: "#f8fafc",
      theme: "light",
      principle: "Soft neutrals with a focused product accent",
    },
    imageryStyle: "product_focus",
    iconStyle: "line",
    motionStyle: "subtle",
    layoutDensity: "airy",
    buttonLanguage: "confident",
    sectionHierarchy: [HERO, FEATURES, SERVICES, ABOUT, CONTACT],
    templateId: "minimal",
    buttonStyle: "rounded",
    siteWidth: "wide",
    heroOverlay: 20,
    imageryKeywords: ["product", "ui", "dashboard", "screenshot", "interface"],
    principle: "Apple-like simplicity with product-led clarity",
  },
  photography: {
    id: "photography",
    label: "Photography",
    typography: {
      headingFont: "playfair",
      bodyFont: "inter",
      principle: "Quiet type that lets imagery lead",
    },
    spacing: "generous",
    borderRadius: "sharp",
    elevation: "flat",
    colorStrategy: {
      primary: "#e5e5e5",
      secondary: "#0a0a0a",
      accent: "#ffffff",
      background: "#0a0a0a",
      theme: "dark",
      principle: "Near-black stage so photos dominate",
    },
    imageryStyle: "portfolio",
    iconStyle: "none",
    motionStyle: "restrained",
    layoutDensity: "airy",
    buttonLanguage: "quiet",
    sectionHierarchy: [HERO, GALLERY, ABOUT, SERVICES, CONTACT],
    templateId: "elegant",
    buttonStyle: "square",
    siteWidth: "full",
    heroOverlay: 25,
    imageryKeywords: ["photo", "portrait", "landscape", "studio", "portfolio"],
    principle: "imagery-first presentation with quiet chrome",
  },
  scandinavian: {
    id: "scandinavian",
    label: "Scandinavian",
    typography: {
      headingFont: "inter",
      bodyFont: "inter",
      principle: "Light, functional sans",
    },
    spacing: "generous",
    borderRadius: "soft",
    elevation: "flat",
    colorStrategy: {
      primary: "#6b8f71",
      secondary: "#2c2c2c",
      accent: "#a3b18a",
      background: "#f7f5f0",
      theme: "light",
      principle: "Soft naturals, light wood-adjacent neutrals",
    },
    imageryStyle: "minimal_negative_space",
    iconStyle: "line",
    motionStyle: "none",
    layoutDensity: "airy",
    buttonLanguage: "quiet",
    sectionHierarchy: [HERO, ABOUT, SERVICES, GALLERY, CONTACT],
    templateId: "minimal",
    buttonStyle: "rounded",
    siteWidth: "wide",
    heroOverlay: 25,
    imageryKeywords: ["nordic", "natural", "wood", "light", "calm"],
    principle: "calm function, soft nature, and generous air",
  },
  boutique: {
    id: "boutique",
    label: "Boutique",
    typography: {
      headingFont: "playfair",
      bodyFont: "lora",
      principle: "Intimate serif branding",
    },
    spacing: "comfortable",
    borderRadius: "soft",
    elevation: "subtle",
    colorStrategy: {
      primary: "#9a6b5a",
      secondary: "#2a1f1c",
      accent: "#d4a5a5",
      background: "#f9f4f1",
      theme: "light",
      principle: "Soft blush and cocoa boutique tones",
    },
    imageryStyle: "warm_lifestyle",
    iconStyle: "line",
    motionStyle: "restrained",
    layoutDensity: "balanced",
    buttonLanguage: "refined",
    sectionHierarchy: [HERO, GALLERY, SERVICES, ABOUT, CONTACT],
    templateId: "elegant",
    buttonStyle: "soft-rounded",
    siteWidth: "boxed",
    heroOverlay: 40,
    imageryKeywords: ["boutique", "handmade", "atelier", "detail", "soft"],
    principle: "intimate craft and curated presentation",
  },
};

/** Alias phrases → language id (deterministic). */
const LANGUAGE_ALIASES: Array<{ pattern: RegExp; id: DesignLanguageId }> = [
  { pattern: /\b(scandi(navian)?|nordic|hygge)\b/i, id: "scandinavian" },
  { pattern: /\b(apple[- ]?like|saas|software|product[- ]led)\b/i, id: "premium_saas" },
  { pattern: /\b(luxur(y|ious)|premium|high[- ]end|opulent)\b/i, id: "luxury" },
  { pattern: /\b(minimal(ist)?|simple|stripped[- ]back)\b/i, id: "minimal" },
  { pattern: /\b(modern|contemporary)\b/i, id: "modern" },
  { pattern: /\b(corporate|enterprise|b2b)\b/i, id: "corporate" },
  { pattern: /\b(friendly|welcoming|approachable|warm)\b/i, id: "friendly" },
  { pattern: /\b(playful|fun|quirky|vibrant)\b/i, id: "playful" },
  { pattern: /\b(editorial|magazine|broadsheet)\b/i, id: "editorial" },
  { pattern: /\b(industrial|raw|warehouse)\b/i, id: "industrial" },
  { pattern: /\b(medical|clinic|dental|healthcare|doctor|hospital)\b/i, id: "medical" },
  { pattern: /\b(restaurant|cafe|café|coffee|bakery|food|dining|catering)\b/i, id: "restaurant" },
  { pattern: /\b(trade|trades|contractor|plumber|electrician|hvac|roofing)\b/i, id: "trades" },
  { pattern: /\b(creative|agency|studio|design\s+agency)\b/i, id: "creative" },
  { pattern: /\b(photograph(y|er)|portfolio\s+site)\b/i, id: "photography" },
  { pattern: /\b(boutique|atelier|salon|spa)\b/i, id: "boutique" },
];

const INDUSTRY_MAP: Array<{
  pattern: RegExp;
  id: DesignLanguageId;
  weight: number;
}> = [
  { pattern: /\b(restaurant|cafe|café|coffee|bakery|food|catering)\b/i, id: "restaurant", weight: 0.92 },
  { pattern: /\b(clinic|dental|medical|doctor|healthcare|hospital|physio)\b/i, id: "medical", weight: 0.94 },
  { pattern: /\b(contractor|plumber|electrician|hvac|roofing|landscap)/i, id: "trades", weight: 0.93 },
  { pattern: /\b(photograph|photo\s+studio)\b/i, id: "photography", weight: 0.9 },
  { pattern: /\b(agency|studio|designer|creative)\b/i, id: "creative", weight: 0.86 },
  { pattern: /\b(saas|software|app|platform)\b/i, id: "premium_saas", weight: 0.88 },
  { pattern: /\b(salon|spa|boutique)\b/i, id: "boutique", weight: 0.85 },
  { pattern: /\b(real\s+estate|realtor)\b/i, id: "corporate", weight: 0.8 },
  { pattern: /\b(gym|fitness)\b/i, id: "modern", weight: 0.78 },
  { pattern: /\b(retail|store|shop)\b/i, id: "modern", weight: 0.72 },
];

const BUSINESS_TYPE_MAP: Partial<Record<string, DesignLanguageId>> = {
  "Coffee Shop": "restaurant",
  Restaurant: "restaurant",
  "Retail Store": "modern",
  Salon: "boutique",
  Gym: "modern",
  Contractor: "trades",
  "Real Estate": "corporate",
  Other: "modern",
};

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function scoreLanguage(
  id: DesignLanguageId,
  input: DesignSystemInput,
): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];
  const blob = [
    input.businessType ?? "",
    input.industry ?? "",
    input.brandPersonality ?? "",
    input.userGoal ?? "",
    ...(input.goals ?? []).map(String),
    input.memory?.businessTone ?? "",
    input.memory?.imageStyle ?? "",
    ...(input.memory?.preferredLayouts ?? []),
    ...(input.memory?.notes ?? []),
  ]
    .join(" ")
    .toLowerCase();

  if (input.preferredLanguage === id) {
    score += 2.5;
    reasons.push("explicit preference");
  }

  // Strong weight for design cues in the active user request (beats industry defaults).
  const goalText = (input.userGoal ?? "").toLowerCase();
  if (goalText) {
    for (const alias of LANGUAGE_ALIASES) {
      if (alias.id === id && alias.pattern.test(goalText)) {
        score += 1.6;
        reasons.push(`request asked for ${DESIGN_LANGUAGES[id].label}`);
        break;
      }
    }
  }

  for (const alias of LANGUAGE_ALIASES) {
    if (alias.id === id && alias.pattern.test(blob)) {
      score += 0.85;
      reasons.push(`matched “${DESIGN_LANGUAGES[id].label}” language cues`);
      break;
    }
  }

  const typeId = BUSINESS_TYPE_MAP[String(input.businessType ?? "")];
  if (typeId === id) {
    score += 0.7;
    reasons.push(`fits ${input.businessType} businesses`);
  }

  for (const row of INDUSTRY_MAP) {
    if (row.id === id && row.pattern.test(blob)) {
      score += row.weight;
      reasons.push("industry mapping");
      break;
    }
  }

  const tone = (input.memory?.businessTone ?? "").toLowerCase();
  if (tone) {
    if (id === "luxury" && /\b(luxury|premium|elegant)\b/.test(tone)) {
      score += 0.55;
      reasons.push("memory: luxury tone");
    }
    if (id === "friendly" && /\b(warm|friendly)\b/.test(tone)) {
      score += 0.5;
      reasons.push("memory: warm tone");
    }
    if (id === "corporate" && /\b(professional|corporate)\b/.test(tone)) {
      score += 0.5;
      reasons.push("memory: professional tone");
    }
    if (id === "minimal" && /\bminimal/.test(tone)) {
      score += 0.45;
      reasons.push("memory: minimal tone");
    }
  }

  const layouts = (input.memory?.preferredLayouts ?? []).join(" ").toLowerCase();
  if (layouts) {
    if (id === "minimal" && /minimal/.test(layouts)) {
      score += 0.4;
      reasons.push("memory: minimalist layout");
    }
    if (id === "luxury" && /elegant/.test(layouts)) {
      score += 0.35;
      reasons.push("memory: elegant layout");
    }
    if (id === "industrial" && /bold/.test(layouts)) {
      score += 0.3;
      reasons.push("memory: bold layout");
    }
  }

  const imageStyle = (input.memory?.imageStyle ?? "").toLowerCase();
  if (imageStyle === "warm" && (id === "restaurant" || id === "friendly" || id === "boutique")) {
    score += 0.35;
    reasons.push("memory: warm imagery");
  }

  const goals = (input.goals ?? []).map(String).join(" ").toLowerCase();
  const userGoal = (input.userGoal ?? "").toLowerCase();
  const goalBlob = `${goals} ${userGoal}`;
  if (/\b(phone|call|lead|book|order|customer)\b/.test(goalBlob) && id === "trades") {
    score += 0.25;
    reasons.push("conversion-oriented goal");
  }
  if (/\b(portfolio|display)\b/.test(goalBlob) && (id === "photography" || id === "creative")) {
    score += 0.4;
    reasons.push("portfolio goal");
  }
  if (/\b(online\s+orders?|catering)\b/.test(goalBlob) && id === "restaurant") {
    score += 0.35;
    reasons.push("food / order goal");
  }
  if (/\b(appointments?|book)\b/.test(goalBlob) && (id === "medical" || id === "boutique")) {
    score += 0.25;
    reasons.push("appointment goal");
  }

  if (input.current?.language === id) {
    score += 0.15;
    reasons.push("already selected");
  }

  return { score, reasons };
}

function buildExplanation(
  def: LanguageDefinition,
  reasons: string[],
  confidence: number,
): string {
  const why =
    reasons[0] ??
    `your ${def.label.toLowerCase()} brand cues`;
  return `Based on your business and goals, I chose a ${def.label.toLowerCase()} design language because it emphasizes ${def.principle}. (${why}; confidence ${Math.round(confidence * 100)}%)`;
}

function spacingToPolish(
  spacing: SpacingStrategy,
): "default" | "comfortable" | "airy" {
  if (spacing === "generous") return "airy";
  if (spacing === "comfortable") return "comfortable";
  return "default";
}

function motionEnabled(motion: MotionStyle): boolean {
  return motion !== "none";
}

/**
 * Build concrete edit operations that realize a DesignSystem on a project.
 */
export function designSystemToOperations(
  system: DesignSystem,
): EditOperation[] {
  return [
    {
      operation: "setTemplate",
      value: system.templateId,
    },
    {
      operation: "setTypography",
      headingFont: system.typography.headingFont,
      bodyFont: system.typography.bodyFont,
    },
    {
      operation: "changeTheme",
      primary: system.colorStrategy.primary,
      secondary: system.colorStrategy.secondary,
      accent: system.colorStrategy.accent,
      background: system.colorStrategy.background,
      theme: system.colorStrategy.theme,
    },
    {
      operation: "setButtonStyle",
      value: system.buttonStyle,
    },
    {
      operation: "setSiteWidth",
      value: system.siteWidth,
    },
    {
      operation: "setCreativePolish",
      serviceIcons: system.iconStyle !== "none",
      motion: motionEnabled(system.motionStyle),
      visualHierarchy: true,
      spacing: spacingToPolish(system.spacing),
    },
  ];
}

function toDesignSystem(
  def: LanguageDefinition,
  confidence: number,
  reasons: string[],
): DesignSystem {
  return {
    language: def.id,
    label: def.label,
    typography: def.typography,
    spacing: def.spacing,
    borderRadius: def.borderRadius,
    elevation: def.elevation,
    colorStrategy: def.colorStrategy,
    imageryStyle: def.imageryStyle,
    iconStyle: def.iconStyle,
    motionStyle: def.motionStyle,
    layoutDensity: def.layoutDensity,
    buttonLanguage: def.buttonLanguage,
    sectionHierarchy: def.sectionHierarchy,
    templateId: def.templateId,
    buttonStyle: def.buttonStyle,
    siteWidth: def.siteWidth,
    heroOverlay: def.heroOverlay,
    explanation: buildExplanation(def, reasons, confidence),
    confidence,
    selectedAt: new Date().toISOString(),
  };
}

/**
 * Resolve the best design language for the given context (deterministic).
 */
export function resolveDesignSystem(
  input: DesignSystemInput,
): DesignSystemResolution {
  const ranked = DESIGN_LANGUAGE_IDS.map((id) => {
    const { score, reasons } = scoreLanguage(id, input);
    return { id, score, reasons };
  }).sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.id.localeCompare(b.id);
  });

  const top = ranked[0]!;
  const second = ranked[1]?.score ?? 0;
  const raw = top.score;
  // Normalize: strong unique winner → high confidence
  const margin = raw - second;
  const confidence = clamp01(0.45 + raw * 0.28 + margin * 0.2);

  const def = DESIGN_LANGUAGES[top.id];
  const designSystem = toDesignSystem(def, confidence, top.reasons);
  const autoApply =
    confidence >= AUTO_APPLY_CONFIDENCE || Boolean(input.preferredLanguage);

  return {
    designSystem,
    autoApply,
    operations: designSystemToOperations(designSystem),
    imageryKeywords: [...def.imageryKeywords],
  };
}

/**
 * Detect an explicit design-language request from free text.
 */
export function detectPreferredLanguage(
  text: string,
): DesignLanguageId | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  for (const alias of LANGUAGE_ALIASES) {
    if (alias.pattern.test(trimmed)) return alias.id;
  }
  return null;
}

/**
 * Build DesignSystemInput from a live BusinessProject + optional request.
 */
export function designSystemInputFromProject(
  project: BusinessProject,
  request?: string,
): DesignSystemInput {
  const fromRequest = request ? detectPreferredLanguage(request) : null;

  let current: DesignSystem | null = null;
  if (project.designSystem && isDesignLanguageId(project.designSystem.language)) {
    const def = DESIGN_LANGUAGES[project.designSystem.language];
    current = toDesignSystem(
      def,
      project.designSystem.confidence,
      ["already selected"],
    );
    current.explanation = project.designSystem.explanation;
    current.selectedAt = project.designSystem.selectedAt;
  }

  return {
    businessType: project.businessType,
    industry: [project.businessType, project.description]
      .filter(Boolean)
      .join(" "),
    goals: project.goals,
    brandPersonality: project.atlasMemory?.businessTone,
    userGoal: request ?? project.atlasMemory?.primaryGoal,
    memory: project.atlasMemory,
    preferredLanguage: fromRequest,
    current,
  };
}

export function toPersistedDesignSystem(
  system: DesignSystem,
): PersistedDesignSystem {
  return {
    language: system.language,
    label: system.label,
    imageryStyle: system.imageryStyle,
    motionStyle: system.motionStyle,
    explanation: system.explanation,
    confidence: system.confidence,
    selectedAt: system.selectedAt,
  };
}

/**
 * Apply a resolved design system onto a project (ops + persisted snapshot).
 */
export function attachDesignSystem(
  project: BusinessProject,
  system: DesignSystem,
): BusinessProject {
  return {
    ...project,
    designSystem: toPersistedDesignSystem(system),
    heroOverlay: system.heroOverlay as BusinessProject["heroOverlay"],
    atlasMemory: {
      ...(project.atlasMemory ?? {}),
      businessTone: project.atlasMemory?.businessTone ?? system.language,
      imageStyle:
        project.atlasMemory?.imageStyle ??
        DESIGN_LANGUAGES[system.language].imageryKeywords[0],
      preferredLayouts: [
        ...(project.atlasMemory?.preferredLayouts ?? []),
        system.language,
      ].slice(-6),
      updatedAt: new Date().toISOString(),
    },
  };
}

/** Keywords Visual Designer can use to bias asset selection. */
export function imageryKeywordsForProject(
  project: BusinessProject,
): string[] {
  const language = project.designSystem?.language;
  if (isDesignLanguageId(language)) {
    return [...DESIGN_LANGUAGES[language].imageryKeywords];
  }
  if (project.atlasMemory?.imageStyle) {
    return [project.atlasMemory.imageStyle];
  }
  return [];
}

/** Creative Director / Brain copy that references the active system. */
export function formatDesignSystemReference(
  system: DesignSystem | PersistedDesignSystem | null | undefined,
): string {
  if (!system) return "";
  return `Design language: ${system.label} — ${system.explanation}`;
}

export function isDesignLanguageId(value: unknown): value is DesignLanguageId {
  return (
    typeof value === "string" &&
    (DESIGN_LANGUAGE_IDS as readonly string[]).includes(value)
  );
}

export { AUTO_APPLY_CONFIDENCE };
