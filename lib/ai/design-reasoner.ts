/**
 * Goal-based design reasoning (Sprint 22.1).
 * Converts business goals / emotional feedback into strategies + edit objectives
 * before structured operations are generated.
 */

import type { EditOperation } from "@/lib/ai/edit-operations";
import type { BusinessProject } from "@/types/business-project";

export const DESIGN_GOAL_CATEGORIES = [
  "increase_phone_calls",
  "increase_bookings",
  "increase_trust",
  "modernize_appearance",
  "luxury_branding",
  "improve_readability",
  "improve_seo",
  "improve_accessibility",
  "improve_conversions",
  "increase_leads",
  "unknown",
] as const;

export type DesignGoalCategory = (typeof DESIGN_GOAL_CATEGORIES)[number];

export type DesignReasonerHistoryItem = {
  role: "user" | "assistant";
  content: string;
};

export type DesignReasonerInput = {
  request: string;
  project: BusinessProject;
  history?: DesignReasonerHistoryItem[];
};

export type DesignReasoningResult = {
  goal: DesignGoalCategory;
  /** 0–1 confidence in the inferred goal. */
  confidence: number;
  /** Short human-readable goal label. */
  inferredGoal: string;
  /** Design strategy narrative for the assistant reply. */
  designStrategy: string;
  /** Concrete objectives the editor will pursue. */
  editObjectives: string[];
  /** When confidence is too low to act safely. */
  followUpQuestion: string | null;
  /** Whether the agent should apply ops vs ask a question. */
  shouldAct: boolean;
};

const HIGH_CONFIDENCE = 0.72;
const MEDIUM_CONFIDENCE = 0.55;

type GoalRule = {
  goal: DesignGoalCategory;
  patterns: RegExp[];
  weight: number;
  inferredGoal: string;
  designStrategy: string;
  editObjectives: string[];
};

const GOAL_RULES: GoalRule[] = [
  {
    goal: "increase_phone_calls",
    patterns: [
      /\b(more\s+)?(people\s+)?call\b/,
      /\bphone\s+calls?\b/,
      /\bget\s+(more\s+)?calls?\b/,
      /\bcall\s+me\b/,
      /\bring\s+(the\s+)?(phone|me)\b/,
      /\bwant\s+.*\bcall/,
    ],
    weight: 0.92,
    inferredGoal: "Increase phone calls",
    designStrategy:
      "Make calling the obvious next step: strengthen the primary CTA, surface the phone number, and add social proof.",
    editObjectives: [
      "Rewrite the primary CTA toward calling",
      "Highlight contact phone in the contact section",
      "Add testimonials to build trust before the call",
    ],
  },
  {
    goal: "increase_bookings",
    patterns: [
      /\bbookings?\b/,
      /\bbook\s+(more|appointments?|clients?|customers?)\b/,
      /\bschedule\b/,
      /\bappointments?\b/,
      /\breservations?\b/,
    ],
    weight: 0.9,
    inferredGoal: "Increase bookings",
    designStrategy:
      "Push visitors toward booking with a clearer CTA, booking-focused hero copy, and a booking callout section.",
    editObjectives: [
      "Update hero CTA toward booking",
      "Clarify hero offer around scheduling",
      "Add a booking CTA section",
    ],
  },
  {
    goal: "increase_leads",
    patterns: [
      /\bleads?\b/,
      /\bcapture\s+(more\s+)?(leads?|emails?)\b/,
      /\bgenerate\s+(more\s+)?leads?\b/,
      /\bneed\s+more\s+leads?\b/,
      /\bget\s+more\s+(inquir(?:y|ies)|clients?|customers?)\b/,
      /\bcontact\s+form\b/,
    ],
    weight: 0.9,
    inferredGoal: "Increase leads",
    designStrategy:
      "Optimize for lead capture: clearer conversion CTA, stronger contact prompt, and optional newsletter capture.",
    editObjectives: [
      "Strengthen primary CTA for inquiries",
      "Improve contact section conversion copy",
      "Add a newsletter or lead-capture section",
    ],
  },
  {
    goal: "improve_conversions",
    patterns: [
      /\bconvert(?:s|ing)?\b/,
      /\bconversion\b/,
      /\bsales?\b/,
      /\bclose\s+more\b/,
      /\bwin\s+more\s+(customers?|clients?)\b/,
      /\bmore\s+(customers?|clients?|business)\b/,
    ],
    weight: 0.84,
    inferredGoal: "Improve conversions",
    designStrategy:
      "Tighten the conversion path: clearer value proposition, stronger CTA, and trust signals near the action.",
    editObjectives: [
      "Sharpen hero headline and CTA",
      "Add testimonials for social proof",
      "Improve contact CTA wording",
    ],
  },
  {
    goal: "increase_trust",
    patterns: [
      /\btrust\b/,
      /\bcredible\b/,
      /\bprofessional\s+look\b/,
      /\bsocial\s+proof\b/,
      /\bfeel\s+more\s+(legit|trustworthy|reliable)\b/,
      /\breviews?\b/,
      /\btestimonial/,
    ],
    weight: 0.86,
    inferredGoal: "Increase trust",
    designStrategy:
      "Build credibility with testimonials, clearer about copy, and a calmer professional visual tone.",
    editObjectives: [
      "Add testimonials",
      "Strengthen about copy",
      "Apply a professional visual direction",
    ],
  },
  {
    goal: "modernize_appearance",
    patterns: [
      /\boutdated\b/,
      /\bold[- ]?fashioned\b/,
      /\bstale\b/,
      /\bdated\b/,
      /\bmoderni[sz]e\b/,
      /\bfeel(?:s)?\s+outdated\b/,
      /\blook(?:s)?\s+(old|outdated|dated)\b/,
      /\bfresh\s+(look|design)\b/,
      /\bupdate\s+the\s+(look|design|style)\b/,
    ],
    weight: 0.88,
    inferredGoal: "Modernize appearance",
    designStrategy:
      "Refresh layout, typography, and hero messaging so the site feels current without requiring technical design jargon.",
    editObjectives: [
      "Apply a modern layout and typography",
      "Refresh hero messaging",
      "Update button styling",
    ],
  },
  {
    goal: "luxury_branding",
    patterns: [
      /\bluxur(?:y|ious)\b/,
      /\bpremium\b/,
      /\belegant\b/,
      /\bsophisticated\b/,
      /\bhigh[- ]end\b/,
      /\bupscale\b/,
    ],
    weight: 0.9,
    inferredGoal: "Luxury branding",
    designStrategy:
      "Shift toward an elegant, premium visual system with refined typography and spacious layout.",
    editObjectives: [
      "Apply luxury template and fonts",
      "Use a refined color atmosphere",
      "Elevate hero copy tone",
    ],
  },
  {
    goal: "improve_readability",
    patterns: [
      /\breadability\b/,
      /\beasier\s+to\s+read\b/,
      /\bhard\s+to\s+read\b/,
      /\bcluttered\b/,
      /\bcrowded\b/,
      /\btoo\s+dense\b/,
      /\bmore\s+(space|whitespace|breathing\s+room)\b/,
      /\bsimplif(?:y|ier)\b/,
    ],
    weight: 0.85,
    inferredGoal: "Improve readability",
    designStrategy:
      "Reduce visual density: more whitespace, clearer type hierarchy, and shorter navigation labels.",
    editObjectives: [
      "Increase whitespace via site width",
      "Simplify navigation labels",
      "Clarify hero subheadline",
    ],
  },
  {
    goal: "improve_seo",
    patterns: [
      /\bseo\b/,
      /\bsearch\s+engine\b/,
      /\bgoogle\b/,
      /\brank(?:ing)?\b/,
      /\bmeta\s+description\b/,
      /\bfind\s+(us|me)\s+online\b/,
    ],
    weight: 0.9,
    inferredGoal: "Improve SEO",
    designStrategy:
      "Improve on-page SEO metadata so the site is clearer in search and social previews.",
    editObjectives: [
      "Update site title",
      "Update meta description",
      "Align social titles with the offer",
    ],
  },
  {
    goal: "improve_accessibility",
    patterns: [
      /\baccessibility\b/,
      /\ba11y\b/,
      /\bwcag\b/,
      /\bcontrast\b/,
      /\bhard\s+to\s+see\b/,
      /\breadable\s+for\s+everyone\b/,
    ],
    weight: 0.88,
    inferredGoal: "Improve accessibility",
    designStrategy:
      "Improve contrast and clarity so text and actions remain readable across the page.",
    editObjectives: [
      "Increase contrast between background and accents",
      "Prefer clearer button styling",
      "Keep copy concise and scannable",
    ],
  },
];

const AMBIGUOUS_DISLIKE = [
  /\bi\s+don'?t\s+like\s+(it|this|that)\b/,
  /\bdon'?t\s+like\s+(it|this)\b/,
  /\bhate\s+(it|this)\b/,
  /\bthis\s+(sucks|is\s+bad|is\s+awful)\b/,
  /\bnot\s+feeling\s+(it|this)\b/,
  /\bsomething(?:'s|\s+is)\s+off\b/,
  /\bfeels?\s+wrong\b/,
  /\bmeh\b/,
  /\bugh\b/,
];

const AMBIGUOUS_VAGUE = [
  /\bmake\s+it\s+better\b/,
  /\bfix\s+(it|this)\b/,
  /\bimprove\s+(it|this)\b/,
  /\bdo\s+something\b/,
  /\bhelp\b$/,
  /\bidk\b/,
  /\bnot\s+sure\b/,
];

/**
 * Infer the user's business / design goal from natural language.
 */
export function reasonAboutDesign(
  input: DesignReasonerInput,
): DesignReasoningResult {
  const request = input.request.trim();
  const text = request.toLowerCase();
  const historyText = (input.history ?? [])
    .slice(-6)
    .map((m) => m.content)
    .join(" ")
    .toLowerCase();
  const combined = `${historyText}\n${text}`;

  if (!request) {
    return unknownResult(
      "What would you like to improve about this website?",
    );
  }

  // Emotional / vague feedback → ask, don't invent a redesign.
  if (AMBIGUOUS_DISLIKE.some((p) => p.test(text))) {
    return {
      goal: "unknown",
      confidence: 0.25,
      inferredGoal: "Unknown",
      designStrategy: "Clarify what feels off before editing.",
      editObjectives: [],
      followUpQuestion:
        "What feels off — the colors, the layout, the wording, or something else?",
      shouldAct: false,
    };
  }

  if (AMBIGUOUS_VAGUE.some((p) => p.test(text)) && text.split(/\s+/).length < 8) {
    return {
      goal: "unknown",
      confidence: 0.3,
      inferredGoal: "Unknown",
      designStrategy: "Clarify the outcome before editing.",
      editObjectives: [],
      followUpQuestion:
        "What outcome matters most — more calls, more bookings, a fresher look, or stronger trust?",
      shouldAct: false,
    };
  }

  let best: { rule: GoalRule; score: number } | null = null;
  for (const rule of GOAL_RULES) {
    let hits = 0;
    for (const pattern of rule.patterns) {
      if (pattern.test(combined)) hits += 1;
    }
    if (hits === 0) continue;
    const score = Math.min(0.98, rule.weight + (hits - 1) * 0.03);
    if (!best || score > best.score) best = { rule, score };
  }

  if (!best) {
    return unknownResult(
      "What should we improve first — more calls, more leads, a modern look, or something else?",
    );
  }

  const confidence = best.score;
  const shouldAct = confidence >= HIGH_CONFIDENCE;

  if (!shouldAct && confidence < MEDIUM_CONFIDENCE) {
    return {
      goal: best.rule.goal,
      confidence,
      inferredGoal: best.rule.inferredGoal,
      designStrategy: best.rule.designStrategy,
      editObjectives: best.rule.editObjectives,
      followUpQuestion: followUpForGoal(best.rule.goal),
      shouldAct: false,
    };
  }

  if (!shouldAct) {
    // Medium confidence — still ask one concise confirm-style question when vague.
    return {
      goal: best.rule.goal,
      confidence,
      inferredGoal: best.rule.inferredGoal,
      designStrategy: best.rule.designStrategy,
      editObjectives: best.rule.editObjectives,
      followUpQuestion: followUpForGoal(best.rule.goal),
      shouldAct: false,
    };
  }

  return {
    goal: best.rule.goal,
    confidence,
    inferredGoal: best.rule.inferredGoal,
    designStrategy: best.rule.designStrategy,
    editObjectives: best.rule.editObjectives,
    followUpQuestion: null,
    shouldAct: true,
  };
}

function unknownResult(followUpQuestion: string): DesignReasoningResult {
  return {
    goal: "unknown",
    confidence: 0.15,
    inferredGoal: "Unknown",
    designStrategy: "Ask a concise follow-up before changing the site.",
    editObjectives: [],
    followUpQuestion,
    shouldAct: false,
  };
}

function followUpForGoal(goal: DesignGoalCategory): string {
  switch (goal) {
    case "increase_phone_calls":
      return "Should I emphasize calling in the main button and show your phone number more clearly?";
    case "increase_bookings":
      return "Should I push visitors toward booking with a stronger CTA and booking section?";
    case "increase_leads":
      return "Should I optimize the site to capture more inquiries and contact form leads?";
    case "improve_conversions":
      return "Should I tighten the hero and CTA so more visitors take action?";
    case "increase_trust":
      return "Should I add testimonials and more trustworthy about copy?";
    case "modernize_appearance":
      return "Should I refresh the layout and typography to feel more modern?";
    case "luxury_branding":
      return "Should I shift the site toward a more luxurious, premium look?";
    case "improve_readability":
      return "Should I add more whitespace and simplify the page for easier reading?";
    case "improve_seo":
      return "Should I update your SEO titles and descriptions?";
    case "improve_accessibility":
      return "Should I improve contrast and clarity for accessibility?";
    default:
      return "What would you like to change about this website?";
  }
}

/**
 * Turn a high-confidence reasoning result into structured edit operations.
 */
export function operationsFromDesignReasoning(
  reasoning: DesignReasoningResult,
  project: BusinessProject,
): EditOperation[] {
  if (!reasoning.shouldAct) return [];

  const name = project.businessName || "your business";
  const phone = project.contact.phone?.trim() || "(555) 010-2000";
  const ops: EditOperation[] = [];

  switch (reasoning.goal) {
    case "increase_phone_calls":
      ops.push({
        operation: "replaceText",
        target: "hero.primaryCta",
        value: "Call now",
      });
      ops.push({
        operation: "replaceText",
        target: "hero.subheadline",
        value: `Talk with ${name} today — call ${phone} and get clear next steps fast.`,
      });
      ops.push({
        operation: "replaceText",
        target: "contact.title",
        value: "Call us",
      });
      ops.push({
        operation: "replaceText",
        target: "contact.description",
        value: `Prefer to talk? Call ${phone} and we’ll help you get started.`,
      });
      ops.push({
        operation: "replaceText",
        target: "contact.buttonText",
        value: "Request a call back",
      });
      ops.push({ operation: "insertSection", type: "testimonials" });
      break;

    case "increase_bookings":
      ops.push({
        operation: "replaceText",
        target: "hero.primaryCta",
        value: "Book now",
      });
      ops.push({
        operation: "replaceText",
        target: "hero.title",
        value: `Book with ${name}`,
      });
      ops.push({
        operation: "replaceText",
        target: "hero.subheadline",
        value: "Pick a time that works — we’ll confirm quickly and make the next step easy.",
      });
      ops.push({ operation: "insertSection", type: "bookingCta" });
      ops.push({ operation: "insertSection", type: "faq" });
      break;

    case "increase_leads":
      ops.push({
        operation: "replaceText",
        target: "hero.primaryCta",
        value: "Get a free quote",
      });
      ops.push({
        operation: "replaceText",
        target: "hero.subheadline",
        value: "Tell us what you need — we’ll reply with a clear plan and next step.",
      });
      ops.push({
        operation: "replaceText",
        target: "contact.title",
        value: "Request a quote",
      });
      ops.push({
        operation: "replaceText",
        target: "contact.buttonText",
        value: "Send my request",
      });
      ops.push({ operation: "insertSection", type: "newsletter" });
      break;

    case "improve_conversions":
      ops.push({
        operation: "replaceText",
        target: "hero.title",
        value: `${name} — results that move you forward`,
      });
      ops.push({
        operation: "replaceText",
        target: "hero.primaryCta",
        value: "Get started",
      });
      ops.push({
        operation: "replaceText",
        target: "hero.subheadline",
        value: "A clear offer, a confident next step, and a path designed to convert visitors into customers.",
      });
      ops.push({ operation: "insertSection", type: "testimonials" });
      ops.push({
        operation: "replaceText",
        target: "contact.buttonText",
        value: "Start the conversation",
      });
      break;

    case "increase_trust":
      ops.push({ operation: "insertSection", type: "testimonials" });
      ops.push({
        operation: "replaceText",
        target: "about.body",
        value: `${name} is built on clear communication, reliable delivery, and a reputation customers can count on. We’re here to make every interaction feel professional and straightforward.`,
      });
      ops.push({
        operation: "changeTheme",
        background: "#f7f8fa",
        secondary: "#1a1f26",
        theme: "light",
      });
      ops.push({
        operation: "setTypography",
        headingFont: "inter",
        bodyFont: "inter",
      });
      break;

    case "modernize_appearance":
      ops.push({ operation: "setTemplate", value: "modern" });
      ops.push({
        operation: "setTypography",
        headingFont: "manrope",
        bodyFont: "manrope",
      });
      ops.push({ operation: "setButtonStyle", value: "rounded" });
      ops.push({ operation: "setSiteWidth", value: "full" });
      ops.push({
        operation: "replaceText",
        target: "hero.title",
        value: `${name}, reimagined`,
      });
      ops.push({
        operation: "replaceText",
        target: "hero.subheadline",
        value: "A cleaner layout, clearer messaging, and a modern experience for every visitor.",
      });
      break;

    case "luxury_branding":
      ops.push({ operation: "setTemplate", value: "elegant" });
      ops.push({
        operation: "setTypography",
        headingFont: "playfair",
        bodyFont: "lora",
      });
      ops.push({ operation: "setButtonStyle", value: "square" });
      ops.push({ operation: "setSiteWidth", value: "boxed" });
      ops.push({
        operation: "changeTheme",
        background: "#faf8f5",
        secondary: "#161412",
        theme: "light",
      });
      ops.push({
        operation: "replaceText",
        target: "hero.title",
        value: `Experience ${name}`,
      });
      ops.push({
        operation: "replaceText",
        target: "hero.subheadline",
        value: "Refined service, thoughtful details, and an atmosphere designed to impress.",
      });
      break;

    case "improve_readability":
      ops.push({ operation: "setSiteWidth", value: "boxed" });
      ops.push({ operation: "shortenNavigation", maxLabelLength: 10 });
      ops.push({
        operation: "setTypography",
        headingFont: "inter",
        bodyFont: "inter",
      });
      ops.push({
        operation: "replaceText",
        target: "hero.subheadline",
        value: project.heroSubheadline.trim()
          ? shortenSentence(project.heroSubheadline, 140)
          : "Clear information, easy scanning, and a layout that gives every section room to breathe.",
      });
      break;

    case "improve_seo":
      ops.push({
        operation: "updateSeo",
        siteTitle: `${name} | Official Site`.slice(0, 60),
        metaDescription: (
          project.description.trim() ||
          `${name} provides trusted service with a clear process and friendly support.`
        ).slice(0, 160),
        socialTitle: name.slice(0, 70),
        socialDescription: (
          project.heroSubheadline.trim() || `Learn more about ${name}.`
        ).slice(0, 200),
        robotsIndex: true,
      });
      break;

    case "improve_accessibility":
      ops.push({
        operation: "changeTheme",
        background: "#f7f8fa",
        primary: "#0f766e",
        accent: "#0f766e",
        secondary: "#111827",
        theme: "light",
      });
      ops.push({ operation: "setButtonStyle", value: "rounded" });
      ops.push({
        operation: "setTypography",
        headingFont: "inter",
        bodyFont: "inter",
      });
      break;

    default:
      break;
  }

  return ops;
}

function shortenSentence(value: string, max: number): string {
  const trimmed = value.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, Math.max(1, max - 1)).trimEnd()}…`;
}
