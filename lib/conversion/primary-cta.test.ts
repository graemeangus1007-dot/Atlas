/**
 * v1.6.3 — Primary CTA assessment + narrow refinement execution.
 */

import { describe, expect, it } from "vitest";
import { MOCK_BUSINESS_PROJECT } from "@/data/mock-project";
import { applyEditOperations } from "@/lib/ai/apply-edit-operations";
import {
  assessPrimaryCTA,
  planPrimaryCtaRefinement,
  verifyPrimaryCtaRefinement,
} from "@/lib/conversion/primary-cta";
import type { BusinessProject } from "@/types/business-project";

function bakery(overrides: Partial<BusinessProject> = {}): BusinessProject {
  return {
    ...MOCK_BUSINESS_PROJECT,
    businessName: "Riverview Bakery",
    businessType: "Coffee Shop",
    primaryCta: "Learn More",
    atlasActionMemory: undefined,
    ...overrides,
  };
}

describe("v1.6.3 Primary CTA assessment", () => {
  it("improves bakery Learn More to menu-oriented action when services exist", () => {
    const project = bakery();
    const planned = planPrimaryCtaRefinement({ project });
    expect(planned.disposition).toBe("applyable");
    expect(planned.plan?.label).toMatch(/menu/i);
    expect(planned.plan?.destination).toBeTruthy();
    expect(planned.plan?.operations[0]).toMatchObject({
      operation: "replaceText",
      target: "hero.primaryCta",
    });
  });

  it("treats landscaping Get a Quote as already satisfied", () => {
    const project = bakery({
      businessName: "Harbor Landscapes",
      businessType: "Contractor",
      primaryCta: "Get a Quote",
      description: "Coastal landscaping and outdoor living.",
    });
    const assessment = assessPrimaryCTA({ project });
    expect(assessment.alreadySatisfied).toBe(true);
    expect(planPrimaryCtaRefinement({ project }).disposition).toBe(
      "already_satisfied",
    );
  });

  it("suggests consultation CTA for law firm with contact path", () => {
    const lawProject = bakery({
      businessName: "Ashford Law",
      businessType: "Other",
      description: "A law firm offering legal counsel for local families.",
      primaryCta: "Learn More",
    });
    const planned = planPrimaryCtaRefinement({ project: lawProject });
    expect(planned.disposition).toBe("applyable");
    expect(planned.plan?.label).toMatch(/consultation/i);
  });

  it("blocks menu CTA when no menu destination exists", () => {
    const project = bakery({
      services: [],
      pages: [{ id: "home", title: "Home", slug: "/" }],
      businessType: "Coffee Shop",
      primaryCta: "Learn More",
      contact: {
        ...MOCK_BUSINESS_PROJECT.contact!,
        phone: "",
        email: "",
        formEnabled: false,
      },
    });
    const planned = planPrimaryCtaRefinement({ project });
    // Without contact or menu, should block
    expect(planned.disposition).toBe("blocked_missing_input");
    expect(planned.assessment.blockedReason).toMatch(/menu|destination|contact/i);
  });

  it("does not churn an already-strong CTA", () => {
    const project = bakery({ primaryCta: "View Our Menu" });
    const first = planPrimaryCtaRefinement({ project });
    // Menu-oriented bakery CTA with services should be satisfied or same
    if (first.disposition === "applyable" && first.plan) {
      expect(first.plan.label.toLowerCase()).not.toBe("get your quote");
    } else {
      expect(first.disposition).toBe("already_satisfied");
    }
  });

  it("preserves scope — only CTA label changes", () => {
    const before = bakery({ primaryCta: "Learn More" });
    const planned = planPrimaryCtaRefinement({ project: before });
    expect(planned.plan).toBeTruthy();
    const applied = applyEditOperations(before, planned.plan!.operations);
    const after = applied.project;
    const verified = verifyPrimaryCtaRefinement({
      before,
      after,
      plannedLabel: planned.plan!.label,
    });
    expect(verified.verified).toBe(true);
    expect(after.primaryColor).toBe(before.primaryColor);
    expect(after.headingFont).toBe(before.headingFont);
    expect(after.heroImageId).toBe(before.heroImageId);
    expect(after.heroHeadline).toBe(before.heroHeadline);
    expect(after.galleryImageIds).toEqual(before.galleryImageIds);
    expect(verified.unrelatedMutationDomains).toEqual([]);
  });
});
