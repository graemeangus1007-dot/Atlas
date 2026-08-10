/**
 * v1.6.3 — Riverview Review UX + CTA execution + strategic feedback loop.
 */

import { describe, expect, it } from "vitest";
import { MOCK_BUSINESS_PROJECT } from "@/data/mock-project";
import { runAtlasBrain } from "@/lib/ai/atlas-brain";
import {
  assessStrategicPriorities,
  formatContainsEmptySectionHeadings,
} from "@/lib/strategy";
import type { BusinessProject } from "@/types/business-project";

/** Riverview with proof present so CTA can rank #1 when the label is generic. */
function riverviewCtaFirst(): BusinessProject {
  return {
    ...MOCK_BUSINESS_PROJECT,
    businessName: "Riverview Bakery",
    businessType: "Coffee Shop",
    primaryCta: "Learn More",
    heroOverlay: 0.25,
    atlasActionMemory: undefined,
    designSections: {
      enabled: ["testimonials", "gallery", "faq"],
      testimonials: [
        {
          id: "t1",
          quote: "Best bakery in town — fresh every morning.",
          author: "Alex Rivera",
          role: "Regular",
        },
        {
          id: "t2",
          quote: "The pastries are incredible.",
          author: "Sam Chen",
          role: "Neighbor",
        },
      ],
      faq: [{ id: "f1", question: "Hours?", answer: "7am–3pm daily." }],
    },
  };
}

describe("v1.6.3 Riverview Review UX + CTA execution", () => {
  it("Review presents an agency-quality assessment without empty headings", async () => {
    const project = riverviewCtaFirst();
    const before = assessStrategicPriorities({ project });
    expect(before.highestPriorityOpportunity?.id).toBe("cta");

    const review = await runAtlasBrain({
      project,
      request: "Review my website.",
    });
    expect(review.applyStatus).toBe("no_changes");
    expect(review.explanation).toMatch(/Riverview Bakery|conversion clarity|primary next step/i);
    expect(review.explanation).toMatch(/Highest priority/i);
    expect(review.explanation).toMatch(/Clarify the primary CTA/i);
    expect(review.explanation).toMatch(/Next improvements/i);
    expect(review.explanation).toMatch(/improvements? ready/i);
    expect(review.explanation).not.toMatch(/close the remaining restraint/i);
    expect(formatContainsEmptySectionHeadings(review.explanation)).toBe(false);
    expect(
      review.project.atlasActionMemory?.activePlan?.reviewPlanSnapshot
        ?.highestPriorityOpportunityId,
    ).toBe("cta");
    expect(
      review.followUpSuggestions.some((s) => /Apply All/i.test(s)) ||
        /Apply all/i.test(review.explanation),
    ).toBe(true);
  });

  it("Apply All refines CTA, accounts for dispositions, then CTA is no longer #1", async () => {
    const project = riverviewCtaFirst();
    const review = await runAtlasBrain({
      project,
      request: "Review my website.",
    });

    const paletteBefore = {
      primary: review.project.primaryColor,
      accent: review.project.accentColor,
      heading: review.project.headingFont,
      hero: review.project.heroImageId,
      headline: review.project.heroHeadline,
    };

    const apply = await runAtlasBrain({
      project: review.project,
      request: "Apply All",
    });

    expect(apply.explanation).toMatch(/I evaluated all \d+ approved/i);
    expect(apply.project.primaryCta).not.toBe("Learn More");
    expect(apply.project.primaryCta).toMatch(/menu|visit/i);
    expect(apply.project.primaryColor).toBe(paletteBefore.primary);
    expect(apply.project.accentColor).toBe(paletteBefore.accent);
    expect(apply.project.headingFont).toBe(paletteBefore.heading);
    expect(apply.project.heroImageId).toBe(paletteBefore.hero);
    expect(apply.project.heroHeadline).toBe(paletteBefore.headline);
    expect(apply.operations.every((op) => {
      const kind = String(op.operation);
      return (
        kind === "replaceText" ||
        kind === "insertSection" ||
        kind === "setCreativePolish" ||
        kind === "updateSeo" ||
        kind === "setTypography" ||
        kind === "moveSection"
      );
    })).toBe(true);

    // Critical: after CTA refinement, strategic priority should move on.
    const after = assessStrategicPriorities({ project: apply.project });
    expect(after.highestPriorityOpportunity?.id).not.toBe("cta");

    const advisory = await runAtlasBrain({
      project: apply.project,
      request: "What's the biggest weakness?",
    });
    expect(advisory.applyStatus).toBe("no_changes");
    // Should not still lead with CTA clarity as the #1 message.
    expect(advisory.explanation).not.toMatch(
      /biggest (remaining )?opportunity is conversion clarity/i,
    );
  }, 120_000);
});
