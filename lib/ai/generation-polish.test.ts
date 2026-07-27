import { describe, expect, it } from "vitest";
import { AI_BRAND_TONES } from "@/components/ai/ai-types";
import {
  allLayoutPresets,
  applySectionPatch,
  buildMediaPlaceholders,
  buildMockWebsiteDraft,
  contrastRatio,
  enabledOptionalSections,
  layoutPresetFromTone,
  meetsWcagAa,
  normalizeOptionalSections,
  normalizeRegenerateSection,
  regenerateDraftSection,
  validateBrandContrast,
} from "@/lib/ai";
import { AI_OPTIONAL_SECTION_IDS } from "@/lib/ai/optional-sections";
import { mapDraftToBusinessProject } from "@/lib/ai/draft-to-project";
import { detectIndustryCategory } from "@/lib/ai/industry-content";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("layout presets", () => {
  it("defines every tone preset with layout fields", () => {
    const presets = allLayoutPresets();
    expect(presets).toHaveLength(AI_BRAND_TONES.length);
    for (const tone of AI_BRAND_TONES) {
      const preset = layoutPresetFromTone(tone);
      expect(preset.id).toBe(tone);
      expect(preset.label).toBeTruthy();
      expect(preset.heroLayout).toBeTruthy();
      expect(preset.sectionSpacing).toBeTruthy();
      expect(preset.ctaStyle).toBeTruthy();
      expect(preset.headingFont).toBeTruthy();
      expect(preset.bodyFont).toBeTruthy();
      expect(preset.buttonStyle).toBeTruthy();
      expect(preset.cardStyle).toBeTruthy();
      expect(preset.colorUsage).toBeTruthy();
      expect(preset.templateId).toBeTruthy();
    }
  });

  it("keeps mappings centralized in layout-presets.ts", () => {
    const src = readFileSync(
      resolve(__dirname, "layout-presets.ts"),
      "utf8",
    );
    expect(src).toContain("professional");
    expect(src).toContain("friendly");
    expect(src).toContain("luxury");
    expect(src).toContain("modern");
    expect(src).toContain("bold");
    expect(src).toContain("heroLayout");
    expect(src).toContain("sectionSpacing");
    expect(src).toContain("ctaStyle");
    expect(src).toContain("cardStyle");
    expect(src).toContain("colorUsage");
  });
});

describe("optional sections", () => {
  it("includes only selected optional sections in the draft", () => {
    const draft = buildMockWebsiteDraft({
      projectId: "p1",
      businessName: "Bright Smiles Dental",
      businessType: "Dentist",
      description: "Gentle family dentistry.",
      questionnaire: {
        tone: "professional",
        optionalSections: {
          testimonials: true,
          faq: true,
          team: false,
          gallery: false,
          pricing: false,
          bookingCta: true,
          newsletter: false,
        },
      },
    });

    expect(draft.enabledSections).toEqual([
      "testimonials",
      "faq",
      "bookingCta",
    ]);
    expect(draft.optionalSections.testimonials?.length).toBeGreaterThan(0);
    expect(draft.optionalSections.faq?.length).toBeGreaterThan(0);
    expect(draft.optionalSections.bookingCta?.buttonText).toBeTruthy();
    expect(draft.optionalSections.team).toBeUndefined();
    expect(draft.optionalSections.pricing).toBeUndefined();
    expect(draft.optionalSections.newsletter).toBeUndefined();
    expect(draft.mediaPlaceholders.gallery).toHaveLength(0);
  });

  it("normalizes unknown toggles to defaults", () => {
    const state = normalizeOptionalSections({ gallery: false, faq: true });
    expect(state.faq).toBe(true);
    expect(state.gallery).toBe(false);
    expect(enabledOptionalSections(state)).toContain("faq");
    expect(enabledOptionalSections(state)).not.toContain("gallery");
    expect(AI_OPTIONAL_SECTION_IDS).toHaveLength(7);
  });
});

describe("industry mock content variety", () => {
  it("varies headlines across industries and seeds", () => {
    const cafe = buildMockWebsiteDraft({
      projectId: "p1",
      businessName: "Cedar Cafe",
      businessType: "Coffee Shop",
      description: "Espresso and pastries.",
    });
    const plumber = buildMockWebsiteDraft({
      projectId: "p1",
      businessName: "Pipe Pros",
      businessType: "Plumber",
      description: "Emergency plumbing.",
    });
    expect(cafe.heroHeadline).not.toBe(plumber.heroHeadline);
    expect(cafe.primaryCta.length).toBeGreaterThan(2);
    expect(plumber.seo.siteTitle).toMatch(/Pipe Pros/);
    expect(detectIndustryCategory("Dentist")).toBe("dentist");
    expect(detectIndustryCategory("Landscaping")).toBe("landscaper");
    expect(detectIndustryCategory("Software company")).toBe("software");
  });
});

describe("branding application", () => {
  it("applies questionnaire colors, tone fonts, and layout into the project", () => {
    const draft = buildMockWebsiteDraft({
      projectId: "p1",
      businessName: "Northforge Digital",
      businessType: "Marketing agency",
      description: "Growth marketing for local brands.",
      questionnaire: {
        tone: "luxury",
        primaryColor: "#1a6b5c",
        accentColor: "#0b1f1a",
      },
    });

    expect(draft.layoutPreset.id).toBe("luxury");
    expect(draft.brand.primaryColor).toBe("#1a6b5c");
    expect(draft.brand.headingFont).toBe(draft.layoutPreset.headingFont);

    const { project, meta } = mapDraftToBusinessProject({
      draft,
      questionnaire: {
        tone: "luxury",
        primaryColor: "#1a6b5c",
        accentColor: "#0b1f1a",
      },
    });

    expect(project.primaryColor).toBe("#1a6b5c");
    expect(project.accentColor).toBe("#0b1f1a");
    expect(project.headingFont).toBe(draft.layoutPreset.headingFont);
    expect(project.bodyFont).toBe(draft.layoutPreset.bodyFont);
    expect(project.buttonStyle).toBe(draft.layoutPreset.buttonStyle);
    expect(project.templateId).toBe(draft.layoutPreset.templateId);
    expect(meta.layoutPresetId).toBe("luxury");
    expect(meta.enabledSections).toEqual(draft.enabledSections);
  });
});

describe("media placeholders", () => {
  it("builds category-specific placeholder metadata", () => {
    const restaurant = buildMediaPlaceholders({
      businessName: "Harbor Kitchen",
      businessType: "Restaurant",
    });
    expect(restaurant.category).toBe("restaurant");
    expect(restaurant.hero.isPlaceholder).toBe(true);
    expect(restaurant.hero.alt).toMatch(/Harbor Kitchen/);
    expect(restaurant.gallery.length).toBeGreaterThan(0);
    expect(restaurant.gallery[0]?.label.toLowerCase()).toMatch(
      /dish|dining|chef|brunch|food|kitchen|plate|menu/,
    );

    const software = buildMediaPlaceholders({
      businessName: "Atlas Cloud",
      businessType: "Software company",
    });
    expect(software.category).toBe("software");
    expect(software.gallery[0]?.label.toLowerCase()).toMatch(
      /dashboard|product|ui|app|interface/,
    );

    const landscaper = buildMediaPlaceholders({
      businessName: "Greenline Landscapes",
      businessType: "Landscaping",
    });
    expect(landscaper.category).toBe("landscaper");
  });
});

describe("regeneration + comparison workflow", () => {
  it("normalizes section ids", () => {
    expect(normalizeRegenerateSection("hero")).toBe("hero");
    expect(() => normalizeRegenerateSection("faq")).toThrow(/section/i);
  });

  it("regenerates only the selected section", async () => {
    const current = buildMockWebsiteDraft({
      projectId: "p1",
      businessName: "Cedar Cafe",
      businessType: "Coffee Shop",
      description: "Neighborhood espresso.",
      questionnaire: {
        tone: "friendly",
        primaryServices: ["Espresso", "Pastries", "Catering"],
        optionalSections: { testimonials: true, gallery: true },
      },
    });

    const result = await regenerateDraftSection({
      section: "hero",
      currentDraft: current,
      generateInput: {
        projectId: "p1",
        businessName: "Cedar Cafe",
        businessType: "Coffee Shop",
        description: "Neighborhood espresso.",
        questionnaire: {
          tone: "friendly",
          primaryServices: ["Espresso", "Pastries", "Catering"],
          optionalSections: { testimonials: true, gallery: true },
        },
      },
      variation: 3,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const next = applySectionPatch(current, result.patch);
    expect(next.aboutBody).toBe(current.aboutBody);
    expect(next.services).toEqual(current.services);
    expect(next.enabledSections).toEqual(current.enabledSections);
    expect(next.contact.email).toBe(current.contact.email);
    expect(result.patch.services).toBeUndefined();
    expect(result.patch.aboutBody).toBeUndefined();
    expect(result.patch.heroHeadline).toBeTruthy();
  });

  it("supports accept vs keep-current comparison decisions", async () => {
    const current = buildMockWebsiteDraft({
      projectId: "p1",
      businessName: "Pipe Pros",
      businessType: "Plumber",
      description: "Fast plumbing.",
    });
    const result = await regenerateDraftSection({
      section: "about",
      currentDraft: current,
      generateInput: {
        projectId: "p1",
        businessName: "Pipe Pros",
        businessType: "Plumber",
        description: "Fast plumbing.",
      },
      variation: 5,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const accepted = applySectionPatch(current, result.patch);
    const kept = current;
    expect(accepted.aboutTitle).toBeTruthy();
    expect(kept.aboutBody).toBe(current.aboutBody);
    expect(accepted.services).toEqual(current.services);
  });

  it("regenerate API route exists and is authenticated", () => {
    const src = readFileSync(
      resolve(__dirname, "../../app/api/ai/regenerate/route.ts"),
      "utf8",
    );
    expect(src).toContain("unauthorized");
    expect(src).toContain("regenerateDraftSection");
    expect(src).toContain('eq("owner_id", user.id)');
    expect(src).toContain("normalizeRegenerateSection");
  });

  it("draft preview wires comparison Accept / Keep Current", () => {
    const src = readFileSync(
      resolve(__dirname, "../../components/ai/ai-draft-preview.tsx"),
      "utf8",
    );
    expect(src).toContain("Regenerate Hero");
    expect(src).toContain("Regenerate About");
    expect(src).toContain("Regenerate Services");
    expect(src).toContain("Accept");
    expect(src).toContain("Keep Current");
    expect(src).toContain("/api/ai/regenerate");
    expect(src).toContain("applySectionPatch");
  });
});

describe("accessibility contrast validation", () => {
  it("computes WCAG ratios and warns on weak CTAs", () => {
    const ratio = contrastRatio("#ffffff", "#000000");
    expect(ratio).toBeGreaterThan(20);
    expect(meetsWcagAa("#101828", "#ffffff")).toBe(true);

    const warnings = validateBrandContrast({
      primaryColor: "#eeeeee",
      accentColor: "#dddddd",
      backgroundColor: "#f7f8fa",
    });
    expect(warnings.some((w) => w.code === "low_contrast_cta")).toBe(true);
  });
});
