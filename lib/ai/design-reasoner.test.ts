/**
 * Sprint 22.1 — goal-based design reasoning regression tests.
 */

import { describe, expect, it } from "vitest";
import { MOCK_BUSINESS_PROJECT } from "@/data/mock-project";
import {
  operationsFromDesignReasoning,
  reasonAboutDesign,
} from "@/lib/ai/design-reasoner";
import {
  planDirectEditOperations,
  planEditOperations,
  runEditorAgent,
} from "@/lib/ai/editor-agent";

function sampleProject() {
  return {
    ...MOCK_BUSINESS_PROJECT,
    businessName: "Cedar Cafe",
    contact: {
      ...MOCK_BUSINESS_PROJECT.contact,
      phone: "(555) 111-2222",
    },
    publish: null,
  };
}

describe("business goals", () => {
  it("infers phone-call conversion from plain language", () => {
    const reasoning = reasonAboutDesign({
      request: "I want more people to call me.",
      project: sampleProject(),
    });
    expect(reasoning.goal).toBe("increase_phone_calls");
    expect(reasoning.confidence).toBeGreaterThanOrEqual(0.72);
    expect(reasoning.shouldAct).toBe(true);
    expect(reasoning.editObjectives.length).toBeGreaterThan(0);

    const result = runEditorAgent({
      project: sampleProject(),
      request: "I want more people to call me.",
    });
    expect(result.applyStatus).toBe("applied");
    expect(result.project.primaryCta.toLowerCase()).toMatch(/call/);
    expect(result.project.designSections?.enabled).toContain("testimonials");
    expect(result.reasoning?.inferredGoal).toMatch(/phone calls/i);
  });

  it("infers lead capture from “I need more leads”", () => {
    const result = runEditorAgent({
      project: sampleProject(),
      request: "I need more leads.",
    });
    expect(result.applyStatus).toBe("applied");
    expect(result.reasoning?.goal).toBe("increase_leads");
    expect(result.project.primaryCta.toLowerCase()).toMatch(/quote|get/i);
    expect(result.project.designSections?.enabled).toContain("newsletter");
  });

  it("infers modernization from “This feels outdated.”", () => {
    const reasoning = reasonAboutDesign({
      request: "This feels outdated.",
      project: sampleProject(),
    });
    expect(reasoning.goal).toBe("modernize_appearance");
    expect(reasoning.shouldAct).toBe(true);

    const result = runEditorAgent({
      project: sampleProject(),
      request: "This feels outdated.",
    });
    expect(result.applyStatus).toBe("applied");
    expect(result.project.templateId).toBe("modern");
    expect(result.project.headingFont).toBe("manrope");
  });
});

describe("emotional feedback", () => {
  it("asks what feels off instead of failing or no-opping", () => {
    const reasoning = reasonAboutDesign({
      request: "I don't like it.",
      project: sampleProject(),
    });
    expect(reasoning.goal).toBe("unknown");
    expect(reasoning.shouldAct).toBe(false);
    expect(reasoning.followUpQuestion).toMatch(/feels off|colors|layout|wording/i);

    const result = runEditorAgent({
      project: sampleProject(),
      request: "I don't like it.",
    });
    expect(result.applyStatus).toBe("needs_clarification");
    expect(result.operations).toHaveLength(0);
    // Atlas Brain asks a concise multiple-choice clarification.
    expect(result.explanation).toMatch(
      /feels off|colors|layout|wording|Did you mean|Better visuals|Better copy/i,
    );
    expect(result.project.heroHeadline).toBe(sampleProject().heroHeadline);
  });
});

describe("ambiguous requests", () => {
  it("asks a concise follow-up for vague “make it better”", () => {
    const result = runEditorAgent({
      project: sampleProject(),
      request: "Make it better.",
    });
    expect(result.applyStatus).toBe("needs_clarification");
    expect(result.operations).toHaveLength(0);
    expect(result.explanation.length).toBeGreaterThan(10);
    expect(result.explanation.toLowerCase()).not.toMatch(/no changes needed/);
  });
});

describe("follow-up question behavior", () => {
  it("returns needs_clarification with a single question, not silent failure", () => {
    const planned = planEditOperations({
      project: sampleProject(),
      request: "asdf qwerty zxcv unrelated gibberish",
    });
    expect(planned.needsClarification).toBe(true);
    expect(planned.operations).toHaveLength(0);
    expect(planned.explanation.endsWith("?")).toBe(true);

    const ops = operationsFromDesignReasoning(
      {
        goal: "unknown",
        confidence: 0.1,
        inferredGoal: "Unknown",
        designStrategy: "Ask",
        editObjectives: [],
        followUpQuestion: "What should we improve?",
        shouldAct: false,
      },
      sampleProject(),
    );
    expect(ops).toHaveLength(0);
  });
});

describe("existing direct edit commands", () => {
  it("still applies FAQ / theme commands without requiring goal language", () => {
    const faq = planDirectEditOperations({
      project: sampleProject(),
      request: "Add an FAQ.",
    });
    expect(faq.operations.some((op) => op.operation === "insertSection")).toBe(
      true,
    );

    const result = runEditorAgent({
      project: sampleProject(),
      request: "Add an FAQ.",
    });
    expect(result.applyStatus).toBe("applied");
    expect(result.project.designSections?.enabled).toContain("faq");
  });

  it("still applies navy + gold theme while preserving wording", () => {
    const before = sampleProject();
    const result = runEditorAgent({
      project: before,
      request:
        "Change the website to a dark navy theme with gold accents. Keep all wording exactly the same.",
    });
    expect(result.applyStatus).toBe("applied");
    expect(result.project.accentColor).toBe("#d4af37");
    expect(result.project.heroHeadline).toBe(before.heroHeadline);
  });
});
