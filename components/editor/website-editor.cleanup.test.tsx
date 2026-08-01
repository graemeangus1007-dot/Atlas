/**
 * @vitest-environment jsdom
 *
 * Atlas v1 editor cleanup — rail, top bar, critique disclosure, hero parity.
 */
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import AtlasCritiqueMessage from "@/components/editor/atlas-critique-message";
import AtlasConversation from "@/components/editor/atlas-conversation";
import EditorCanvas from "@/components/editor/editor-canvas";
import EditorSidebar from "@/components/editor/editor-sidebar";
import EditorTopBar from "@/components/editor/editor-topbar";
import {
  EDITOR_BANNED_UI_PHRASES,
  EDITOR_PANEL_HINTS,
  EDITOR_SIDEBAR_ITEMS,
  normalizeEditorPanelId,
} from "@/data/editor";
import { MOCK_BUSINESS_PROJECT } from "@/data/mock-project";
import { placeholderImageUrl } from "@/lib/media";
import { generateWebsiteContent } from "@/lib/website-generator";
import { getTemplate } from "@/lib/templates";

afterEach(() => {
  cleanup();
});

vi.mock("@/hooks/use-autosave", () => ({
  useAutosave: () => ({
    label: "Saved",
    saveStatus: "saved",
    canSave: true,
    showRetry: false,
    retry: vi.fn(),
    saveError: null,
    isSaving: false,
    saveNow: vi.fn(),
  }),
}));

vi.mock("@/context/template-context", () => ({
  useTemplate: () => {
    const template = getTemplate("modern");
    return { template, templateId: template.id };
  },
  TemplateProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock("@/components/ui/button", () => ({
  default: ({
    children,
    href,
    ...props
  }: React.PropsWithChildren<Record<string, unknown>>) =>
    href ? (
      <a href={String(href)} {...props}>
        {children}
      </a>
    ) : (
      <button type="button" {...props}>
        {children}
      </button>
    ),
}));

const STRATEGY_CRITIQUE = [
  "Harborview feels capable but unfinished before the quote ask.",
  "",
  "Overall direction",
  "Premium coastal craftsmanship",
  "",
  "Biggest problem",
  "Visitors don’t see enough proof before requesting a quote.",
  "",
  "Design goals",
  "• Increase trust before the ask.",
  "",
  "Execution plan",
  "1. Rebuild the hero",
  "2. Place testimonials below the hero",
  "",
  "Top improvements",
  "1. Place testimonials below the hero",
  "   Why it matters: Trust should land before the ask.",
  "",
  "Expected outcome",
  "A homepage that earns trust earlier.",
  "",
  "Say Apply all when you’re ready.",
].join("\n");

describe("Editor rail (v1)", () => {
  it("shows Content, Design, Site settings — not Pages, Publish, or Media as primary", () => {
    render(
      <EditorSidebar
        activeId="content"
        onSelect={() => {}}
        open
        onClose={() => {}}
      />,
    );
    const rail = screen.getByTestId("editor-tools-rail");
    const labels = EDITOR_SIDEBAR_ITEMS.map((i) => i.label);
    expect(labels).toEqual(["Content", "Design", "Site settings"]);
    expect(within(rail).getByTestId("editor-rail-content")).toBeTruthy();
    expect(within(rail).getByTestId("editor-rail-design")).toBeTruthy();
    expect(within(rail).getByTestId("editor-rail-settings")).toBeTruthy();
    expect(within(rail).queryByText("Pages")).toBeNull();
    expect(within(rail).queryByText("Publish")).toBeNull();
    expect(within(rail).queryByText("Media")).toBeNull();
    expect(within(rail).queryByText("Brand Studio")).toBeNull();
    expect(within(rail).queryByText("SEO")).toBeNull();
  });

  it("maps legacy panel ids to the v1 rail", () => {
    expect(normalizeEditorPanelId("branding")).toBe("design");
    expect(normalizeEditorPanelId("media")).toBe("design");
    expect(normalizeEditorPanelId("seo")).toBe("settings");
    expect(normalizeEditorPanelId("publish")).toBe("settings");
  });

  it("uses Atlas-only hint copy without Improve with AI", () => {
    const blob = Object.values(EDITOR_PANEL_HINTS).join(" ");
    for (const phrase of EDITOR_BANNED_UI_PHRASES) {
      expect(blob.toLowerCase()).not.toContain(phrase.toLowerCase());
    }
    expect(EDITOR_PANEL_HINTS.content).toMatch(/Click any text to edit/i);
  });
});

describe("Editor top bar", () => {
  it("exposes one Preview and one Publish action", () => {
    render(
      <EditorTopBar
        businessName="Harborview Landscaping"
        onSave={() => {}}
        onMenuClick={() => {}}
        onPublish={() => {}}
      />,
    );
    expect(screen.getByTestId("editor-topbar-preview").textContent).toMatch(
      /Preview/i,
    );
    expect(screen.getByTestId("editor-topbar-publish").textContent).toMatch(
      /Publish/i,
    );
    expect(screen.queryAllByText(/^Publish$/i)).toHaveLength(1);
    expect(screen.queryAllByText(/^Preview$/i)).toHaveLength(1);
    expect(screen.queryByText(/Dashboard/i)).toBeNull();
  });
});

describe("Atlas critique progressive disclosure", () => {
  it("does not render strategy critiques as raw walls of text", () => {
    render(
      <AtlasCritiqueMessage
        content={STRATEGY_CRITIQUE}
        messageId="m1"
        onReviewPlan={() => {}}
        onApplyAll={() => {}}
      />,
    );
    expect(screen.getByTestId("atlas-critique-message")).toBeTruthy();
    expect(screen.queryByTestId("atlas-plain-message")).toBeNull();
    expect(screen.getByText(/Homepage review/i)).toBeTruthy();
    expect(screen.getByTestId("atlas-message-review-plan")).toBeTruthy();
    expect(screen.getByTestId("atlas-message-apply-all")).toBeTruthy();
    // Full strategy body stays out of the compact card
    expect(screen.queryByText(/^Execution plan$/i)).toBeNull();
  });

  it("keeps the conversation on the structured critique path", () => {
    render(
      <AtlasConversation
        messages={[
          {
            id: "a1",
            role: "assistant",
            content: STRATEGY_CRITIQUE,
            createdAt: new Date().toISOString(),
          },
        ]}
        status="idle"
        lastChangesSummary={{ count: 0, areas: [], items: [] }}
        onReviewPlan={() => {}}
        onApplyAll={() => {}}
        onViewChanges={() => {}}
      />,
    );
    expect(screen.getByTestId("atlas-critique-message")).toBeTruthy();
    expect(screen.queryByTestId("atlas-plain-message")).toBeNull();
  });
});

describe("Hero placeholder parity", () => {
  it("never embeds Placeholder labels in generated placeholder images", () => {
    const url = placeholderImageUrl("Harborview Landscaping hero", 1600, 900);
    const decoded = decodeURIComponent(url.replace(/^data:image\/svg\+xml;charset=utf-8,/, ""));
    expect(decoded).not.toMatch(/Placeholder/i);
    expect(decoded).not.toMatch(/Harborview Landscaping hero/i);
    expect(decoded).not.toMatch(/<text\b/i);
  });

  it("renders one hero title and supporting description when real content exists", () => {
    const project = {
      ...MOCK_BUSINESS_PROJECT,
      businessName: "Harborview Landscaping",
      heroHeadline: "Outdoor spaces built to last",
      heroSubheadline: "Lawn care and hardscape for coastal homes.",
      heroImageId: null,
      mediaLibrary: [],
    };
    const content = generateWebsiteContent(project);
    expect(content.hero.headline).toBe("Outdoor spaces built to last");
    expect(content.hero.isPlaceholder).toBe(true);

    render(
      <EditorCanvas
        content={content}
        contact={project.contact}
        onBusinessNameChange={() => {}}
        onHeadlineChange={() => {}}
        onSubheadlineChange={() => {}}
        onAboutChange={() => {}}
        onPrimaryCtaChange={() => {}}
        onServiceChange={() => {}}
        onContactChange={() => {}}
        onGalleryTitleChange={() => {}}
      />,
    );

    const hero = screen.getByTestId("editor-hero");
    expect(hero.getAttribute("data-hero-placeholder")).toBe("true");
    expect(within(hero).getByTestId("editor-hero-headline").textContent).toBe(
      "Outdoor spaces built to last",
    );
    expect(
      within(hero).getByTestId("editor-hero-subheadline").textContent,
    ).toMatch(/Lawn care/);
    expect(within(hero).queryByText(/^Placeholder$/i)).toBeNull();
    expect(within(hero).queryByText(/Harborview Landscaping hero/i)).toBeNull();
    // Duplicate brand eyebrow suppressed when it matches the nav name
    expect(within(hero).queryByTestId("editor-hero-eyebrow")).toBeNull();
    expect(hero.querySelectorAll("h1")).toHaveLength(1);
    expect(within(hero).getAllByLabelText("Hero subheadline")).toHaveLength(1);
  });
});

describe("Canonical editor chrome constants", () => {
  it("keeps a single primary tools rail definition", () => {
    expect(EDITOR_SIDEBAR_ITEMS).toHaveLength(3);
    expect(EDITOR_SIDEBAR_ITEMS.map((i) => i.id)).toEqual([
      "content",
      "design",
      "settings",
    ]);
  });
});
