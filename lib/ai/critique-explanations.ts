/**
 * Atlas Critique Engine — designer/marketer-quality explanations (Sprint 23.1).
 */

import type {
  AdvisorFinding,
  AdvisorImpact,
} from "@/lib/ai/business-advisor-types";

export type CritiqueExplanation = {
  /** “What I noticed” */
  noticed: string;
  /** “Why it matters” */
  whyItMatters: string;
  /** “Expected business outcome” */
  expectedOutcome: string;
  /** Human estimate, e.g. “<10 seconds” */
  estimatedTime: string;
};

type ExplanationTemplate = Omit<CritiqueExplanation, "estimatedTime"> & {
  estimatedTime?: string;
};

const BY_ID: Record<string, ExplanationTemplate> = {
  "conversion.phone-in-hero": {
    noticed:
      "Your phone number is available, but it isn’t easy to spot in the hero.",
    whyItMatters:
      "People who are ready to reach out often decide in the first few seconds — if contact isn’t obvious, they leave.",
    expectedOutcome:
      "More direct calls from visitors who already intend to contact you.",
    estimatedTime: "<10 seconds",
  },
  "conversion.missing-phone": {
    noticed: "A clear, reachable phone number isn’t standing out on the page.",
    whyItMatters:
      "Without an obvious way to call, ready-to-buy visitors bounce instead of converting.",
    expectedOutcome: "Fewer missed leads and faster conversations with prospects.",
    estimatedTime: "~30 seconds",
  },
  "cta.weak-primary": {
    noticed: "Your primary button uses wording that’s easy to overlook or ignore.",
    whyItMatters:
      "Visitors may miss the most important next step on your page.",
    expectedOutcome:
      "Better visibility and potentially more contact requests.",
    estimatedTime: "<10 seconds",
  },
  "cta.weak-contact": {
    noticed: "The contact form button doesn’t clearly say what happens next.",
    whyItMatters:
      "Vague labels create hesitation right when someone is about to reach out.",
    expectedOutcome: "Higher form completion from visitors who start filling it out.",
    estimatedTime: "<10 seconds",
  },
  "trust.testimonials": {
    noticed:
      "Visitors don’t yet see enough proof of your work — there are no customer testimonials on the page.",
    whyItMatters:
      "I’d add testimonials just below the hero so trust is established before people evaluate your services.",
    expectedOutcome: "Stronger confidence and more inquiries from undecided visitors.",
    estimatedTime: "~30 seconds",
  },
  "trust.about-thin": {
    noticed: "Your About story feels thin for someone deciding whether to hire you.",
    whyItMatters:
      "People need a bit of context to feel they’re choosing the right business.",
    expectedOutcome: "More trust before the contact step — and fewer quick bounces.",
    estimatedTime: "~30 seconds",
  },
  "sections.faq": {
    noticed: "There’s no FAQ section answering the questions people usually ask first.",
    whyItMatters:
      "Unanswered questions create hesitation and extra back-and-forth later.",
    expectedOutcome: "Fewer objections and smoother paths to contact.",
    estimatedTime: "~30 seconds",
  },
  "seo.weak-title": {
    noticed: "Your search title doesn’t clearly explain what you offer.",
    whyItMatters:
      "A vague title in search results makes the right visitors less likely to click.",
    expectedOutcome: "More qualified visits from people already looking for your service.",
    estimatedTime: "<10 seconds",
  },
  "seo.weak-description": {
    noticed: "Your search snippet doesn’t sell the visit clearly enough.",
    whyItMatters:
      "Search results compete for attention — a stronger description wins the click.",
    expectedOutcome: "Higher click-through from search and better-matched traffic.",
    estimatedTime: "~30 seconds",
  },
  "a11y.cta-contrast": {
    noticed: "Your primary button doesn’t stand out clearly against the background.",
    whyItMatters:
      "If the main action is hard to see, many visitors never take it — including people with lower vision.",
    expectedOutcome:
      "Better visibility and potentially more contact requests.",
    estimatedTime: "<10 seconds",
  },
  "readability.dense-hero": {
    noticed: "The hero feels crowded — long copy on a wide layout is hard to scan.",
    whyItMatters:
      "Visitors skim first. Dense openings make your offer harder to grasp quickly.",
    expectedOutcome: "Clearer first impression and more people reading far enough to act.",
    estimatedTime: "~30 seconds",
  },
  "readability.long-nav": {
    noticed: "Some navigation labels are longer than they need to be.",
    whyItMatters:
      "Long labels slow scanning, especially on phones where space is tight.",
    expectedOutcome: "Easier browsing and fewer people getting lost in the menu.",
    estimatedTime: "<10 seconds",
  },
  "mobile.tap-targets": {
    noticed: "Button styling feels less friendly for tapping on smaller screens.",
    whyItMatters:
      "On mobile, awkward controls make people less likely to tap through to contact.",
    expectedOutcome: "Smoother mobile visits and more completed actions on phones.",
    estimatedTime: "<10 seconds",
  },
  "hierarchy.flat-type": {
    noticed: "Headings and body text use the same plain type pairing.",
    whyItMatters:
      "Without a clear type hierarchy, the page feels flatter and harder to scan.",
    expectedOutcome: "A more intentional look and faster comprehension of key points.",
    estimatedTime: "<10 seconds",
  },
  "branding.same-accent": {
    noticed: "Your accent color matches the primary, so highlights don’t pop.",
    whyItMatters:
      "Buttons and key accents need a distinct color to draw the eye to action.",
    expectedOutcome: "Clearer brand hierarchy and more noticeable calls to action.",
    estimatedTime: "<10 seconds",
  },
};

const BY_CATEGORY: Record<
  AdvisorFinding["category"],
  (finding: AdvisorFinding) => ExplanationTemplate
> = {
  conversion: (f) => ({
    noticed: `There’s a conversion gap: ${sentenceCase(f.title)}.`,
    whyItMatters:
      "Small friction in how people take the next step often costs ready leads.",
    expectedOutcome: "More visitors completing the action you care about most.",
  }),
  trust: (f) => ({
    noticed: `There’s a trust gap: ${sentenceCase(f.title)}.`,
    whyItMatters:
      "People hesitate when they can’t quickly see proof that you’re the right choice.",
    expectedOutcome: "Stronger confidence before visitors decide to reach out.",
  }),
  readability: (f) => ({
    noticed: `Readability needs work: ${sentenceCase(f.title)}.`,
    whyItMatters: "If the page is hard to scan, your offer never fully lands.",
    expectedOutcome: "Clearer messaging and more people reading far enough to act.",
  }),
  mobile_usability: (f) => ({
    noticed: `On mobile, ${sentenceCase(f.title).replace(/\.$/, "").toLowerCase()}.`,
    whyItMatters:
      "Most visitors browse on phones — friction there quietly kills conversions.",
    expectedOutcome: "Smoother mobile visits and more completed actions.",
  }),
  accessibility: (f) => ({
    noticed: `Accessibility needs attention: ${sentenceCase(f.title)}.`,
    whyItMatters:
      "When key actions are hard to see or use, you lose both visitors and trust.",
    expectedOutcome: "A more inclusive experience and clearer primary actions.",
  }),
  seo: (f) => ({
    noticed: `Search presentation can be stronger: ${sentenceCase(f.title)}.`,
    whyItMatters:
      "Search snippets are often the first impression of your business.",
    expectedOutcome: "More qualified visits from people already looking for you.",
  }),
  visual_hierarchy: (f) => ({
    noticed: `Hierarchy is flat: ${sentenceCase(f.title)}.`,
    whyItMatters:
      "Without clear visual priority, visitors miss what matters most.",
    expectedOutcome: "Faster scanning and a more professional first impression.",
  }),
  cta_effectiveness: (f) => ({
    noticed: sentenceCase(f.title),
    whyItMatters:
      "Visitors may overlook the most important action on your page.",
    expectedOutcome:
      "Better visibility and potentially more contact requests.",
  }),
  branding_consistency: (f) => ({
    noticed: `Brand cues are inconsistent: ${sentenceCase(f.title)}.`,
    whyItMatters:
      "Inconsistent brand cues make the site feel less intentional and less memorable.",
    expectedOutcome: "A sharper brand presence that supports trust and action.",
  }),
  missing_sections: (f) => ({
    noticed: `Something important is missing: ${sentenceCase(f.title)}.`,
    whyItMatters:
      "Key sections answer questions and objections before someone decides to contact you.",
    expectedOutcome: "A more complete story and fewer drop-offs from hesitation.",
  }),
};

function sentenceCase(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

function estimateTime(
  finding: AdvisorFinding,
  override?: string,
): string {
  if (override) return override;
  const ops = finding.operations?.length ?? 0;
  if (finding.impact === "low" || ops <= 1) return "<10 seconds";
  if (ops <= 2) return "~30 seconds";
  return "~1 minute";
}

/**
 * Build designer/marketer-quality critique copy for a finding.
 */
export function explainAdvisorFinding(
  finding: AdvisorFinding,
): CritiqueExplanation {
  const template = BY_ID[finding.id] ?? BY_CATEGORY[finding.category](finding);
  return {
    noticed: template.noticed,
    whyItMatters: template.whyItMatters || finding.why,
    expectedOutcome: template.expectedOutcome,
    estimatedTime: estimateTime(finding, template.estimatedTime),
  };
}

/** Map advisor findings onto the six scored critique categories. */
export function critiqueCategoryForFinding(
  category: AdvisorFinding["category"],
): "conversion" | "trust" | "seo" | "accessibility" | "mobile" | "branding" {
  switch (category) {
    case "conversion":
    case "cta_effectiveness":
      return "conversion";
    case "trust":
    case "missing_sections":
      return "trust";
    case "seo":
      return "seo";
    case "accessibility":
      return "accessibility";
    case "mobile_usability":
    case "readability":
      return "mobile";
    case "branding_consistency":
    case "visual_hierarchy":
      return "branding";
    default:
      return "conversion";
  }
}

export function impactLabel(impact: AdvisorImpact): string {
  switch (impact) {
    case "high":
      return "High";
    case "medium":
      return "Medium";
    case "low":
      return "Low";
  }
}
