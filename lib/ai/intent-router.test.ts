/**
 * Sprint 22.2 — Intent routing + explicit FAQ/content edit regression tests.
 */

import { describe, expect, it } from "vitest";
import { applyEditOperations } from "@/lib/ai/apply-edit-operations";
import { createDefaultFaqItems } from "@/lib/ai/design-sections-canonical";
import { planExplicitContentEdits } from "@/lib/ai/content-edit-planner";
import {
  planEditOperations,
  runEditorAgent,
} from "@/lib/ai/editor-agent";
import { routeIntent } from "@/lib/ai/intent-router";
import { MOCK_BUSINESS_PROJECT } from "@/data/mock-project";
import type { BusinessProject } from "@/types/business-project";

function sampleProject(): BusinessProject {
  return {
    ...MOCK_BUSINESS_PROJECT,
    businessName: "Linda's Cookies",
    heroHeadline: "Fresh cookies daily",
    heroSubheadline: "Baked this morning",
    primaryCta: "Order online",
    description: "A neighborhood bakery.",
    services: [
      { title: "Custom cakes", description: "Celebration cakes made to order." },
      { title: "Cookie boxes", description: "Assorted cookies for any occasion." },
    ],
    designSections: {
      enabled: ["faq"],
      faq: createDefaultFaqItems("Linda's Cookies"),
    },
    publish: null,
  };
}

describe("intent routing", () => {
  it("classifies FAQ answer updates as explicit_content_edit", async () => {
    const intent = routeIntent({
      request: `Update the answer to "How do I get started with Linda's Cookies?" to:\n"You give us a call!"`,
    });
    expect(intent.category).toBe("explicit_content_edit");
    expect(intent.skipBusinessReasoning).toBe(true);
  });

  it("classifies mixed FAQ + premium as mixed", async () => {
    const intent = routeIntent({
      request:
        'Update the FAQ answer to "What areas do you serve?" to "Local delivery only" and make the website feel more premium.',
    });
    expect(intent.category).toBe("mixed");
  });
});

describe("updating FAQ answer", () => {
  it("replaces only the matched FAQ answer and preserves the rest of the site", async () => {
    const project = sampleProject();
    const before = structuredClone(project);
    const request = `Update the answer to "How do I get started with Linda's Cookies?" to:\n"You give us a call!"`;

    const result = await runEditorAgent({ project, request });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.applyStatus).toBe("applied");
    expect(result.operations.some((op) => op.operation === "updateFaqAnswer")).toBe(
      true,
    );
    expect(result.operations.some((op) => op.operation === "insertSection")).toBe(
      false,
    );
    expect(
      result.operations.some((op) => op.operation === "replaceText"),
    ).toBe(false);

    const faq = result.project.designSections?.faq ?? [];
    const updated = faq.find((item) =>
      /how do i get started with linda's cookies/i.test(item.question),
    );
    expect(updated?.answer).toBe("You give us a call!");

    // Unrelated content preserved
    expect(result.project.heroHeadline).toBe(before.heroHeadline);
    expect(result.project.heroSubheadline).toBe(before.heroSubheadline);
    expect(result.project.primaryCta).toBe(before.primaryCta);
    expect(result.project.designSections?.faq?.length).toBe(
      before.designSections?.faq?.length,
    );
    expect(result.project.services).toEqual(before.services);
  });
});

describe("business reasoning is bypassed", () => {
  it("does not apply phone-call / testimonials goals for an FAQ answer edit", async () => {
    const planned = planEditOperations({
      project: sampleProject(),
      request: `Update the answer to "How do I get started with Linda's Cookies?" to: "You give us a call!"`,
    });

    expect(planned.reasoning).toBeUndefined();
    expect(planned.operations).toHaveLength(1);
    expect(planned.operations[0]?.operation).toBe("updateFaqAnswer");
    expect(
      planned.operations.some(
        (op) =>
          op.operation === "insertSection" && op.type === "testimonials",
      ),
    ).toBe(false);
  });
});

describe("replacing hero text", () => {
  it("updates only the hero headline", async () => {
    const project = sampleProject();
    const result = await runEditorAgent({
      project,
      request: 'Change the hero headline to "Cookies worth the drive"',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.project.heroHeadline).toBe("Cookies worth the drive");
    expect(result.project.primaryCta).toBe(project.primaryCta);
    expect(result.project.designSections?.faq).toEqual(project.designSections?.faq);
  });
});

describe("changing button text", () => {
  it("updates only the primary CTA", async () => {
    const project = sampleProject();
    const result = await runEditorAgent({
      project,
      request: 'Update the button text to "Call the bakery"',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.project.primaryCta).toBe("Call the bakery");
    expect(result.project.heroHeadline).toBe(project.heroHeadline);
  });
});

describe("editing services", () => {
  it("updates a single service title", async () => {
    const project = sampleProject();
    const result = await runEditorAgent({
      project,
      request: 'Change the first service title to "Wedding cookies"',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.project.services[0]?.title).toBe("Wedding cookies");
    expect(result.project.services[1]?.title).toBe(project.services[1]?.title);
    expect(result.project.heroHeadline).toBe(project.heroHeadline);
  });
});

describe("mixed requests", () => {
  it("applies FAQ edit plus premium design without dropping the FAQ change", async () => {
    const project = sampleProject();
    const result = await runEditorAgent({
      project,
      request:
        'Update the FAQ answer to "What areas do you serve?" to "Local delivery only" and make the website feel more premium.',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const faq = result.project.designSections?.faq?.find((item) =>
      /what areas do you serve/i.test(item.question),
    );
    expect(faq?.answer).toBe("Local delivery only");
    expect(result.operations.some((op) => op.operation === "updateFaqAnswer")).toBe(
      true,
    );
    expect(
      result.operations.some(
        (op) =>
          op.operation === "setTemplate" ||
          op.operation === "setTypography" ||
          op.operation === "changeTheme",
      ),
    ).toBe(true);
  });
});

describe("preserving unrelated content", () => {
  it("FAQ ops do not rewrite hero when applied in isolation", async () => {
    const project = sampleProject();
    const planned = planExplicitContentEdits({
      project,
      request: `Update the answer to "Do you offer consultations?" to "Yes — call us anytime."`,
    });
    const applied = applyEditOperations(project, planned.operations);
    expect(applied.project.heroHeadline).toBe(project.heroHeadline);
    expect(applied.project.primaryColor).toBe(project.primaryColor);
    expect(
      applied.project.designSections?.faq?.find((f) =>
        /consultations/i.test(f.question),
      )?.answer,
    ).toBe("Yes — call us anytime.");
  });
});
