/**
 * Atlas AI Design Assistant agent (Sprint 22.0A).
 * Interprets natural language → structured edit operations → updated project.
 * Never returns arbitrary code or raw project JSON patches from the model.
 */

import { applyEditOperations } from "@/lib/ai/apply-edit-operations";
import { planExplicitContentEdits } from "@/lib/ai/content-edit-planner";
import {
  operationsFromDesignReasoning,
  reasonAboutDesign,
  type DesignReasoningResult,
} from "@/lib/ai/design-reasoner";
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
import { hasMeaningfulProjectDiff } from "@/lib/ai/editor-assistant-persistence";
import {
  routeIntent,
  shouldSkipBusinessReasoning,
} from "@/lib/ai/intent-router";
import {
  parseThemeColorIntent,
  wantsPreserveWording,
} from "@/lib/ai/named-colors";
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

export type EditorAgentApplyStatus =
  | "applied"
  | "no_changes"
  | "needs_clarification";

export type EditorAgentResult = {
  ok: true;
  explanation: string;
  operations: EditOperation[];
  changes: EditChangeSummary[];
  project: BusinessProject;
  applyStatus: EditorAgentApplyStatus;
  /** Present when goal-based reasoning ran. */
  reasoning?: DesignReasoningResult;
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
 * Intent router classifies first; business reasoning never overrides explicit edits.
 */
export function planEditOperations(input: {
  project: BusinessProject;
  request: string;
  history?: EditorAgentHistoryItem[];
}): {
  operations: EditOperation[];
  explanation: string;
  reasoning?: DesignReasoningResult;
  needsClarification?: boolean;
} {
  const request = input.request.trim();
  if (!request) {
    throw new AiError("bad_request", "A design request is required.");
  }

  const intent = routeIntent({
    request,
    project: input.project,
    history: input.history,
  });

  // 1) Explicit content edits — skip business reasoning entirely.
  if (intent.category === "explicit_content_edit") {
    const content = planExplicitContentEdits({
      project: input.project,
      request,
    });
    if (content.operations.length > 0) {
      return {
        operations: content.operations,
        explanation: content.explanation,
      };
    }
  }

  // 2) Mixed — explicit content first, then design / goal improvements.
  if (intent.category === "mixed") {
    const content = planExplicitContentEdits({
      project: input.project,
      request,
    });
    const direct = planDirectEditOperations(input);
    const designOps = direct.operations.filter(
      (op) =>
        op.operation !== "insertSection" ||
        (op.type !== "faq" && !/\banswer\b/i.test(request)),
    );

    let goalOps: EditOperation[] = [];
    let reasoning: DesignReasoningResult | undefined;
    if (!shouldSkipBusinessReasoning(intent) || intent.signals.hasBusinessGoal) {
      reasoning = reasonAboutDesign({
        request,
        project: input.project,
        history: input.history,
      });
      if (reasoning.shouldAct) {
        goalOps = operationsFromDesignReasoning(reasoning, input.project);
      }
    }

    const operations = [
      ...content.operations,
      ...designOps,
      ...goalOps.filter(
        (op) =>
          !content.operations.some(
            (c) => JSON.stringify(c) === JSON.stringify(op),
          ),
      ),
    ];

    if (operations.length > 0) {
      const parts = [
        content.operations.length ? content.explanation : null,
        designOps.length ? direct.explanation : null,
        goalOps.length && reasoning
          ? `Also improved toward “${reasoning.inferredGoal}”.`
          : null,
      ].filter(Boolean);
      return {
        operations,
        explanation: parts.join(" ") || "Applied your mixed request.",
        reasoning,
      };
    }
  }

  // 3) Explicit design commands.
  const direct = planDirectEditOperations(input);
  if (
    intent.category === "explicit_design_edit" &&
    direct.operations.length > 0
  ) {
    return { ...direct };
  }

  // Prefer direct design keywords even for unknown when they clearly match.
  if (direct.operations.length > 0 && intent.category !== "business_goal") {
    return { ...direct };
  }

  // 4) Business goals — only when not an explicit content/design override.
  if (
    !shouldSkipBusinessReasoning(intent) ||
    intent.category === "business_goal" ||
    intent.category === "unknown"
  ) {
    const reasoning = reasonAboutDesign({
      request,
      project: input.project,
      history: input.history,
    });

    if (
      intent.category !== "explicit_content_edit" &&
      intent.category !== "question" &&
      intent.category !== "clarification"
    ) {
      if (direct.operations.length > 0) {
        return { ...direct, reasoning };
      }

      if (reasoning.shouldAct) {
        const goalOps = operationsFromDesignReasoning(reasoning, input.project);
        if (goalOps.length > 0) {
          return {
            operations: goalOps,
            explanation: `I focused on “${reasoning.inferredGoal}”: ${reasoning.designStrategy}`,
            reasoning,
          };
        }
      }

      if (reasoning.followUpQuestion) {
        return {
          operations: [],
          explanation: reasoning.followUpQuestion,
          reasoning,
          needsClarification: true,
        };
      }
    }

    return {
      operations: [],
      explanation: direct.explanation,
      reasoning,
      needsClarification: reasoning.goal === "unknown",
    };
  }

  // 5–6) Clarifications / questions / leftovers
  if (intent.category === "question" || intent.category === "clarification") {
    return {
      operations: [],
      explanation:
        intent.category === "clarification"
          ? "Got it — tell me exactly which text or section to change."
          : "Happy to help — what would you like me to change on the site?",
      needsClarification: true,
    };
  }

  return {
    operations: [],
    explanation: direct.explanation,
    needsClarification: true,
  };
}

/**
 * Deterministic keyword/direct-command planner (theme colors, FAQ, etc.).
 */
export function planDirectEditOperations(input: {
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
  const mentionsSite =
    /\b(it|this|the site|the website|the page|everything)\b/.test(text) ||
    ctx.includes("website") ||
    ctx.includes("modern") ||
    ctx.includes("site");
  const preserveWording = wantsPreserveWording(text);
  const themeColors = parseThemeColorIntent(text);
  let appliedNamedTheme = false;
  const operations: EditOperation[] = [];
  const notes: string[] = [];
  const name = input.project.businessName || "your business";

  // --- begin retained direct-intent body (from former planEditOperations) ---
  if (themeColors) {
    operations.push({
      operation: "changeTheme",
      ...(themeColors.primary ? { primary: themeColors.primary } : {}),
      ...(themeColors.secondary ? { secondary: themeColors.secondary } : {}),
      ...(themeColors.accent ? { accent: themeColors.accent } : {}),
      ...(themeColors.background ? { background: themeColors.background } : {}),
      ...(themeColors.theme ? { theme: themeColors.theme } : {}),
    });
    appliedNamedTheme = true;
    notes.push(
      themeColors.labels.length > 0
        ? `Applied ${themeColors.labels.join(" with ")}`
        : "Updated theme colors",
    );
  }

  if (/testimonial/.test(text) && /\b(add|include|insert|create)\b/.test(text)) {
    operations.push({ operation: "insertSection", type: "testimonials" });
    notes.push("Added a testimonials section");
  }
  // Only insert FAQ when explicitly adding — never on "update the answer…"
  if (
    (/\bfaq\b|frequently asked/.test(text) ||
      (/\banswer\b/.test(text) && /\bquestion\b/.test(text))) &&
    /\b(add|include|insert|create)\b/.test(text) &&
    !/\b(update|change|replace|rewrite|edit|correct|fix)\b/.test(text)
  ) {
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

  if (!appliedNamedTheme && /blue/.test(text) && /green/.test(text)) {
    operations.push({
      operation: "replaceColors",
      from: "blue",
      to: "#0f766e",
    });
    notes.push("Shifted blue brand colors to green");
  } else if (
    !appliedNamedTheme &&
    /green/.test(text) &&
    /color|colours|colors|accent|primary/.test(text)
  ) {
    operations.push({
      operation: "changeTheme",
      primary: "#0f766e",
      accent: "#0d9488",
    });
    notes.push("Updated brand colors toward green");
  }

  if (
    !appliedNamedTheme &&
    (/darker|make it dark|dark mode|darker theme/.test(text) ||
      (/dark/.test(text) && mentionsSite))
  ) {
    operations.push({
      operation: "changeTheme",
      background: "#07090d",
      secondary: "#0e1218",
      theme: "dark",
    });
    notes.push("Moved the site to a darker theme");
  }

  if (!appliedNamedTheme && /lighter|make it light|light mode/.test(text)) {
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
  } else if (/modern/.test(text) || /contemporary|fresh look/.test(text)) {
    const wantsProfessional = /professional/.test(text);
    const tone = designFromTone(wantsProfessional ? "professional" : "modern");
    const modernType = designFromTone("modern");
    operations.push({
      operation: "setTemplate",
      value: wantsProfessional ? tone.templateId : modernType.templateId,
    });
    operations.push({
      operation: "setTypography",
      headingFont: wantsProfessional ? "manrope" : modernType.headingFont,
      bodyFont: wantsProfessional ? "inter" : modernType.bodyFont,
    });
    operations.push({
      operation: "setButtonStyle",
      value: wantsProfessional ? "rounded" : modernType.buttonStyle,
    });
    operations.push({
      operation: "setSiteWidth",
      value: wantsProfessional ? "wide" : modernType.siteWidth,
    });
    operations.push({
      operation: "changeTheme",
      ...(wantsProfessional
        ? { primary: "#0f766e", accent: "#0d9488" }
        : {}),
      background: tone.backgroundColor,
      secondary: tone.secondaryColor,
      theme: tone.theme,
    });
    operations.push({
      operation: "replaceText",
      target: "hero.title",
      value: wantsProfessional
        ? `${name} — modern & professional`
        : `${name}, reimagined`,
    });
    operations.push({
      operation: "replaceText",
      target: "hero.subheadline",
      value: wantsProfessional
        ? "Clean layout, trustworthy messaging, and a polished experience built to convert."
        : "Clean design, clear messaging, and a modern experience for every visitor.",
    });
    operations.push({
      operation: "replaceText",
      target: "hero.primaryCta",
      value: "Get started",
    });
    notes.push(
      wantsProfessional
        ? "Applied a modern, professional redesign"
        : "Modernized the hero and layout",
    );
  } else if (/professional/.test(text)) {
    const professional = designFromTone("professional");
    operations.push({ operation: "setTemplate", value: professional.templateId });
    operations.push({
      operation: "setTypography",
      headingFont: professional.headingFont,
      bodyFont: professional.bodyFont,
    });
    operations.push({
      operation: "setButtonStyle",
      value: professional.buttonStyle,
    });
    operations.push({
      operation: "changeTheme",
      background: professional.backgroundColor,
      secondary: professional.secondaryColor,
      theme: professional.theme,
    });
    operations.push({
      operation: "replaceText",
      target: "hero.title",
      value: `${name} — done right`,
    });
    notes.push("Applied a professional visual direction");
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
    return {
      operations: [],
      explanation:
        "No changes needed — I could not map that request to a safe design edit. Try something more specific like “Make the hero more modern”, “Add an FAQ”, or “Change blue colors to green”.",
    };
  }

  const filtered = preserveWording
    ? operations.filter(
        (op) =>
          op.operation !== "replaceText" &&
          op.operation !== "rewriteServices" &&
          op.operation !== "updateSeo" &&
          op.operation !== "shortenNavigation",
      )
    : operations;

  if (preserveWording && !notes.some((n) => /wording|unchanged/i.test(n))) {
    notes.push("Kept all wording unchanged");
  }

  if (filtered.length === 0) {
    return {
      operations: [],
      explanation: preserveWording
        ? "No design changes were needed while keeping your wording unchanged."
        : "No changes needed — I could not map that request to a safe design edit. Try something more specific like “Make the hero more modern”, “Add an FAQ”, or “Change blue colors to green”.",
    };
  }

  const explanation =
    notes.length > 0
      ? `I updated the website: ${notes.join("; ")}.`
      : "I applied structured design edits to the current website.";

  return { operations: filtered, explanation };
}

/**
 * Run the Design Assistant agent: reason → plan → validate → apply.
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

  if (planned.needsClarification || planned.operations.length === 0) {
    const needsClarification =
      planned.needsClarification ||
      Boolean(planned.reasoning && !planned.reasoning.shouldAct);
    return {
      ok: true,
      explanation: planned.explanation,
      operations: [],
      changes: [],
      project: input.project,
      applyStatus: needsClarification ? "needs_clarification" : "no_changes",
      reasoning: planned.reasoning,
    };
  }

  const operations = validateEditOperations(planned.operations);
  const applied = applyEditOperations(input.project, operations);
  const changed = hasMeaningfulProjectDiff(input.project, applied.project);

  return {
    ok: true,
    explanation: changed
      ? planned.explanation
      : "No changes needed — the site already matched that request.",
    operations: changed ? operations : [],
    changes: changed ? applied.changes : [],
    project: changed ? applied.project : input.project,
    applyStatus: changed ? "applied" : "no_changes",
    reasoning: planned.reasoning,
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
