/**
 * Explicit content-edit planner (Sprint 22.2).
 * Targeted copy changes — never broad business-goal redesigns.
 */

import type { EditOperation } from "@/lib/ai/edit-operations";
import { createDefaultFaqItems } from "@/lib/ai/design-sections-canonical";
import type { BusinessProject } from "@/types/business-project";

export type ContentEditPlan = {
  operations: EditOperation[];
  explanation: string;
};

function unwrapQuotes(value: string): string {
  return value
    .trim()
    .replace(/^["“'`]+/, "")
    .replace(/["”'`]+$/, "")
    .trim();
}

function normalizeQuestion(value: string): string {
  return value
    .toLowerCase()
    .replace(/['’]/g, "'")
    .replace(/[^\w\s?'']/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Find the FAQ index matching a referenced question (exact, then fuzzy contains).
 */
export function findFaqIndexByQuestion(
  project: BusinessProject,
  questionHint: string,
): number {
  const faqs = project.designSections?.faq ?? [];
  if (!faqs.length) return -1;
  const hint = normalizeQuestion(questionHint);
  if (!hint) return -1;

  let best = -1;
  let bestScore = 0;
  for (let i = 0; i < faqs.length; i += 1) {
    const q = normalizeQuestion(faqs[i]?.question ?? "");
    if (!q) continue;
    if (q === hint) return i;
    if (q.includes(hint) || hint.includes(q)) {
      const score =
        Math.min(q.length, hint.length) / Math.max(q.length, hint.length);
      if (score > bestScore) {
        bestScore = score;
        best = i;
      }
    }
  }
  return bestScore >= 0.45 ? best : -1;
}

function ensureFaqSeed(project: BusinessProject): EditOperation[] {
  const enabled = project.designSections?.enabled ?? [];
  const hasFaq =
    enabled.includes("faq") && (project.designSections?.faq?.length ?? 0) > 0;
  if (hasFaq) return [];
  return [
    {
      operation: "insertFaq",
      items: createDefaultFaqItems(project.businessName || "our team"),
    },
  ];
}

function planFaqAnswerUpdate(
  project: BusinessProject,
  request: string,
): ContentEditPlan | null {
  // Update the answer to "…" to: "…"
  const quoted = request.match(
    /\b(?:update|change|replace|rewrite|edit|correct|fix)\s+(?:the\s+)?(?:faq\s+)?answer\s+(?:to|for)\s+["“](.+?)["”]\s+to\s*:?\s*["“]([^"”]+)["”]/i,
  );
  const quotedBare = !quoted
    ? request.match(
        /\b(?:update|change|replace|rewrite|edit|correct|fix)\s+(?:the\s+)?(?:faq\s+)?answer\s+(?:to|for)\s+["“](.+?)["”]\s+to\s*:?\s*([^\n]+?)(?:\s+and\s+(?:make|also|then)\b|[.\n]|$)/i,
      )
    : null;
  const loose = !quoted && !quotedBare
    ? request.match(
        /\b(?:update|change|replace|rewrite|edit|correct|fix)\s+(?:the\s+)?(?:faq\s+)?answer\s+(?:to|for)\s+(.+?)\s+to\s*:?\s*(.+?)(?:\s+and\s+(?:make|also|then)\b|[.\n]|$)/i,
      )
    : null;

  const match = quoted ?? quotedBare ?? loose;
  if (!match) return null;

  const questionHint = unwrapQuotes(match[1] ?? "");
  const answer = unwrapQuotes(match[2] ?? "");
  if (!questionHint || !answer) return null;

  const ops: EditOperation[] = [...ensureFaqSeed(project)];
  // After seed, index may still be computed against current project — apply path
  // resolves by question match matchQuestion preferentially.
  const index = findFaqIndexByQuestion(project, questionHint);
  ops.push({
    operation: "updateFaqAnswer",
    ...(index >= 0 ? { index } : {}),
    matchQuestion: questionHint,
    answer,
  });

  return {
    operations: ops,
    explanation: `Updated the FAQ answer for “${questionHint}”.`,
  };
}

function planFaqQuestionUpdate(
  project: BusinessProject,
  request: string,
): ContentEditPlan | null {
  const match = request.match(
    /\b(?:update|change|replace|rewrite|rename|edit)\s+(?:the\s+)?(?:faq\s+)?question\s+["“](.+?)["”]\s+to\s*:?\s*["“]?(.+?)["”]?\s*$/i,
  );
  if (!match) return null;
  const from = unwrapQuotes(match[1] ?? "");
  const to = unwrapQuotes(match[2] ?? "");
  if (!from || !to) return null;
  const index = findFaqIndexByQuestion(project, from);
  return {
    operations: [
      {
        operation: "updateFaqQuestion",
        ...(index >= 0 ? { index } : {}),
        matchQuestion: from,
        question: to,
      },
    ],
    explanation: `Updated the FAQ question to “${to}”.`,
  };
}

function planHeroText(
  _project: BusinessProject,
  request: string,
): ContentEditPlan | null {
  const headline = request.match(
    /\b(?:update|change|replace|rewrite|edit|set)\s+(?:the\s+)?(?:hero\s+)?(?:headline|title)\s+to\s*:?\s*["“]?([\s\S]+?)["”]?\s*$/i,
  );
  if (headline?.[1]) {
    return {
      operations: [
        {
          operation: "replaceText",
          target: "hero.title",
          value: unwrapQuotes(headline[1]),
        },
      ],
      explanation: "Updated the hero headline.",
    };
  }

  const sub = request.match(
    /\b(?:update|change|replace|rewrite|edit|set)\s+(?:the\s+)?(?:hero\s+)?subheadline\s+to\s*:?\s*["“]?([\s\S]+?)["”]?\s*$/i,
  );
  if (sub?.[1]) {
    return {
      operations: [
        {
          operation: "replaceText",
          target: "hero.subheadline",
          value: unwrapQuotes(sub[1]),
        },
      ],
      explanation: "Updated the hero subheadline.",
    };
  }

  return null;
}

function planButtonText(
  _project: BusinessProject,
  request: string,
): ContentEditPlan | null {
  const primary = request.match(
    /\b(?:update|change|replace|rewrite|edit|set|rename)\s+(?:the\s+)?(?:primary\s+)?(?:cta|button(?:\s+text)?)\s+to\s*:?\s*["“]?([\s\S]+?)["”]?\s*$/i,
  );
  if (primary?.[1] && !/contact\s+button/i.test(request)) {
    return {
      operations: [
        {
          operation: "replaceText",
          target: "hero.primaryCta",
          value: unwrapQuotes(primary[1]),
        },
      ],
      explanation: "Updated the primary button text.",
    };
  }

  const contact = request.match(
    /\b(?:update|change|replace|rewrite|edit|set|rename)\s+(?:the\s+)?contact\s+button(?:\s+text)?\s+to\s*:?\s*["“]?([\s\S]+?)["”]?\s*$/i,
  );
  if (contact?.[1]) {
    return {
      operations: [
        {
          operation: "replaceText",
          target: "contact.buttonText",
          value: unwrapQuotes(contact[1]),
        },
      ],
      explanation: "Updated the contact button text.",
    };
  }

  return null;
}

function planServicesEdit(
  project: BusinessProject,
  request: string,
): ContentEditPlan | null {
  const titleMatch = request.match(
    /\b(?:update|change|replace|rewrite|edit|rename)\s+(?:the\s+)?(?:first\s+|second\s+|third\s+)?service(?:\s+(\d+))?\s+title\s+to\s*:?\s*["“]?([\s\S]+?)["”]?\s*$/i,
  );
  if (titleMatch?.[2]) {
    const index = titleMatch[1]
      ? Math.max(0, Number.parseInt(titleMatch[1], 10) - 1)
      : /\bsecond\b/i.test(request)
        ? 1
        : /\bthird\b/i.test(request)
          ? 2
          : 0;
    const services = project.services.map((s, i) =>
      i === index
        ? { ...s, title: unwrapQuotes(titleMatch[2]!) }
        : { title: s.title, description: s.description },
    );
    return {
      operations: [{ operation: "rewriteServices", services }],
      explanation: `Updated service ${index + 1} title.`,
    };
  }

  const descMatch = request.match(
    /\b(?:update|change|replace|rewrite|edit)\s+(?:the\s+)?(?:first\s+|second\s+|third\s+)?service(?:\s+(\d+))?\s+description\s+to\s*:?\s*["“]?([\s\S]+?)["”]?\s*$/i,
  );
  if (descMatch?.[2]) {
    const index = descMatch[1]
      ? Math.max(0, Number.parseInt(descMatch[1], 10) - 1)
      : /\bsecond\b/i.test(request)
        ? 1
        : /\bthird\b/i.test(request)
          ? 2
          : 0;
    const services = project.services.map((s, i) =>
      i === index
        ? { ...s, description: unwrapQuotes(descMatch[2]!) }
        : { title: s.title, description: s.description },
    );
    return {
      operations: [{ operation: "rewriteServices", services }],
      explanation: `Updated service ${index + 1} description.`,
    };
  }

  return null;
}

function planAboutEdit(
  project: BusinessProject,
  request: string,
): ContentEditPlan | null {
  const body = request.match(
    /\b(?:update|change|replace|rewrite|edit)\s+(?:the\s+)?about(?:\s+section)?(?:\s+body|\s+text|\s+copy)?\s+to\s*:?\s*["“]?([\s\S]+?)["”]?\s*$/i,
  );
  if (body?.[1] && !/about\s+title/i.test(request)) {
    return {
      operations: [
        {
          operation: "replaceText",
          target: "about.body",
          value: unwrapQuotes(body[1]),
        },
      ],
      explanation: "Updated the About section.",
    };
  }

  const title = request.match(
    /\b(?:update|change|replace|rewrite|edit|rename)\s+(?:the\s+)?about\s+title\s+to\s*:?\s*["“]?([\s\S]+?)["”]?\s*$/i,
  );
  if (title?.[1]) {
    return {
      operations: [
        {
          operation: "replaceText",
          target: "about.title",
          value: unwrapQuotes(title[1]),
        },
      ],
      explanation: "Updated the About title.",
    };
  }

  // Broad "rewrite the about" without literal replacement text — keep prior behavior light.
  if (/\b(?:rewrite|update)\s+(?:the\s+)?about(?:\s+section)?\b/i.test(request) && !/\bto\b/i.test(request)) {
    const name = project.businessName || "your business";
    return {
      operations: [
        {
          operation: "replaceText",
          target: "about.body",
          value: `${name} is dedicated to delivering a clear, trustworthy experience. We focus on quality, communication, and results that help customers feel confident from the first visit.`,
        },
      ],
      explanation: "Rewrote the About section.",
    };
  }

  return null;
}

/**
 * Plan targeted content edits from an explicit edit instruction.
 */
export function planExplicitContentEdits(input: {
  project: BusinessProject;
  request: string;
}): ContentEditPlan {
  const request = input.request.trim();
  const planners = [
    planFaqAnswerUpdate,
    planFaqQuestionUpdate,
    planHeroText,
    planButtonText,
    planServicesEdit,
    planAboutEdit,
  ];

  for (const plan of planners) {
    const result = plan(input.project, request);
    if (result && result.operations.length > 0) return result;
  }

  return {
    operations: [],
    explanation: "I couldn’t locate a specific piece of copy to update.",
  };
}
