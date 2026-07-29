/**
 * @vitest-environment jsdom
 *
 * FAQ visibility + editor/publish render path regression tests.
 */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import EditorCanvas from "@/components/editor/editor-canvas";
import WebsiteRenderer from "@/components/templates/website-renderer";
import { applyAdvisorRecommendation } from "@/lib/ai/apply-advisor-recommendation";
import { applyEditOperations } from "@/lib/ai/apply-edit-operations";
import type { BusinessRecommendation } from "@/lib/ai/business-advisor-types";
import {
  assertInsertedSectionsVisible,
  createDefaultFaqItems,
  isDesignSectionVisibleInContent,
  isDesignSectionVisibleInProject,
} from "@/lib/ai/design-sections-canonical";
import { validateEditOperations } from "@/lib/ai/validate-edit-operations";
import { MOCK_BUSINESS_PROJECT } from "@/data/mock-project";
import { buildStaticSite } from "@/lib/publishing/build-static-site";
import "@/lib/templates";
import { getTemplate } from "@/lib/templates";
import { generateWebsiteContent } from "@/lib/website-generator";
import type { BusinessProject } from "@/types/business-project";

vi.mock("@/context/template-context", () => ({
  useTemplate: () => ({
    template: getTemplate("modern"),
    templateId: "modern",
  }),
}));

afterEach(() => {
  cleanup();
});

function sampleProject(): BusinessProject {
  return {
    ...MOCK_BUSINESS_PROJECT,
    businessName: "Cedar Cafe",
    designSections: undefined,
    publish: null,
  };
}

function faqRecommendation(): BusinessRecommendation {
  return {
    id: "sections.faq",
    category: "missing_sections",
    title: "Add an FAQ section",
    why: "why",
    noticed: "noticed",
    whyItMatters: "why",
    expectedOutcome: "outcome",
    estimatedTime: "~30 seconds",
    impact: "medium",
    impactScore: 72,
    confidence: 0.84,
    destructive: false,
    narrative: "noticed",
    scoreCategory: "trust",
    operations: validateEditOperations([
      { operation: "insertSection", type: "faq" },
    ]),
  };
}

describe("canonical FAQ structure", () => {
  it("applying FAQ inserts canonical FAQ data", () => {
    const result = applyAdvisorRecommendation({
      project: sampleProject(),
      recommendation: faqRecommendation(),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.status).toBe("applied");

    const faq = result.project.designSections?.faq;
    expect(result.project.designSections?.enabled).toContain("faq");
    expect(faq?.length).toBeGreaterThan(0);
    expect(faq?.[0]).toEqual(
      expect.objectContaining({
        question: expect.any(String),
        answer: expect.any(String),
      }),
    );
    expect(faq).toEqual(createDefaultFaqItems("Cedar Cafe"));
    expect(isDesignSectionVisibleInProject(result.project, "faq")).toBe(true);
  });
});

describe("editor renderer displays FAQ", () => {
  it("EditorCanvas mounts the FAQ from generated content", () => {
    const applied = applyEditOperations(sampleProject(), [
      { operation: "insertSection", type: "faq" },
    ]).project;
    const content = generateWebsiteContent(applied);

    render(
      <EditorCanvas
        content={content}
        contact={applied.contact}
        onBusinessNameChange={() => {}}
        onHeadlineChange={() => {}}
        onSubheadlineChange={() => {}}
        onAboutChange={() => {}}
        onPrimaryCtaChange={() => {}}
        onServiceChange={() => {}}
        onContactChange={() => {}}
        onGalleryTitleChange={() => {}}
        onImproveField={() => {}}
      />,
    );

    expect(screen.getByTestId("design-section-faq")).toBeTruthy();
    expect(screen.getByText("Frequently asked questions")).toBeTruthy();
    expect(
      screen.getByText(/How do I get started with Cedar Cafe/i),
    ).toBeTruthy();
  });
});

describe("preview and publish display FAQ", () => {
  it("WebsiteRenderer and published HTML both include FAQ", () => {
    const applied = applyEditOperations(sampleProject(), [
      { operation: "insertSection", type: "faq" },
    ]).project;
    const content = generateWebsiteContent(applied);
    expect(isDesignSectionVisibleInContent(content, "faq")).toBe(true);

    render(
      <WebsiteRenderer
        content={content}
        template={getTemplate(applied.templateId || "modern")}
      />,
    );
    expect(screen.getByTestId("design-section-faq")).toBeTruthy();

    const artifact = buildStaticSite(applied);
    const html =
      artifact.files.find((f) => f.path === "index.html")?.content ?? "";
    expect(html).toMatch(/Frequently asked questions/i);
    expect(html).toMatch(/How do I get started with Cedar Cafe/i);
  });
});

describe("refresh preserves FAQ", () => {
  it("round-trips designSections through generated content (persist shape)", () => {
    const applied = applyEditOperations(sampleProject(), [
      { operation: "insertSection", type: "faq" },
    ]).project;

    const persisted = JSON.parse(
      JSON.stringify({
        ...applied,
        designSections: applied.designSections,
      }),
    ) as BusinessProject;
    const content = generateWebsiteContent(persisted);
    expect(content.designSections?.enabled).toContain("faq");
    expect(content.designSections?.faq?.length).toBeGreaterThan(0);
    expect(
      assertInsertedSectionsVisible(persisted, [
        { operation: "insertSection", type: "faq" },
      ]).ok,
    ).toBe(true);
  });
});

describe("false success cannot occur when section is invisible", () => {
  it("blocks Applied when FAQ is not visible and populates empty arrays", () => {
    const invisible: BusinessProject = {
      ...sampleProject(),
      designSections: {
        enabled: ["faq"],
        faq: [],
      },
    };
    expect(isDesignSectionVisibleInProject(invisible, "faq")).toBe(false);
    expect(
      assertInsertedSectionsVisible(invisible, [
        { operation: "insertSection", type: "faq" },
      ]).ok,
    ).toBe(false);

    const fromEmpty = applyAdvisorRecommendation({
      project: {
        ...sampleProject(),
        designSections: { enabled: [], faq: [] },
      },
      recommendation: faqRecommendation(),
      requestId: "vis-1",
    });
    expect(fromEmpty.ok).toBe(true);
    if (!fromEmpty.ok) return;
    expect(fromEmpty.status).toBe("applied");
    expect(isDesignSectionVisibleInProject(fromEmpty.project, "faq")).toBe(
      true,
    );
  });
});
