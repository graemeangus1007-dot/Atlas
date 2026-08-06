/**
 * @vitest-environment jsdom
 * HeroComposition P0 — resolver + Editor/Preview/Publish parity.
 */

import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import SiteHero from "@/components/site/site-hero";
import { MOCK_BUSINESS_PROJECT } from "@/data/mock-project";
import {
  buildHeroRenderPlan,
  heroParityContract,
  inferLegacyHeroComposition,
  resolveHeroComposition,
  resolveHeroCompositionFromProject,
} from "@/lib/hero-composition";
import { renderStaticSiteBody } from "@/lib/publishing/render/html";
import { getTemplate, type TemplateId } from "@/lib/templates";
import { generateWebsiteContent } from "@/lib/website-generator";
import type { BusinessProject } from "@/types/business-project";

function projectForTemplate(templateId: TemplateId): BusinessProject {
  return {
    ...MOCK_BUSINESS_PROJECT,
    templateId,
    businessName: "Harborview Landscapes",
    heroHeadline: "Outdoor spaces that feel finished",
    heroSubheadline: "Design, build, and care for yards that look intentional.",
    primaryCta: "Request a quote",
    secondaryCta: "View our work",
    heroOverlay: 50,
    heroImageId: null,
    mediaLibrary: [],
    heroComposition: null,
  };
}

function readContractFromElement(el: Element) {
  return {
    layout: el.getAttribute("data-hero-composition-layout"),
    legacyLayoutKey: el.getAttribute("data-hero-layout"),
    minHeight: el.getAttribute("data-hero-min-height"),
    contentAlignment: el.getAttribute("data-hero-content-align"),
    verticalAlignment: el.getAttribute("data-hero-vertical-align"),
    contentWidth: el.getAttribute("data-hero-content-width"),
    headingScale: el.getAttribute("data-hero-heading-scale"),
    mobileLayout: el.getAttribute("data-hero-mobile-layout"),
  };
}

function readContractFromHtml(html: string) {
  const match = html.match(/id="home"[^>]*>/);
  expect(match).toBeTruthy();
  const tag = match![0];
  const attr = (name: string) => {
    const m = tag.match(new RegExp(`${name}="([^"]*)"`));
    return m?.[1] ?? null;
  };
  return {
    layout: attr("data-hero-composition-layout"),
    legacyLayoutKey: attr("data-hero-layout"),
    minHeight: attr("data-hero-min-height"),
    contentAlignment: attr("data-hero-content-align"),
    verticalAlignment: attr("data-hero-vertical-align"),
    contentWidth: attr("data-hero-content-width"),
    headingScale: attr("data-hero-heading-scale"),
    mobileLayout: attr("data-hero-mobile-layout"),
  };
}

describe("inferLegacyHeroComposition", () => {
  it("maps each template heroLayout without writing storage", () => {
    const cases: Array<[TemplateId, string, string]> = [
      ["modern", "full_width", "centered"],
      ["elegant", "split", "split"],
      ["minimal", "full_width", "minimal"],
      ["bold", "full_width", "bold-overlay"],
    ];
    for (const [templateId, layout, legacy] of cases) {
      const heroLayout = getTemplate(templateId).heroLayout;
      const inferred = inferLegacyHeroComposition({
        heroLayout,
        heroOverlay: 50,
      });
      expect(inferred.layout).toBe(layout);
      expect(inferred.legacyLayoutKey).toBe(legacy);
      expect(inferred.patternId).toBeNull();
    }
  });

  it("preserves legacy bold and split overlay forces", () => {
    expect(
      inferLegacyHeroComposition({
        heroLayout: "bold-overlay",
        heroOverlay: 20,
      }).treatment.overlay,
    ).toBe(80);
    expect(
      inferLegacyHeroComposition({
        heroLayout: "split",
        heroOverlay: 90,
      }).treatment.overlay,
    ).toBe(30);
  });
});

describe("resolveHeroComposition", () => {
  it("infers when heroComposition is absent", () => {
    const project = projectForTemplate("modern");
    delete (project as { heroComposition?: unknown }).heroComposition;
    const resolved = resolveHeroCompositionFromProject(project);
    expect(resolved.legacyLayoutKey).toBe("centered");
    expect(project.heroComposition).toBeUndefined();
  });

  it("prefers persisted composition when valid", () => {
    const base = inferLegacyHeroComposition({
      heroLayout: "centered",
      heroOverlay: 50,
    });
    const stored = {
      ...base,
      contentAlignment: "left" as const,
      patternId: "hero.cinematic_full_width",
    };
    const resolved = resolveHeroComposition({
      heroComposition: stored,
      heroLayout: "centered",
      heroOverlay: 50,
    });
    expect(resolved.contentAlignment).toBe("left");
    expect(resolved.patternId).toBe("hero.cinematic_full_width");
  });
});

describe("Editor / Preview / Publish parity", () => {
  const templates: TemplateId[] = ["modern", "elegant", "minimal", "bold"];

  it.each(templates)(
    "matches contract for %s (centered/split/minimal/bold-overlay)",
    (templateId) => {
      const project = projectForTemplate(templateId);
      const content = generateWebsiteContent(project);
      const expected = heroParityContract(content.heroComposition);
      const template = getTemplate(templateId);

      const preview = render(
        <SiteHero
          content={content.hero}
          composition={content.heroComposition}
          testId="preview-hero"
        />,
      );
      const editor = render(
        <SiteHero
          content={content.hero}
          composition={content.heroComposition}
          testId="editor-hero"
        />,
      );
      const html = renderStaticSiteBody(content, template);

      const previewEl = preview.getByTestId("preview-hero");
      const editorEl = editor.getByTestId("editor-hero");
      const fromPreview = readContractFromElement(previewEl);
      const fromEditor = readContractFromElement(editorEl);
      const fromPublish = readContractFromHtml(html);

      expect(fromPreview).toEqual(fromEditor);
      expect(fromEditor).toEqual(fromPublish);
      expect(fromPreview.layout).toBe(expected.layout);
      expect(fromPreview.legacyLayoutKey).toBe(expected.legacyLayoutKey);
      expect(fromPreview.minHeight).toBe(expected.minHeight);
      expect(fromPreview.contentAlignment).toBe(expected.contentAlignment);
      expect(fromPreview.verticalAlignment).toBe(expected.verticalAlignment);
      expect(fromPreview.contentWidth).toBe(expected.contentWidth);
      expect(fromPreview.headingScale).toBe(expected.headingScale);

      // Structural parity: split vs overlay media
      if (expected.layout === "split") {
        expect(html).toContain("site-hero-split");
        expect(html).toContain("site-hero-gradient");
        expect(html).toContain("site-hero-text-scrim");
        expect(previewEl.querySelector(".site-hero-gradient")).toBeTruthy();
        expect(editorEl.querySelector(".site-hero-gradient")).toBeTruthy();
      } else {
        expect(html).toContain("site-hero-media");
        expect(previewEl.querySelector(".site-hero-image")).toBeTruthy();
        expect(editorEl.querySelector(".site-hero-image")).toBeTruthy();
      }

      preview.unmount();
      editor.unmount();
    },
  );

  it("keeps generateWebsiteContent inference stable (no stored mutation)", () => {
    const project = projectForTemplate("elegant");
    const before = project.heroComposition;
    const content = generateWebsiteContent(project);
    expect(content.heroComposition.layout).toBe("split");
    expect(project.heroComposition).toBe(before);
  });
});

describe("buildHeroRenderPlan", () => {
  it("exposes composition CSS tokens", () => {
    const plan = buildHeroRenderPlan(
      inferLegacyHeroComposition({
        heroLayout: "bold-overlay",
        heroOverlay: 50,
      }),
    );
    expect(plan.cssVars["--site-hero-overlay"]).toBe("0.8");
    expect(plan.cssVars["--site-hero-content-align"]).toBe("left");
    expect(plan.dataAttributes["data-hero-min-height"]).toBe("tall");
  });
});
