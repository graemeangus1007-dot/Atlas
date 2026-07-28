/**
 * Atlas AI Design Assistant agent (Sprint 22.0A).
 * Interprets natural language → structured edit operations → updated project.
 * Never returns arbitrary code or raw project JSON patches from the model.
 */

import { applyEditOperations } from "@/lib/ai/apply-edit-operations";
import { designFromTone } from "@/lib/ai/tone-design";
import {
  serializeConversationForAgent,
  type EditorConversation,
  type EditorConversationMessage,
} from "@/lib/ai/editor-conversation";
import type {
  EditChangeSummary,
  EditOperation,
} from "@/lib/ai/edit-operations";
import { validateEditOperations } from "@/lib/ai/validate-edit-operations";
import { AiError } from "@/lib/ai/errors";
import type { BusinessProject } from "@/types/business-project";

export type EditorAgentHistoryItem = {
  role: "user" | "assistant";
  content: string;
};

export type EditorAgentInput = {
  project: BusinessProject;
  request: string;
  /** Prior turns so pronouns like "it" resolve to the current site. */
  history?: EditorAgentHistoryItem[] | EditorConversation | EditorConversationMessage[];
};

export type EditorAgentResult = {
  ok: true;
  explanation: string;
  operations: EditOperation[];
  changes: EditChangeSummary[];
  project: BusinessProject;
};

export type EditorAgentFailure = {
  ok: false;
  code: string;
  message: string;
};

function normalizeHistory(
  history: EditorAgentInput["history"],
): EditorAgentHistoryItem[] {
  if (!history) return [];
  if (Array.isArray(history)) {
    return history
      .map((item) => {
        if (!item || typeof item !== "object") return null;
        const role = (item as { role?: unknown }).role;
        const content = (item as { content?: unknown }).content;
        if (
          (role === "user" || role === "assistant") &&
          typeof content === "string" &&
          content.trim()
        ) {
          return { role, content: content.trim() };
        }
        return null;
      })
      .filter((x): x is EditorAgentHistoryItem => x !== null);
  }
  return serializeConversationForAgent(history);
}

function recentContext(history: EditorAgentHistoryItem[]): string {
  return history
    .slice(-6)
    .map((m) => `${m.role}: ${m.content}`)
    .join("\n")
    .toLowerCase();
}

/**
 * Deterministic intent → operations (mock foundation).
 * OpenAI-backed planning can replace this later while keeping the same apply path.
 */
export function planEditOperations(input: {
  project: BusinessProject;
  request: string;
  history?: EditorAgentHistoryItem[];
}): { operations: EditOperation[]; explanation: string } {
  const request = input.request.trim();
  if (!request) {
    throw new AiError("bad_request", "A design request is required.");
  }

  const text = request.toLowerCase();
  const ctx = recentContext(input.history ?? []);
  const operations: EditOperation[] = [];
  const notes: string[] = [];
  const name = input.project.businessName || "your business";

  const mentionsSite =
    /\b(it|this|the site|the website|the page|everything)\b/.test(text) ||
    ctx.includes("website") ||
    ctx.includes("modern") ||
    ctx.includes("site");

  if (/testimonial/.test(text)) {
    operations.push({ operation: "insertSection", type: "testimonials" });
    notes.push("Added a testimonials section");
  }
  if (/\bfaq\b|frequently asked/.test(text)) {
    operations.push({ operation: "insertSection", type: "faq" });
    notes.push("Added an FAQ section");
  }
  if (/\bteam\b/.test(text) && /add|include|insert/.test(text)) {
    operations.push({ operation: "insertSection", type: "team" });
    notes.push("Added a team section");
  }
  if (/newsletter/.test(text) && /add|include|insert/.test(text)) {
    operations.push({ operation: "insertSection", type: "newsletter" });
    notes.push("Added a newsletter section");
  }
  if (/pricing/.test(text) && /add|include|insert/.test(text)) {
    operations.push({ operation: "insertSection", type: "pricing" });
    notes.push("Added a pricing section");
  }

  if (/blue/.test(text) && /green/.test(text)) {
    operations.push({
      operation: "replaceColors",
      from: "blue",
      to: "#0f766e",
    });
    notes.push("Shifted blue brand colors to green");
  } else if (/green/.test(text) && /color|colours|colors|accent|primary/.test(text)) {
    operations.push({
      operation: "changeTheme",
      primary: "#0f766e",
      accent: "#0d9488",
    });
    notes.push("Updated brand colors toward green");
  }

  if (/darker|make it dark|dark mode|darker theme/.test(text) || (/dark/.test(text) && mentionsSite)) {
    operations.push({
      operation: "changeTheme",
      background: "#07090d",
      secondary: "#0e1218",
      theme: "dark",
    });
    notes.push("Moved the site to a darker theme");
  }

  if (/lighter|make it light|light mode/.test(text)) {
    operations.push({
      operation: "changeTheme",
      background: "#f7f8fa",
      secondary: "#1a1f26",
      theme: "light",
    });
    notes.push("Moved the site to a lighter theme");
  }

  if (/rounded|round(er)? buttons|pill buttons/.test(text)) {
    operations.push({
      operation: "setButtonStyle",
      value: /pill/.test(text) ? "pill" : "soft-rounded",
    });
    notes.push("Updated button shape");
  }

  if (/whitespace|white space|more space|spacious|breathing room|increase spacing/.test(text)) {
    operations.push({ operation: "setSiteWidth", value: "boxed" });
    notes.push("Increased whitespace with a more open layout width");
  }

  if (/luxur|elegant|premium|sophisticated/.test(text)) {
    const luxury = designFromTone("luxury");
    operations.push({ operation: "setTemplate", value: luxury.templateId });
    operations.push({
      operation: "setTypography",
      headingFont: luxury.headingFont,
      bodyFont: luxury.bodyFont,
    });
    operations.push({ operation: "setButtonStyle", value: luxury.buttonStyle });
    operations.push({ operation: "setSiteWidth", value: luxury.siteWidth });
    operations.push({
      operation: "changeTheme",
      background: luxury.backgroundColor,
      secondary: luxury.secondaryColor,
      theme: luxury.theme,
    });
    operations.push({
      operation: "replaceText",
      target: "hero.title",
      value: `Experience ${name}`,
    });
    operations.push({
      operation: "replaceText",
      target: "hero.subheadline",
      value: "Refined service, thoughtful details, and an atmosphere designed to impress.",
    });
    notes.push("Applied a luxurious visual direction");
  } else if (/modern|contemporary|fresh look/.test(text)) {
    const modern = designFromTone("modern");
    operations.push({ operation: "setTemplate", value: modern.templateId });
    operations.push({
      operation: "setTypography",
      headingFont: modern.headingFont,
      bodyFont: modern.bodyFont,
    });
    operations.push({ operation: "setButtonStyle", value: modern.buttonStyle });
    operations.push({
      operation: "replaceText",
      target: "hero.title",
      value: `${name}, reimagined`,
    });
    operations.push({
      operation: "replaceText",
      target: "hero.subheadline",
      value: "Clean design, clear messaging, and a modern experience for every visitor.",
    });
    notes.push("Modernized the hero and layout");
  }

  if (/rewrite.*about|about section|update the about/.test(text)) {
    operations.push({
      operation: "replaceText",
      target: "about.title",
      value: `About ${name}`,
    });
    operations.push({
      operation: "replaceText",
      target: "about.body",
      value: `${name} is dedicated to delivering a clear, trustworthy experience. We focus on quality, communication, and results that help customers feel confident from the first visit.`,
    });
    notes.push("Rewrote the About section");
  }

  if (/hero/.test(text) && /modern|rewrite|improve|update|stronger|better/.test(text)) {
    if (!operations.some((op) => op.operation === "replaceText" && op.target === "hero.title")) {
      operations.push({
        operation: "replaceText",
        target: "hero.title",
        value: `Grow with ${name}`,
      });
      operations.push({
        operation: "replaceText",
        target: "hero.subheadline",
        value: "A clearer offer, a stronger first impression, and a call to action that converts.",
      });
      operations.push({
        operation: "replaceText",
        target: "hero.primaryCta",
        value: "Get started",
      });
      notes.push("Rewrote the hero");
    }
  }

  if (/shorten.*nav|navigation|nav links|shorter menu/.test(text)) {
    operations.push({ operation: "shortenNavigation", maxLabelLength: 10 });
    notes.push("Shortened navigation labels");
  }

  if (/seo|search engine|meta description|site title/.test(text)) {
    const titleBase = name.slice(0, 40);
    operations.push({
      operation: "updateSeo",
      siteTitle: `${titleBase} | Official Site`.slice(0, 60),
      metaDescription: (
        input.project.description.trim() ||
        `${name} provides trusted service with a clear process and friendly support.`
      ).slice(0, 160),
      socialTitle: titleBase.slice(0, 70),
      socialDescription: (
        input.project.heroSubheadline.trim() ||
        `Learn more about ${name}.`
      ).slice(0, 200),
      robotsIndex: true,
    });
    notes.push("Improved SEO metadata");
  }

  if (/dental|dentist|orthodont/.test(text)) {
    operations.push({
      operation: "replaceText",
      target: "business.type",
      value: "Other",
    });
    operations.push({
      operation: "replaceText",
      target: "hero.title",
      value: `Smile brighter with ${name}`,
    });
    operations.push({
      operation: "replaceText",
      target: "hero.subheadline",
      value: "Gentle, modern dental care for families who want a healthier, more confident smile.",
    });
    operations.push({
      operation: "replaceText",
      target: "about.body",
      value: `${name} provides patient-first dental care with clear treatment plans, modern equipment, and a calm office experience.`,
    });
    operations.push({
      operation: "rewriteServices",
      services: [
        {
          title: "Preventive care",
          description: "Cleanings, exams, and guidance that keep smiles healthy year-round.",
        },
        {
          title: "Cosmetic dentistry",
          description: "Whitening and smile enhancements tailored to your goals.",
        },
        {
          title: "Family dentistry",
          description: "Comfortable care for kids, adults, and everyone in between.",
        },
      ],
    });
    operations.push({
      operation: "updateSeo",
      siteTitle: `${name} | Dental Care`.slice(0, 60),
      metaDescription: `${name} offers gentle, modern dental care for families. Book a visit today.`.slice(0, 160),
    });
    notes.push("Rewrote the site for a dental office");
  }

  if (/cta|call to action|button text/.test(text) && /improve|better|stronger|update/.test(text)) {
    operations.push({
      operation: "replaceText",
      target: "hero.primaryCta",
      value: "Book a consultation",
    });
    notes.push("Improved the primary CTA");
  }

  if (/rewrite everything|rewrite the whole|overhaul copy/.test(text) && !/dental/.test(text)) {
    operations.push({
      operation: "replaceText",
      target: "hero.title",
      value: `${name} — built for results`,
    });
    operations.push({
      operation: "replaceText",
      target: "hero.subheadline",
      value: "Clear messaging, a confident offer, and a website that helps customers take the next step.",
    });
    operations.push({
      operation: "replaceText",
      target: "about.body",
      value: `${name} helps customers move forward with confidence. We keep communication simple, quality high, and every detail intentional.`,
    });
    notes.push("Rewrote core page copy");
  }

  // Follow-ups like "Make it darker" after "Make this website modern"
  if (operations.length === 0 && /darker|dark/.test(text) && mentionsSite) {
    operations.push({
      operation: "changeTheme",
      background: "#07090d",
      theme: "dark",
    });
    notes.push("Made the current website darker");
  }

  if (operations.length === 0) {
    // Safe default improvement when intent is vague but clearly about design.
    operations.push({
      operation: "replaceText",
      target: "hero.primaryCta",
      value: input.project.primaryCta.trim() || "Get started",
    });
    operations.push({
      operation: "updateSeo",
      siteTitle: `${name} | Official Site`.slice(0, 60),
      metaDescription: (
        input.project.description.trim() ||
        `${name} — clear, trustworthy, ready for customers.`
      ).slice(0, 160),
    });
    notes.push("Applied light polish to CTA and SEO");
  }

  const explanation =
    notes.length > 0
      ? `I updated the website: ${notes.join("; ")}.`
      : "I applied structured design edits to the current website.";

  return { operations, explanation };
}

/**
 * Run the Design Assistant agent: plan → validate → apply.
 */
export function runEditorAgent(input: EditorAgentInput): EditorAgentResult {
  const request = input.request?.trim();
  if (!request) {
    throw new AiError("bad_request", "A design request is required.");
  }
  if (!input.project || typeof input.project !== "object") {
    throw new AiError("bad_request", "A current project is required.");
  }

  const history = normalizeHistory(input.history);
  const planned = planEditOperations({
    project: input.project,
    request,
    history,
  });

  const operations = validateEditOperations(planned.operations);
  const applied = applyEditOperations(input.project, operations);

  return {
    ok: true,
    explanation: planned.explanation,
    operations,
    changes: applied.changes,
    project: applied.project,
  };
}

/** Safe wrapper that never throws across the HTTP boundary. */
export function tryRunEditorAgent(
  input: EditorAgentInput,
): EditorAgentResult | EditorAgentFailure {
  try {
    return runEditorAgent(input);
  } catch (error) {
    if (error instanceof AiError) {
      return { ok: false, code: error.code, message: error.message };
    }
    return {
      ok: false,
      code: "provider_error",
      message: "Atlas AI could not apply that design request. Please try again.",
    };
  }
}
