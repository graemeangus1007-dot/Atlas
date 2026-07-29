/**
 * @vitest-environment jsdom
 *
 * Atlas AI panel layout — conversation primary, prompt sticky, Review below.
 */
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import AtlasAiPanel from "@/components/editor/atlas-ai-panel";
import type { BusinessAdvisorReport } from "@/lib/ai/business-advisor-types";
import { MOCK_BUSINESS_PROJECT } from "@/data/mock-project";

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

vi.mock("@/components/ui/button", () => ({
  default: ({
    children,
    ...props
  }: React.PropsWithChildren<Record<string, unknown>>) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
}));

function sampleReport(count = 2): BusinessAdvisorReport {
  return {
    overallScore: 62,
    categoryScores: {
      conversion: 60,
      trust: 55,
      seo: 70,
      accessibility: 80,
      mobile: 75,
      branding: 50,
    },
    summary: "I noticed a few ways to strengthen this site.",
    reviewedAt: "2026-01-01T00:00:00.000Z",
    fingerprint: "fp-test",
    recommendations: Array.from({ length: count }, (_, i) => ({
      id: i === 0 ? "trust.testimonials" : `rec.${i}`,
      category: "trust" as const,
      title: i === 0 ? "Add testimonials" : `Opportunity ${i}`,
      why: "why",
      noticed: "noticed",
      whyItMatters: "why",
      expectedOutcome: "outcome",
      estimatedTime: "~30 seconds",
      impact: "high" as const,
      impactScore: 91 - i,
      confidence: 0.9,
      destructive: false,
      narrative: "noticed",
      scoreCategory: "trust" as const,
      operations: [{ operation: "insertSection" as const, type: "testimonials" as const }],
    })),
  };
}

describe("Atlas AI panel layout", () => {
  it("gives conversation most height, keeps prompt reachable, Review below prompt", () => {
    const messages = Array.from({ length: 8 }, (_, i) => ({
      id: `m-${i}`,
      role: (i % 2 === 0 ? "user" : "assistant") as "user" | "assistant",
      content: `Message ${i}`,
      createdAt: new Date().toISOString(),
    }));

    render(
      <div style={{ height: 720, display: "flex" }}>
        <AtlasAiPanel
          project={MOCK_BUSINESS_PROJECT}
          projectId="proj-layout"
          messages={messages}
          status="idle"
          canUndo={false}
          canRedo={false}
          lastChanges={null}
          advisorReport={sampleReport(2)}
          onSend={() => {}}
          onUndo={() => {}}
          onRedo={() => {}}
        />
      </div>,
    );

    const panel = screen.getByTestId("atlas-ai-panel");
    const conversation = within(panel).getByTestId("atlas-conversation-region");
    const prompt = within(panel).getByTestId("atlas-prompt-region");
    const review = within(panel).getByTestId("atlas-review-region");

    expect(conversation.className).toMatch(/flex-1/);
    expect(conversation.className).toMatch(/min-h-\[12rem\]/);
    expect(within(prompt).getByLabelText("Design request")).toBeTruthy();

    // DOM order: conversation → prompt → review
    const children = Array.from(panel.children);
    const conversationIndex = children.indexOf(conversation);
    const promptIndex = children.indexOf(prompt);
    const reviewIndex = children.indexOf(review);
    expect(conversationIndex).toBeLessThan(promptIndex);
    expect(promptIndex).toBeLessThan(reviewIndex);

    expect(within(review).getByText(/Atlas Review/)).toBeTruthy();
    expect(within(review).getByText(/2 opportunities/)).toBeTruthy();
  });

  it("collapses and expands Atlas Review", () => {
    render(
      <AtlasAiPanel
        project={MOCK_BUSINESS_PROJECT}
        projectId="proj-toggle"
        messages={[
          {
            id: "m1",
            role: "user",
            content: "Hello",
            createdAt: new Date().toISOString(),
          },
        ]}
        status="idle"
        canUndo={false}
        canRedo={false}
        lastChanges={null}
        advisorReport={sampleReport(2)}
        onSend={() => {}}
        onUndo={() => {}}
        onRedo={() => {}}
      />,
    );

    const toggle = screen.getByTestId("atlas-review-toggle");
    // After chatting begins with no stored preference → collapsed.
    expect(screen.queryByTestId("atlas-review-body")).toBeNull();
    expect(toggle.getAttribute("aria-expanded")).toBe("false");

    fireEvent.click(toggle);
    expect(screen.getByTestId("atlas-review-body")).toBeTruthy();
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(window.localStorage.getItem("atlas-review-expanded:proj-toggle")).toBe(
      "1",
    );

    fireEvent.click(toggle);
    expect(screen.queryByTestId("atlas-review-body")).toBeNull();
    expect(window.localStorage.getItem("atlas-review-expanded:proj-toggle")).toBe(
      "0",
    );
  });
});
