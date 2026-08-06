/**
 * Adaptive Brand Presentation — identity stable, presentation adapts.
 */

import { describe, expect, it } from "vitest";
import { MOCK_BUSINESS_PROJECT } from "@/data/mock-project";
import { NAMED_COLORS } from "@/lib/ai/named-colors";
import {
  explainBrandPresentation,
  explanationClaimsBrandChange,
  isGoldLikeAccent,
  resolveAdaptiveBrandPresentation,
  verifyBrandPresentation,
  WHITE_PRESENTATION,
} from "@/lib/brand-presentation";
import { buildSiteDesignStyle } from "@/lib/design-theme";
import { heroPatternPreset } from "@/lib/ai/hero-pattern-application";
import { mirrorHeroCompositionToLegacyFields } from "@/lib/ai/hero-pattern-application";
import { buildStaticSiteCss } from "@/lib/publishing/styles/site-css";
import type { BusinessProject } from "@/types/business-project";
import type { MediaAsset } from "@/types/media";

function asset(
  id: string,
  title: string,
  dims?: { width: number; height: number },
): MediaAsset {
  return {
    id,
    name: `${title}.jpg`,
    filename: `${id}.jpg`,
    url: `https://cdn.example.com/${id}.jpg`,
    storagePath: `user/proj/${id}.jpg`,
    mimeType: "image/jpeg",
    size: 2000,
    sizeLabel: "2 KB",
    createdAt: Date.now(),
    title,
    description: title,
    alt: title,
    unavailable: false,
    ...(dims ?? {}),
  };
}

function project(overrides: Partial<BusinessProject> = {}): BusinessProject {
  return {
    ...MOCK_BUSINESS_PROJECT,
    primaryColor: NAMED_COLORS.forestGreen,
    secondaryColor: NAMED_COLORS.forestGreen,
    accentColor: NAMED_COLORS.gold,
    backgroundColor: "#0b1220",
    theme: "dark",
    heroImageId: "hero-1",
    mediaLibrary: [asset("hero-1", "Harbor landscape", { width: 2400, height: 1200 })],
    atlasActionMemory: undefined,
    ...overrides,
  };
}

function withPattern(
  base: BusinessProject,
  patternId:
    | "hero.cinematic_full_width"
    | "hero.coastal_service"
    | "hero.contractor_left"
    | "hero.premium_minimal",
): BusinessProject {
  return mirrorHeroCompositionToLegacyFields(
    base,
    heroPatternPreset(patternId),
  );
}

describe("Adaptive Brand Presentation", () => {
  it("detects gold-like accents", () => {
    expect(isGoldLikeAccent(NAMED_COLORS.gold)).toBe(true);
    expect(isGoldLikeAccent(NAMED_COLORS.forestGreen)).toBe(false);
  });

  it("gold brand + beach image → white heading, gold accent, lower overlay", () => {
    const p = withPattern(
      project({
        mediaLibrary: [
          asset("hero-1", "Bright beach sand coastal sky", {
            width: 2400,
            height: 1200,
          }),
        ],
        heroOverlay: 75,
      }),
      "hero.cinematic_full_width",
    );
    const before = { ...p };
    const resolved = resolveAdaptiveBrandPresentation(p);

    expect(resolved.identity.accent).toBe(NAMED_COLORS.gold);
    expect(resolved.identity.primary).toBe(NAMED_COLORS.forestGreen);
    expect(resolved.presentation.heroHeadlineColor.toLowerCase()).toBe(
      WHITE_PRESENTATION.toLowerCase(),
    );
    expect(resolved.presentation.heroEyebrowColor.toLowerCase()).toBe(
      NAMED_COLORS.gold.toLowerCase(),
    );
    expect(
      resolved.presentation.heroPrimaryCTAStyle.background.toLowerCase(),
    ).toBe(NAMED_COLORS.gold.toLowerCase());
    expect(resolved.presentation.heroOverlayStrength).toBeLessThanOrEqual(25);
    expect(resolved.presentation.heroScrim.enabled).toBe(true);
    expect(resolved.evaluation.presentationScore).toBeGreaterThanOrEqual(60);

    // Identity unchanged on project
    expect(p.primaryColor).toBe(before.primaryColor);
    expect(p.accentColor).toBe(before.accentColor);
    expect(p.backgroundColor).toBe(before.backgroundColor);

    const explanation = explainBrandPresentation(resolved);
    expect(explanationClaimsBrandChange(explanation)).toBe(false);
    expect(explanation.toLowerCase()).toMatch(/brand palette|branding remains/);
  });

  it("dark brand → white presentation + brand CTA", () => {
    const p = withPattern(
      project({
        primaryColor: NAMED_COLORS.navy,
        accentColor: NAMED_COLORS.teal,
        mediaLibrary: [asset("hero-1", "Forest trail dusk", { width: 1600, height: 1000 })],
      }),
      "hero.contractor_left",
    );
    const resolved = resolveAdaptiveBrandPresentation(p);
    expect(resolved.presentation.heroHeadlineColor.toLowerCase()).toBe(
      WHITE_PRESENTATION.toLowerCase(),
    );
    expect(resolved.presentation.heroPrimaryCTAStyle.background.toLowerCase()).toBe(
      NAMED_COLORS.teal.toLowerCase(),
    );
    expect(p.primaryColor).toBe(NAMED_COLORS.navy);
  });

  it("light brand + minimal hero without image keeps brand ink", () => {
    const p = withPattern(
      project({
        primaryColor: "#1f2937",
        accentColor: NAMED_COLORS.coral,
        backgroundColor: "#f8fafc",
        theme: "light",
        heroImageId: null,
        mediaLibrary: [],
      }),
      "hero.premium_minimal",
    );
    const resolved = resolveAdaptiveBrandPresentation(p);
    expect(resolved.presentation.decisions.usedWhitePresentation).toBe(false);
    expect(resolved.presentation.heroOverlayStrength).toBe(0);
  });

  it("busy city image prefers local scrim over crushing overlay", () => {
    const p = withPattern(
      project({
        mediaLibrary: [
          asset("hero-1", "Busy city street skyline traffic", {
            width: 2800,
            height: 1200,
          }),
        ],
        heroOverlay: 100,
      }),
      "hero.cinematic_full_width",
    );
    const resolved = resolveAdaptiveBrandPresentation(p);
    expect(resolved.image.complexity).toBe("busy");
    expect(resolved.presentation.heroOverlayStrength).toBeLessThan(50);
    expect(resolved.presentation.heroScrim.enabled).toBe(true);
  });

  it("forest image adapts without changing palette", () => {
    const p = withPattern(
      project({
        mediaLibrary: [
          asset("hero-1", "Dark forest woods pine", { width: 1800, height: 1200 }),
        ],
      }),
      "hero.coastal_service",
    );
    const palette = {
      primary: p.primaryColor,
      accent: p.accentColor,
      secondary: p.secondaryColor,
      bg: p.backgroundColor,
    };
    const resolved = resolveAdaptiveBrandPresentation(p);
    expect(resolved.image.brightness).toBe("dark");
    expect(p.primaryColor).toBe(palette.primary);
    expect(p.accentColor).toBe(palette.accent);
    expect(resolved.presentation.heroHeadlineColor.toLowerCase()).toBe(
      WHITE_PRESENTATION.toLowerCase(),
    );
  });

  it.each([
    "hero.cinematic_full_width",
    "hero.coastal_service",
    "hero.contractor_left",
    "hero.premium_minimal",
  ] as const)("pattern %s keeps brand identity after resolve", (patternId) => {
    const p = withPattern(project(), patternId);
    const resolved = resolveAdaptiveBrandPresentation(p);
    expect(resolved.identity.primary).toBe(p.primaryColor);
    expect(resolved.identity.accent).toBe(p.accentColor);
    const check = verifyBrandPresentation({ before: p, after: p });
    expect(check.failures).not.toContain("brand_identity_changed");
    expect(check.diagnostics.brandIntegrityScore).toBe(100);
  });

  it("Editor/Preview/Publish share presentation CSS vars", () => {
    const p = withPattern(
      project({
        mediaLibrary: [
          asset("hero-1", "Bright beach sand", { width: 2400, height: 1200 }),
        ],
      }),
      "hero.cinematic_full_width",
    );
    const style = buildSiteDesignStyle(p) as Record<string, string>;
    expect(style["--site-hero-headline"]?.toLowerCase()).toBe("#ffffff");
    expect(style["--site-hero-eyebrow"]?.toLowerCase()).toBe(
      NAMED_COLORS.gold.toLowerCase(),
    );
    expect(style["--site-primary"]).toBe(p.primaryColor);
    expect(style["--site-accent"]).toBe(p.accentColor);

    const css = buildStaticSiteCss(p);
    expect(css).toContain("--site-hero-headline");
    expect(css).toContain("--site-hero-cta-bg");
    expect(css).toMatch(/\.site-hero\s+\.site-button-primary/);
  });

  it("verify passes when identity intact and presentation adapts", () => {
    const p = withPattern(
      project({
        mediaLibrary: [
          asset("hero-1", "Bright beach ocean", { width: 2400, height: 1200 }),
        ],
      }),
      "hero.cinematic_full_width",
    );
    const result = verifyBrandPresentation({ before: p, after: p });
    expect(result.verified).toBe(true);
    expect(result.diagnostics.contrastImprovement).toBeGreaterThanOrEqual(0);
  });
});
