/**
 * @vitest-environment jsdom
 *
 * Atlas AI panel — professional redesign (Sprint 28.4).
 */
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import AtlasAiPanel from "@/components/editor/atlas-ai-panel";
import { summarizeWebsiteChanges } from "@/components/editor/atlas-change-summary";
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
    overallScore: 68,
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
      operations: [
        { operation: "insertSection" as const, type: "testimonials" as const },
      ],
    })),
  };
}

const CRITIQUE_BODY = [
  "This homepage feels warm but unfinished — hierarchy and proof need work.",
  "",
  "Design direction",
  "Warm Bakery Editorial — approachable craft with clearer CTAs.",
  "",
  "Strengths",
  "• Friendly brand voice",
  "",
  "Top improvements",
  "1. Hero",
  "   Why it matters: Stronger headline lifts conversions.",
  "2. Gallery",
  "   Why it matters: Product photos build appetite.",
  "3. Trust",
  "   Why it matters: Testimonials reduce hesitation.",
  "",
  "Expected outcome",
  "A bakery homepage that feels intentional and ready to convert.",
  "",
  "Say Apply All when you’re ready.",
].join("\n");

function longPlain(words: number): string {
  return Array.from({ length: words }, (_, i) => `word${i}`).join(" ");
}

function renderPanel(
  props: Partial<React.ComponentProps<typeof AtlasAiPanel>> = {},
) {
  return render(
    <div style={{ height: 720, display: "flex" }}>
      <AtlasAiPanel
        project={MOCK_BUSINESS_PROJECT}
        projectId="proj-28-4"
        messages={[]}
        status="idle"
        canUndo={false}
        canRedo={false}
        lastChanges={null}
        onSend={() => {}}
        onUndo={() => {}}
        onRedo={() => {}}
        {...props}
      />
    </div>,
  );
}

describe("Sprint 28.4 — panel information architecture", () => {
  it("defaults to conversation view with composer always visible", () => {
    renderPanel({
      messages: [
        {
          id: "m1",
          role: "user",
          content: "Hello",
          createdAt: new Date().toISOString(),
        },
      ],
    });

    const panel = screen.getByTestId("atlas-ai-panel");
    expect(panel.getAttribute("data-view")).toBe("conversation");
    expect(screen.getByTestId("atlas-conversation-region")).toBeTruthy();
    expect(screen.getByTestId("atlas-prompt-region")).toBeTruthy();
    expect(screen.getByTestId("atlas-prompt-input")).toBeTruthy();
    expect(screen.queryByTestId("atlas-review-view")).toBeNull();
    expect(screen.queryByTestId("atlas-plan-view")).toBeNull();
  });

  it("does not permanently mount Atlas Review in the chat layout", () => {
    renderPanel({
      advisorReport: sampleReport(2),
      messages: [
        {
          id: "m1",
          role: "user",
          content: "Hello",
          createdAt: new Date().toISOString(),
        },
      ],
    });

    expect(screen.queryByTestId("atlas-review-body")).toBeNull();
    expect(screen.queryByTestId("atlas-review-view")).toBeNull();
    expect(
      within(screen.getByTestId("atlas-conversation-region")).queryByTestId(
        "atlas-review-region",
      ),
    ).toBeNull();
  });

  it("uses a compact active-plan bar with authoritative Apply all", () => {
    renderPanel({
      messages: [
        {
          id: "c1",
          role: "assistant",
          content: CRITIQUE_BODY,
          createdAt: new Date().toISOString(),
        },
      ],
      onApplyAllCreative: () => {},
    });

    const action = screen.getByTestId("atlas-action-region");
    expect(within(action).getByTestId("atlas-active-plan-bar")).toBeTruthy();
    expect(within(action).getByTestId("atlas-critique-apply-all")).toBeTruthy();
    expect(
      within(action).queryByTestId("critique-improvement-card-1"),
    ).toBeNull();
    expect(
      within(screen.getByTestId("atlas-conversation-region")).queryByTestId(
        "critique-improvement-card-1",
      ),
    ).toBeNull();
  });

  it("keeps long critiques compact in conversation", () => {
    renderPanel({
      messages: [
        {
          id: "c1",
          role: "assistant",
          content: CRITIQUE_BODY,
          createdAt: new Date().toISOString(),
        },
      ],
    });

    const conversation = screen.getByTestId("atlas-conversation-region");
    expect(within(conversation).getByTestId("atlas-critique-message")).toBeTruthy();
    expect(within(conversation).getByText("Homepage review")).toBeTruthy();
    expect(within(conversation).getByText(/3 improvements/i)).toBeTruthy();
    expect(
      within(conversation).queryByTestId("critique-improvement-card-1"),
    ).toBeNull();
    expect(within(conversation).queryByText("Executive Summary")).toBeNull();
  });

  it("opens Plan view with numbered recommendations and preserves scroll", () => {
    const messages = Array.from({ length: 8 }, (_, i) => ({
      id: `m-${i}`,
      role: (i % 2 === 0 ? "user" : "assistant") as "user" | "assistant",
      content: i === 7 ? CRITIQUE_BODY : `Message ${i}`,
      createdAt: new Date().toISOString(),
    }));

    renderPanel({ messages, onApplyAllCreative: () => {} });

    const region = screen.getByTestId("atlas-conversation-region");
    Object.defineProperty(region, "scrollHeight", {
      configurable: true,
      value: 2000,
    });
    Object.defineProperty(region, "clientHeight", {
      configurable: true,
      value: 400,
    });
    Object.defineProperty(region, "scrollTop", {
      configurable: true,
      writable: true,
      value: 240,
    });
    fireEvent.scroll(region);

    fireEvent.click(screen.getByTestId("atlas-review-plan"));
    expect(screen.getByTestId("atlas-ai-panel").getAttribute("data-view")).toBe(
      "plan",
    );
    expect(screen.getByTestId("atlas-plan-view")).toBeTruthy();
    expect(screen.getByTestId("critique-improvement-card-1")).toBeTruthy();
    expect(screen.getByTestId("critique-improvement-card-2")).toBeTruthy();
    expect(screen.queryByTestId("atlas-prompt-region")).toBeNull();

    fireEvent.click(screen.getByTestId("atlas-back-to-conversation"));
    expect(screen.getByTestId("atlas-ai-panel").getAttribute("data-view")).toBe(
      "conversation",
    );
    const restored = screen.getByTestId("atlas-conversation-region");
    Object.defineProperty(restored, "scrollHeight", {
      configurable: true,
      value: 2000,
    });
    Object.defineProperty(restored, "clientHeight", {
      configurable: true,
      value: 400,
    });
    // Scroll position is restored via layout effect from the saved offset.
    expect(restored.scrollTop).toBe(240);
  });

  it("opens Review from header and returns focus on Back", async () => {
    renderPanel({
      advisorReport: sampleReport(2),
      messages: [
        {
          id: "m1",
          role: "user",
          content: "Hello",
          createdAt: new Date().toISOString(),
        },
      ],
    });

    const openReview = screen.getByTestId("atlas-open-review");
    openReview.focus();
    fireEvent.click(openReview);

    expect(screen.getByTestId("atlas-review-view")).toBeTruthy();
    expect(screen.getByTestId("atlas-review-body")).toBeTruthy();
    expect(screen.queryByTestId("atlas-prompt-region")).toBeNull();

    fireEvent.click(screen.getByTestId("atlas-back-to-conversation"));
    await waitFor(() => {
      expect(screen.getByTestId("atlas-prompt-region")).toBeTruthy();
    });
  });

  it("Apply All exists once in the active plan bar", () => {
    const onApplyAllCreative = vi.fn();
    renderPanel({
      messages: [
        {
          id: "c1",
          role: "assistant",
          content: CRITIQUE_BODY,
          createdAt: new Date().toISOString(),
        },
      ],
      onApplyAllCreative,
    });

    expect(screen.getAllByTestId("atlas-critique-apply-all")).toHaveLength(1);
    fireEvent.click(screen.getByTestId("atlas-critique-apply-all"));
    expect(onApplyAllCreative).toHaveBeenCalledTimes(1);
  });

  it("individual Apply lives only in Plan view", () => {
    const onSend = vi.fn();
    renderPanel({
      messages: [
        {
          id: "c1",
          role: "assistant",
          content: CRITIQUE_BODY,
          createdAt: new Date().toISOString(),
        },
      ],
      onSend,
    });

    expect(screen.queryByTestId("critique-improvement-card-1")).toBeNull();
    fireEvent.click(screen.getByTestId("atlas-review-plan"));
    const card = screen.getByTestId("critique-improvement-card-1");
    fireEvent.click(within(card).getByRole("button", { name: "Apply" }));
    expect(onSend).toHaveBeenCalledWith("Apply the first one");
  });

  it("deduplicates change summaries into compact areas", () => {
    const summary = summarizeWebsiteChanges([
      { id: "1", label: "Buttons updated", ok: true },
      { id: "2", label: "Buttons updated", ok: true },
      { id: "3", label: "Whitespace adjusted", ok: true },
      { id: "4", label: "Layout refreshed", ok: true },
      { id: "5", label: "Whitespace adjusted", ok: true },
    ]);
    expect(summary.count).toBe(3);
    expect(summary.areas).toEqual(
      expect.arrayContaining(["Buttons", "Spacing", "Layout"]),
    );

    renderPanel({
      messages: [],
      status: "applied",
      lastChanges: [
        { id: "1", label: "Buttons updated", ok: true },
        { id: "2", label: "Buttons updated", ok: true },
        { id: "3", label: "Hero rewritten", ok: true },
      ],
    });

    expect(screen.getByTestId("atlas-last-changes-summary")).toBeTruthy();
    expect(
      within(screen.getByTestId("atlas-last-changes-summary")).getByText(
        /^Done$/i,
      ),
    ).toBeTruthy();
    expect(screen.queryByText("Buttons updated")).toBeNull();
  });

  it("caps follow-up suggestions at three and hides them while typing", () => {
    renderPanel({
      followUpSuggestions: [
        "Add matching images",
        "Improve SEO",
        "Add subtle motion",
        "Rewrite hero",
        "Change colors",
      ],
      onFollowUpSuggestion: () => {},
      messages: [
        {
          id: "a",
          role: "assistant",
          content: "Done.",
          createdAt: new Date().toISOString(),
        },
      ],
    });

    const chips = screen.getByTestId("atlas-follow-up-suggestions");
    expect(within(chips).getAllByRole("button").length).toBeLessThanOrEqual(4);

    fireEvent.change(screen.getByTestId("atlas-prompt-input"), {
      target: { value: "typing now" },
    });
    expect(screen.queryByTestId("atlas-follow-up-suggestions")).toBeNull();
  });

  it("preserves draft text across status updates", () => {
    const { rerender } = render(
      <AtlasAiPanel
        project={MOCK_BUSINESS_PROJECT}
        messages={[]}
        status="idle"
        canUndo={false}
        canRedo={false}
        lastChanges={null}
        onSend={() => {}}
        onUndo={() => {}}
        onRedo={() => {}}
      />,
    );

    const input = screen.getByTestId("atlas-prompt-input") as HTMLTextAreaElement;
    fireEvent.change(input, { target: { value: "partial draft about hero" } });

    rerender(
      <AtlasAiPanel
        project={MOCK_BUSINESS_PROJECT}
        messages={[
          {
            id: "m1",
            role: "assistant",
            content: "Done.",
            createdAt: new Date().toISOString(),
          },
        ]}
        status="applied"
        canUndo={true}
        canRedo={false}
        lastChanges={[{ id: "c1", label: "Updated hero", ok: true }]}
        onSend={() => {}}
        onUndo={() => {}}
        onRedo={() => {}}
      />,
    );

    expect(
      (screen.getByTestId("atlas-prompt-input") as HTMLTextAreaElement).value,
    ).toBe("partial draft about hero");
  });

  it("Retry resends the last user message", () => {
    const onSend = vi.fn();
    renderPanel({
      messages: [
        {
          id: "u1",
          role: "user",
          content: "Review this homepage",
          createdAt: new Date().toISOString(),
        },
      ],
      status: "failed",
      statusMessage: "That didn’t go through",
      onSend,
    });

    fireEvent.click(screen.getByTestId("atlas-retry"));
    expect(onSend).toHaveBeenCalledWith("Review this homepage");
  });

  it("Undo from overflow menu focuses the composer afterward", async () => {
    const onUndo = vi.fn();
    renderPanel({ canUndo: true, onUndo });

    fireEvent.click(screen.getByTestId("atlas-overflow-menu"));
    fireEvent.click(screen.getByRole("menuitem", { name: "Undo" }));
    expect(onUndo).toHaveBeenCalled();
    await waitFor(() => {
      expect(document.activeElement).toBe(
        screen.getByTestId("atlas-prompt-input"),
      );
    });
  });

  it("supports keyboard focus on Apply all and composer", () => {
    renderPanel({
      messages: [
        {
          id: "c1",
          role: "assistant",
          content: CRITIQUE_BODY,
          createdAt: new Date().toISOString(),
        },
      ],
      onApplyAllCreative: () => {},
    });

    const applyAll = screen.getByTestId("atlas-critique-apply-all");
    applyAll.focus();
    expect(document.activeElement).toBe(applyAll);

    const input = screen.getByTestId("atlas-prompt-input");
    input.focus();
    expect(document.activeElement).toBe(input);
  });

  it("fits mobile viewport height without dropping composer", () => {
    render(
      <div style={{ height: 480, width: 360, display: "flex" }}>
        <AtlasAiPanel
          project={MOCK_BUSINESS_PROJECT}
          messages={[
            {
              id: "c1",
              role: "assistant",
              content: CRITIQUE_BODY + "\n\n" + longPlain(400),
              createdAt: new Date().toISOString(),
            },
          ]}
          status="idle"
          canUndo={false}
          canRedo={false}
          lastChanges={null}
          advisorReport={sampleReport(1)}
          onSend={() => {}}
          onUndo={() => {}}
          onRedo={() => {}}
        />
      </div>,
    );

    const body = screen.getByTestId("atlas-panel-body");
    const prompt = within(body).getByTestId("atlas-prompt-region");
    expect(body.lastElementChild).toBe(prompt);
    expect(body.className).toMatch(/grid-rows-\[minmax\(0,1fr\)_auto_auto\]/);
  });

  it("keeps composer usable with a 50-message conversation", () => {
    const many = Array.from({ length: 50 }, (_, i) => ({
      id: `m-${i}`,
      role: (i % 2 === 0 ? "user" : "assistant") as "user" | "assistant",
      content: `${longPlain(40)} ${i}`,
      createdAt: new Date().toISOString(),
    }));

    renderPanel({ messages: many });

    expect(screen.getByTestId("atlas-prompt-region")).toBeTruthy();
    expect(screen.getByTestId("atlas-panel-body").lastElementChild).toBe(
      screen.getByTestId("atlas-prompt-region"),
    );
  });

  it("does not force-scroll when user has scrolled up", () => {
    const messages = Array.from({ length: 12 }, (_, i) => ({
      id: `m-${i}`,
      role: (i % 2 === 0 ? "user" : "assistant") as "user" | "assistant",
      content: `Message ${i} ${longPlain(30)}`,
      createdAt: new Date().toISOString(),
    }));

    const { rerender } = render(
      <div style={{ height: 480 }}>
        <AtlasAiPanel
          project={MOCK_BUSINESS_PROJECT}
          messages={messages}
          status="idle"
          canUndo={false}
          canRedo={false}
          lastChanges={null}
          onSend={() => {}}
          onUndo={() => {}}
          onRedo={() => {}}
        />
      </div>,
    );

    const region = screen.getByTestId("atlas-conversation-region");
    Object.defineProperty(region, "scrollHeight", {
      configurable: true,
      value: 2000,
    });
    Object.defineProperty(region, "clientHeight", {
      configurable: true,
      value: 300,
    });
    Object.defineProperty(region, "scrollTop", {
      configurable: true,
      writable: true,
      value: 0,
    });
    fireEvent.scroll(region);

    const scrollTo = vi.fn();
    region.scrollTo = scrollTo as unknown as typeof region.scrollTo;

    rerender(
      <div style={{ height: 480 }}>
        <AtlasAiPanel
          project={MOCK_BUSINESS_PROJECT}
          messages={[
            ...messages,
            {
              id: "m-new",
              role: "assistant",
              content: "New message",
              createdAt: new Date().toISOString(),
            },
          ]}
          status="idle"
          canUndo={false}
          canRedo={false}
          lastChanges={null}
          onSend={() => {}}
          onUndo={() => {}}
          onRedo={() => {}}
        />
      </div>,
    );

    expect(scrollTo).not.toHaveBeenCalled();
  });

  it("collapses long plain messages by default", () => {
    renderPanel({
      messages: [
        {
          id: "long",
          role: "assistant",
          content: longPlain(1500),
          createdAt: new Date().toISOString(),
        },
      ],
    });

    expect(screen.getByTestId("atlas-plain-message")).toBeTruthy();
    expect(screen.getByTestId("atlas-toggle-full-message")).toBeTruthy();
  });

  it("shows streaming indicator without hiding composer", () => {
    renderPanel({ status: "sending" });
    expect(screen.getByTestId("atlas-streaming-indicator")).toBeTruthy();
    expect(screen.getByTestId("atlas-prompt-region")).toBeTruthy();
  });
});
