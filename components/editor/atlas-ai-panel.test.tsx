/**
 * @vitest-environment jsdom
 *
 * Atlas AI panel — sticky composer, compact critiques, scroll UX (Sprint 28.1B).
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

describe("Atlas AI panel layout", () => {
  it("uses a permanent three-region grid: conversation / action / composer", () => {
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
    const body = within(panel).getByTestId("atlas-panel-body");
    const conversation = within(body).getByTestId("atlas-conversation-region");
    const action = within(body).getByTestId("atlas-action-region");
    const prompt = within(body).getByTestId("atlas-prompt-region");

    // Structural shell: conversation is the only flexible row.
    expect(body.className).toMatch(/grid-rows-\[minmax\(0,1fr\)_auto_auto\]/);
    expect(conversation.className).toMatch(/min-h-0/);
    expect(conversation.className).toMatch(/overflow-y-auto/);
    expect(within(prompt).getByLabelText("Design request")).toBeTruthy();

    // DOM order inside the shell: conversation → action → composer
    const regions = Array.from(body.children);
    expect(regions[0]).toBe(conversation);
    expect(regions[1]).toBe(action);
    expect(regions[2]).toBe(prompt);

    // Review lives in the Action Area, not the conversation scroller.
    expect(within(action).getByTestId("atlas-review-region")).toBeTruthy();
    expect(
      within(conversation).queryByTestId("atlas-review-region"),
    ).toBeNull();
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
    expect(screen.queryByTestId("atlas-review-body")).toBeNull();
    expect(toggle.getAttribute("aria-expanded")).toBe("false");

    fireEvent.click(toggle);
    expect(screen.getByTestId("atlas-review-body")).toBeTruthy();
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
  });
});

describe("Sprint 28.1B conversation UX", () => {
  it("keeps narrative in conversation and plan actions in the Action Area", () => {
    render(
      <AtlasAiPanel
        project={MOCK_BUSINESS_PROJECT}
        messages={[
          {
            id: "c1",
            role: "assistant",
            content: CRITIQUE_BODY,
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
      />,
    );

    const conversation = screen.getByTestId("atlas-conversation-region");
    const action = screen.getByTestId("atlas-action-region");

    expect(within(conversation).getByTestId("atlas-critique-message")).toBeTruthy();
    expect(within(conversation).getByText("Executive Summary")).toBeTruthy();
    expect(
      within(conversation).queryByTestId("atlas-critique-apply-all-card"),
    ).toBeNull();
    expect(
      within(conversation).queryByTestId("critique-improvement-card-1"),
    ).toBeNull();

    expect(within(action).getByTestId("atlas-critique-apply-all-card")).toBeTruthy();
    expect(within(action).getByTestId("critique-improvement-card-1")).toBeTruthy();
    expect(within(action).getByTestId("critique-improvement-card-2")).toBeTruthy();
    expect(within(action).getByTestId("critique-improvement-card-3")).toBeTruthy();
    expect(screen.queryByTestId("atlas-full-critique-body")).toBeNull();

    fireEvent.click(screen.getByTestId("atlas-toggle-full-critique"));
    expect(screen.getByTestId("atlas-full-critique-body")).toBeTruthy();
  });

  it("collapses 1500-word plain messages by default", () => {
    const content = longPlain(1500);
    render(
      <AtlasAiPanel
        project={MOCK_BUSINESS_PROJECT}
        messages={[
          {
            id: "long",
            role: "assistant",
            content,
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
      />,
    );

    expect(screen.getByTestId("atlas-plain-message")).toBeTruthy();
    expect(screen.getByTestId("atlas-toggle-full-message")).toBeTruthy();
    const visible = screen.getByTestId("atlas-plain-message").textContent ?? "";
    expect(visible.split(/\s+/).length).toBeLessThan(200);
  });

  it("shows ~200-word messages without forced collapse", () => {
    const content = longPlain(200);
    render(
      <AtlasAiPanel
        project={MOCK_BUSINESS_PROJECT}
        messages={[
          {
            id: "mid",
            role: "assistant",
            content,
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
      />,
    );

    expect(screen.queryByTestId("atlas-toggle-full-message")).toBeNull();
    expect(screen.getByTestId("atlas-plain-message").textContent).toMatch(
      /word0/,
    );
  });

  it("shows streaming indicator without hiding composer", () => {
    render(
      <div style={{ height: 640 }}>
        <AtlasAiPanel
          project={MOCK_BUSINESS_PROJECT}
          messages={[]}
          status="sending"
          canUndo={false}
          canRedo={false}
          lastChanges={null}
          onSend={() => {}}
          onUndo={() => {}}
          onRedo={() => {}}
        />
      </div>,
    );

    expect(screen.getByTestId("atlas-streaming-indicator")).toBeTruthy();
    expect(screen.getByTestId("atlas-prompt-region")).toBeTruthy();
    expect(screen.getByTestId("atlas-prompt-input")).toBeTruthy();
  });

  it("Apply All from critique card calls handler", () => {
    const onApplyAllCreative = vi.fn();
    render(
      <AtlasAiPanel
        project={MOCK_BUSINESS_PROJECT}
        messages={[
          {
            id: "c1",
            role: "assistant",
            content: CRITIQUE_BODY,
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
        onApplyAllCreative={onApplyAllCreative}
      />,
    );

    fireEvent.click(screen.getByTestId("atlas-critique-apply-all"));
    expect(onApplyAllCreative).toHaveBeenCalledTimes(1);
  });

  it("individual Apply sends ordinal request", () => {
    const onSend = vi.fn();
    render(
      <AtlasAiPanel
        project={MOCK_BUSINESS_PROJECT}
        messages={[
          {
            id: "c1",
            role: "assistant",
            content: CRITIQUE_BODY,
            createdAt: new Date().toISOString(),
          },
        ]}
        status="idle"
        canUndo={false}
        canRedo={false}
        lastChanges={null}
        onSend={onSend}
        onUndo={() => {}}
        onRedo={() => {}}
      />,
    );

    const card = screen.getByTestId("critique-improvement-card-1");
    fireEvent.click(within(card).getByRole("button", { name: "Apply" }));
    expect(onSend).toHaveBeenCalledWith("Apply the first one");
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
    expect(input.value).toBe("partial draft about hero");

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
    render(
      <AtlasAiPanel
        project={MOCK_BUSINESS_PROJECT}
        messages={[
          {
            id: "u1",
            role: "user",
            content: "Review this homepage",
            createdAt: new Date().toISOString(),
          },
        ]}
        status="failed"
        statusMessage="Something went wrong"
        canUndo={false}
        canRedo={false}
        lastChanges={null}
        onSend={onSend}
        onUndo={() => {}}
        onRedo={() => {}}
      />,
    );

    fireEvent.click(screen.getByTestId("atlas-retry"));
    expect(onSend).toHaveBeenCalledWith("Review this homepage");
  });

  it("Undo focuses the composer afterward", async () => {
    const onUndo = vi.fn();
    render(
      <AtlasAiPanel
        project={MOCK_BUSINESS_PROJECT}
        messages={[]}
        status="idle"
        canUndo={true}
        canRedo={false}
        lastChanges={null}
        onSend={() => {}}
        onUndo={onUndo}
        onRedo={() => {}}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(onUndo).toHaveBeenCalled();
    await waitFor(() => {
      expect(document.activeElement).toBe(
        screen.getByTestId("atlas-prompt-input"),
      );
    });
  });

  it("supports keyboard focus on composer and Apply All", () => {
    render(
      <AtlasAiPanel
        project={MOCK_BUSINESS_PROJECT}
        messages={[
          {
            id: "c1",
            role: "assistant",
            content: CRITIQUE_BODY,
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
        onApplyAllCreative={() => {}}
      />,
    );

    const applyAll = screen.getByTestId("atlas-critique-apply-all");
    applyAll.focus();
    expect(document.activeElement).toBe(applyAll);

    const input = screen.getByTestId("atlas-prompt-input");
    input.focus();
    expect(document.activeElement).toBe(input);
  });

  it("remembers full-critique expansion per message", () => {
    render(
      <AtlasAiPanel
        project={MOCK_BUSINESS_PROJECT}
        messages={[
          {
            id: "a",
            role: "assistant",
            content: CRITIQUE_BODY,
            createdAt: new Date().toISOString(),
          },
          {
            id: "b",
            role: "assistant",
            content: CRITIQUE_BODY.replace("Hero", "CTA"),
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
      />,
    );

    const toggles = screen.getAllByTestId("atlas-toggle-full-critique");
    fireEvent.click(toggles[0]!);
    expect(screen.getAllByTestId("atlas-full-critique-body")).toHaveLength(1);
    fireEvent.click(toggles[1]!);
    expect(screen.getAllByTestId("atlas-full-critique-body")).toHaveLength(2);
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
    expect(prompt).toBeTruthy();
    expect(within(prompt).getByTestId("atlas-prompt-input")).toBeTruthy();
    // Composer is always the last region of the three-region shell
    expect(body.lastElementChild).toBe(prompt);
  });

  it("composer region height is independent of conversation message count", () => {
    const few = [
      {
        id: "a",
        role: "assistant" as const,
        content: "Short",
        createdAt: new Date().toISOString(),
      },
    ];
    const many = Array.from({ length: 40 }, (_, i) => ({
      id: `m-${i}`,
      role: (i % 2 === 0 ? "user" : "assistant") as "user" | "assistant",
      content: `${longPlain(80)} ${i}`,
      createdAt: new Date().toISOString(),
    }));

    const { rerender } = render(
      <div style={{ height: 640 }}>
        <AtlasAiPanel
          project={MOCK_BUSINESS_PROJECT}
          messages={few}
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

    const body = screen.getByTestId("atlas-panel-body");
    expect(body.className).toMatch(/grid-rows-\[minmax\(0,1fr\)_auto_auto\]/);
    expect(body.lastElementChild).toBe(
      screen.getByTestId("atlas-prompt-region"),
    );

    rerender(
      <div style={{ height: 640 }}>
        <AtlasAiPanel
          project={MOCK_BUSINESS_PROJECT}
          messages={many}
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

    // Same shell; composer remains the third region regardless of chat length.
    expect(screen.getByTestId("atlas-panel-body").lastElementChild).toBe(
      screen.getByTestId("atlas-prompt-region"),
    );
    expect(
      within(screen.getByTestId("atlas-conversation-region")).queryByTestId(
        "atlas-prompt-region",
      ),
    ).toBeNull();
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
});
