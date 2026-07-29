/**
 * @vitest-environment jsdom
 *
 * Sprint 23.0A — Atlas AI panel keeps recommendations mounted while conversation scrolls.
 */
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import AtlasAiPanel from "@/components/editor/atlas-ai-panel";
import type { BusinessAdvisorReport } from "@/lib/ai/business-advisor-types";
import { MOCK_BUSINESS_PROJECT } from "@/data/mock-project";

afterEach(() => {
  cleanup();
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

function sampleReport(): BusinessAdvisorReport {
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
    recommendations: [
      {
        id: "trust.testimonials",
        category: "trust",
        title: "Add testimonials",
        why: "Builds trust",
        noticed: "No testimonials yet",
        whyItMatters: "People look for proof",
        expectedOutcome: "More inquiries",
        estimatedTime: "~30 seconds",
        impact: "high",
        impactScore: 91,
        confidence: 0.9,
        destructive: false,
        narrative: "No testimonials yet",
        scoreCategory: "trust",
        operations: [{ operation: "insertSection", type: "testimonials" }],
      },
    ],
  };
}

describe("recommendations remain mounted while conversation scrolls", () => {
  it("keeps Atlas Review outside the conversation scroll region", () => {
    const messages = Array.from({ length: 12 }, (_, i) => ({
      id: `m-${i}`,
      role: (i % 2 === 0 ? "user" : "assistant") as "user" | "assistant",
      content: `Message ${i}`,
      createdAt: new Date().toISOString(),
    }));

    render(
      <div style={{ height: 640 }}>
        <AtlasAiPanel
          project={MOCK_BUSINESS_PROJECT}
          messages={messages}
          status="idle"
          canUndo={false}
          canRedo={false}
          lastChanges={null}
          advisorReport={sampleReport()}
          onSend={() => {}}
          onUndo={() => {}}
          onRedo={() => {}}
        />
      </div>,
    );

    const panel = screen.getByTestId("atlas-ai-panel");
    const review = within(panel).getByTestId("atlas-review-region");
    const conversation = within(panel).getByTestId("atlas-conversation-region");
    const prompt = within(panel).getByTestId("atlas-prompt-region");

    expect(review).toBeTruthy();
    expect(conversation).toBeTruthy();
    expect(prompt).toBeTruthy();
    expect(review.contains(conversation)).toBe(false);
    expect(conversation.contains(review)).toBe(false);

    // Recommendations stay queryable even with a long conversation history.
    expect(
      within(review).getByTestId("advisor-rec-trust.testimonials"),
    ).toBeTruthy();
    expect(within(conversation).getByText("Message 11")).toBeTruthy();
    expect(within(prompt).getByLabelText("Design request")).toBeTruthy();
  });
});
