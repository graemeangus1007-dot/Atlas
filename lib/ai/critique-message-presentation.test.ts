import { describe, expect, it } from "vitest";
import {
  applyImprovementRequest,
  parseCritiqueMessage,
  toExecutiveSummary,
} from "@/lib/ai/critique-message-presentation";

function words(n: number): string {
  return Array.from({ length: n }, (_, i) => `word${i}`).join(" ");
}

const SAMPLE_CRITIQUE = [
  "This homepage feels warm but unfinished — hierarchy and proof need work before launch.",
  "",
  "Design direction",
  "Warm Bakery Editorial — approachable craft with clearer CTAs.",
  "",
  "Strengths",
  "• Friendly brand voice — cookies feel personal",
  "• Clear service list — easy to scan offerings",
  "",
  "Top improvements",
  "1. Hero",
  "   Why it matters: Stronger headline and CTA lift first-visit conversions.",
  "2. Gallery",
  "   Why it matters: Real product photos build appetite and trust.",
  "3. Trust",
  "   Why it matters: Testimonials reduce hesitation before ordering.",
  "",
  "Expected outcome",
  "A bakery homepage that feels intentional, trustworthy, and ready to convert.",
  "",
  "Say Apply All when you’re ready, or apply any single improvement.",
].join("\n");

const SAMPLE_STRATEGY_CRITIQUE = [
  "Harbor Craft feels capable but unproven before the quote ask.",
  "",
  "Overall direction",
  "Premium coastal craftsmanship (luxury · premium · handcrafted)",
  "",
  "Biggest problem",
  "Visitors don’t see enough proof of the work before being asked to take action.",
  "",
  "Design goals",
  "• Increase trust before the ask.",
  "• Reduce cognitive load in the first viewport.",
  "",
  "Execution plan",
  "1. Rebuild the hero for one clear promise.",
  "2. Place testimonials directly below the hero.",
  "",
  "Strengths",
  "• Clear service promise — headline states the offer",
  "",
  "Top improvements",
  "1. Place testimonials below the hero",
  "   Why it matters: Visitors haven’t seen enough proof before evaluating services.",
  "",
  "Expected outcome",
  "A premium coastal homepage that earns trust before the quote request.",
  "",
  "Say Apply all when you’re ready, or pick any single improvement.",
].join("\n");

describe("parseCritiqueMessage", () => {
  it("parses structured critique into summary + improvement cards", () => {
    const parsed = parseCritiqueMessage(SAMPLE_CRITIQUE);
    expect(parsed.kind).toBe("critique");
    expect(parsed.executiveSummary).toMatch(/warm|unfinished|hierarchy/i);
    expect(parsed.improvements).toHaveLength(3);
    expect(parsed.improvements[0]?.title).toBe("Hero");
    expect(parsed.improvements[0]?.why).toMatch(/headline|CTA/i);
    expect(parsed.expectedOutcome).toMatch(/intentional/i);
    expect(parsed.shouldCollapseFull).toBe(true);
    expect(parsed.applyAllReady).toBe(true);
  });

  it("parses v1.1 design strategy headings", () => {
    const parsed = parseCritiqueMessage(SAMPLE_STRATEGY_CRITIQUE);
    expect(parsed.kind).toBe("critique");
    expect(parsed.designDirection).toMatch(/Premium coastal craftsmanship/i);
    expect(parsed.improvements[0]?.title).toMatch(/testimonials/i);
    expect(parsed.improvements[0]?.why).toMatch(/proof|trust/i);
    expect(parsed.expectedOutcome).toMatch(/premium coastal/i);
  });

  it("collapses long plain messages (~1500 words)", () => {
    const body = `${words(40)}. ${words(1460)}`;
    const parsed = parseCritiqueMessage(body);
    expect(parsed.kind).toBe("plain");
    expect(parsed.wordCount).toBeGreaterThan(1400);
    expect(parsed.shouldCollapseFull).toBe(true);
    expect(parsed.executiveSummary.split(/\s+/).length).toBeLessThan(80);
  });

  it("collapses plain messages at the compact threshold (~80+ words)", () => {
    const body = words(200);
    const parsed = parseCritiqueMessage(body);
    expect(parsed.kind).toBe("plain");
    expect(parsed.wordCount).toBe(200);
    expect(parsed.shouldCollapseFull).toBe(true);
  });

  it("keeps very short plain messages fully visible", () => {
    const body = words(40);
    const parsed = parseCritiqueMessage(body);
    expect(parsed.kind).toBe("plain");
    expect(parsed.shouldCollapseFull).toBe(false);
  });
});

describe("toExecutiveSummary", () => {
  it("keeps 2–4 sentences", () => {
    const text =
      "One. Two. Three. Four. Five. Six.";
    const summary = toExecutiveSummary(text);
    expect(summary.split(/(?<=[.!?])\s+/).length).toBeLessThanOrEqual(4);
  });
});

describe("applyImprovementRequest", () => {
  it("emits ordinal phrases Action Memory understands", () => {
    expect(applyImprovementRequest(0)).toBe("Apply the first one");
    expect(applyImprovementRequest(2)).toBe("Apply the third one");
  });
});
