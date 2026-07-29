/**
 * Sprint 25.0A — Atlas Creative Director regression tests.
 */

import { describe, expect, it } from "vitest";
import {
  applyAllCreativeRecommendations,
  applyCreativeRecommendation,
} from "@/lib/ai/apply-creative-recommendation";
import {
  buildCreativeRecommendations,
  planCompleteWebsite,
  rankCreativeRecommendations,
  reviewCreativeDirector,
  suppressDuplicateCreativeRecommendations,
} from "@/lib/ai/creative-director";
import { detectMissingCapabilities } from "@/lib/ai/creative-director-capabilities";
import {
  classifyMaturityLevel,
  scoreWebsiteCompleteness,
} from "@/lib/ai/creative-director-scoring";
import { MOCK_BUSINESS_PROJECT } from "@/data/mock-project";
import type { BusinessProject } from "@/types/business-project";
import type { MediaAsset } from "@/types/media";

function asset(id: string, title: string): MediaAsset {
  return {
    id,
    name: `${title}.jpg`,
    filename: `${id}.jpg`,
    url: `https://cdn.example.com/${id}.jpg`,
    storagePath: `user/proj/${id}.jpg`,
    mimeType: "image/jpeg",
    size: 1000,
    sizeLabel: "1 KB",
    createdAt: Date.now(),
    title,
    description: title,
    alt: title,
    unavailable: false,
  };
}

function sampleProject(
  overrides: Partial<BusinessProject> = {},
): BusinessProject {
  return {
    ...MOCK_BUSINESS_PROJECT,
    businessName: "Linda's Cookies",
    primaryCta: "Learn more",
    heroImageId: null,
    galleryImageIds: ["", "", "", ""],
    logoAssetId: null,
    logo: null,
    designSections: undefined,
    creativePolish: undefined,
    mediaLibrary: [],
    contact: {
      ...MOCK_BUSINESS_PROJECT.contact,
      formEnabled: true,
    },
    ...overrides,
  };
}

describe("maturity scoring", () => {
  it("scores a bare draft low and a polished site high", () => {
    const draft = sampleProject();
    const polished = sampleProject({
      primaryCta: "Order ahead",
      heroImageId: "hero-1",
      logoAssetId: "logo-1",
      galleryImageIds: ["g1", "g2", "", ""],
      mediaLibrary: [
        asset("hero-1", "hero"),
        asset("logo-1", "logo"),
        asset("g1", "gallery"),
        asset("g2", "gallery two"),
      ],
      designSections: {
        enabled: ["testimonials", "faq", "team"],
        testimonials: [{ quote: "Great", author: "A", role: "Fan" }],
        faq: [{ question: "Hours?", answer: "9–5" }],
        team: [{ name: "Sam", role: "Owner", bio: "Baker" }],
      },
      creativePolish: {
        serviceIcons: true,
        motion: true,
        visualHierarchy: true,
        spacing: "comfortable",
      },
      siteWidth: "wide",
      headingFont: "manrope",
      bodyFont: "inter",
      primaryColor: "#111111",
      accentColor: "#0f766e",
    });

    expect(scoreWebsiteCompleteness(draft)).toBeLessThan(50);
    expect(scoreWebsiteCompleteness(polished)).toBeGreaterThanOrEqual(85);
  });
});

describe("launch-ready classification", () => {
  it("maps completeness bands to maturity levels", () => {
    expect(classifyMaturityLevel(20)).toBe("Draft");
    expect(classifyMaturityLevel(55)).toBe("Developing");
    expect(classifyMaturityLevel(75)).toBe("Professional");
    expect(classifyMaturityLevel(90)).toBe("Launch Ready");
  });
});

describe("missing capability detection", () => {
  it("flags hero, icons, motion, testimonials, and weak CTA", () => {
    const missing = detectMissingCapabilities(sampleProject());
    const ids = missing.map((m) => m.id);
    expect(ids).toContain("hero_image");
    expect(ids).toContain("icons");
    expect(ids).toContain("motion");
    expect(ids).toContain("testimonials");
    expect(ids).toContain("weak_cta");
  });
});

describe("completeness detection", () => {
  it("offers Complete My Website below 80%", () => {
    const report = reviewCreativeDirector({ project: sampleProject() });
    expect(report.overallCompleteness).toBeLessThan(80);
    expect(report.offerCompleteWebsite).toBe(true);
    expect(report.maturityLevel).toMatch(/Draft|Developing|Professional/);
  });
});

describe("recommendation ranking", () => {
  it("ranks high-impact visual and trust upgrades first", () => {
    const ranked = rankCreativeRecommendations(
      buildCreativeRecommendations(sampleProject()),
    );
    expect(ranked.length).toBeGreaterThan(0);
    expect(ranked[0]?.impact).toBe("high");
    expect(ranked[0]!.impactScore).toBeGreaterThanOrEqual(
      ranked[ranked.length - 1]!.impactScore,
    );
  });
});

describe("duplicate suppression", () => {
  it("keeps a single recommendation per overlapping capability set", () => {
    const built = buildCreativeRecommendations(sampleProject());
    const suppressed = suppressDuplicateCreativeRecommendations([
      ...built,
      ...built,
    ]);
    const ids = suppressed.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("Apply All planning", () => {
  it("builds a complete improvement plan with applyable ops", () => {
    const project = sampleProject({
      mediaLibrary: [asset("a1", "fresh cookies")],
    });
    const plan = planCompleteWebsite(project);
    expect(plan.recommendations.length).toBeGreaterThan(3);
    expect(plan.narrative).toMatch(/Apply All/i);

    const result = applyAllCreativeRecommendations({
      project,
      recommendations: plan.recommendations,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.status).toBe("applied");
    expect(result.appliedIds.length).toBeGreaterThan(0);
    expect(result.project.creativePolish?.serviceIcons).toBe(true);
    expect(result.project.designSections?.enabled).toContain("testimonials");
  });
});

describe("single recommendation apply", () => {
  it("adds service icons through setCreativePolish", () => {
    const icons = buildCreativeRecommendations(sampleProject()).find(
      (r) => r.id === "visual.service_icons",
    );
    expect(icons).toBeTruthy();
    const result = applyCreativeRecommendation({
      project: sampleProject(),
      recommendation: icons!,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.project.creativePolish?.serviceIcons).toBe(true);
  });
});
