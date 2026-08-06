import {
  BODY_FONTS,
  BUTTON_STYLES,
  HEADING_FONTS,
  SITE_WIDTHS,
  type BodyFontId,
  type ButtonStyleId,
  type HeadingFontId,
  type SiteWidthId,
} from "@/data/design-options";
import {
  brandPresentationCssVars,
  resolveAdaptiveBrandPresentation,
} from "@/lib/brand-presentation";
import {
  buildHeroRenderPlan,
  resolveHeroCompositionFromProject,
} from "@/lib/hero-composition";
import type { BusinessProject } from "@/types/business-project";
import type { CSSProperties } from "react";
import { accentToSoft } from "@/lib/website-generator";

function parseHex(hex: string): { r: number; g: number; b: number } | null {
  const clean = hex.replace("#", "").trim();
  if (clean.length !== 6) return null;
  const r = Number.parseInt(clean.slice(0, 2), 16);
  const g = Number.parseInt(clean.slice(2, 4), 16);
  const b = Number.parseInt(clean.slice(4, 6), 16);
  if ([r, g, b].some((channel) => Number.isNaN(channel))) return null;
  return { r, g, b };
}

function isLightColor(hex: string): boolean {
  const rgb = parseHex(hex);
  if (!rgb) return false;
  const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
  return luminance > 0.58;
}

function mixHex(base: string, tint: string, amount: number): string {
  const a = parseHex(base);
  const b = parseHex(tint);
  if (!a || !b) return base;
  const mix = (x: number, y: number) =>
    Math.round(x + (y - x) * Math.min(Math.max(amount, 0), 1));
  const toHex = (n: number) => n.toString(16).padStart(2, "0");
  return `#${toHex(mix(a.r, b.r))}${toHex(mix(a.g, b.g))}${toHex(mix(a.b, b.b))}`;
}

function fontCssVar(
  id: HeadingFontId | BodyFontId,
  catalog: typeof HEADING_FONTS | typeof BODY_FONTS,
): string {
  return catalog.find((font) => font.id === id)?.cssVar ?? "var(--font-inter)";
}

function buttonRadius(style: ButtonStyleId): string {
  return BUTTON_STYLES.find((item) => item.id === style)?.radius ?? "0.75rem";
}

function contentMaxWidth(width: SiteWidthId): string {
  return SITE_WIDTHS.find((item) => item.id === width)?.maxWidth ?? "72rem";
}

function normalizeOverlay(value: number): number {
  const clamped = Math.min(100, Math.max(0, value));
  return clamped / 100;
}

/**
 * Build CSS custom properties for the live site canvas from Brand Studio settings.
 */
export function buildSiteDesignStyle(
  project: BusinessProject,
): CSSProperties {
  const background = project.backgroundColor || "#07090d";
  const lightBg = isLightColor(background);
  const fg = lightBg ? "#101828" : "#f2f4f7";
  const muted = lightBg ? "#667085" : "#9aa3b2";
  const surface = mixHex(background, project.secondaryColor || background, 0.35);
  const border = lightBg
    ? "rgba(16, 24, 40, 0.1)"
    : "rgba(255, 255, 255, 0.1)";
  const accent = project.accentColor || project.primaryColor;
  const composition = resolveHeroCompositionFromProject(project);
  const heroPlan = buildHeroRenderPlan(composition);
  const brandPresentation = resolveAdaptiveBrandPresentation(project);
  const presentationVars = brandPresentationCssVars(brandPresentation);
  const overlay = normalizeOverlay(
    brandPresentation.presentation.heroOverlayStrength,
  );

  const gradientDirection = (() => {
    const direction =
      brandPresentation.presentation.heroGradient?.direction ??
      composition.treatment.gradient?.direction ??
      project.heroTreatment?.gradient?.direction;
    if (direction === "left") return "to right";
    if (direction === "right") return "to left";
    if (direction === "top") return "to bottom";
    return "to top";
  })();

  return {
    "--site-bg": background,
    "--site-fg": fg,
    "--site-muted": muted,
    "--site-surface": surface,
    "--site-border": border,
    // Brand identity tokens — never rewritten by presentation.
    "--site-primary": project.primaryColor,
    "--site-secondary": project.secondaryColor,
    "--site-accent": accent,
    "--site-accent-soft": accentToSoft(accent),
    "--site-form-field-bg":
      project.componentSurfaces?.formFields?.backgroundColor || surface,
    "--site-form-field-fg":
      project.componentSurfaces?.formFields?.textColor || fg,
    "--site-form-field-border":
      project.componentSurfaces?.formFields?.borderColor || border,
    "--site-form-field-focus":
      project.componentSurfaces?.formFields?.focusColor || accent,
    "--site-text-panel-bg":
      project.componentSurfaces?.textPanels?.backgroundColor || surface,
    "--site-card-bg":
      project.componentSurfaces?.cards?.backgroundColor || surface,
    "--site-heading-font": fontCssVar(project.headingFont, HEADING_FONTS),
    "--site-body-font": fontCssVar(project.bodyFont, BODY_FONTS),
    "--site-button-radius": buttonRadius(project.buttonStyle),
    "--site-hero-overlay": String(overlay),
    "--site-hero-min-height": heroPlan.cssVars["--site-hero-min-height"],
    "--site-hero-content-align":
      heroPlan.cssVars["--site-hero-content-align"],
    "--site-hero-vertical-align":
      heroPlan.cssVars["--site-hero-vertical-align"],
    "--site-hero-content-max": heroPlan.cssVars["--site-hero-content-max"],
    "--site-hero-gradient-opacity":
      presentationVars["--site-hero-gradient-opacity"] ??
      String(
        composition.treatment.gradient?.strength ??
          project.heroTreatment?.gradient?.strength ??
          0,
      ),
    "--site-hero-gradient-coverage":
      presentationVars["--site-hero-gradient-coverage"] ??
      `${Math.round(
        (composition.treatment.gradient?.coverage ??
          project.heroTreatment?.gradient?.coverage ??
          0) * 100,
      )}%`,
    "--site-hero-gradient-direction": gradientDirection,
    "--site-hero-scrim-opacity":
      presentationVars["--site-hero-scrim-opacity"] ?? "0",
    "--site-hero-scrim-blur":
      presentationVars["--site-hero-scrim-blur"] ?? "0px",
    "--site-hero-object-fit":
      composition.image.fit === "contain" ? "contain" : "cover",
    "--site-hero-object-position": (() => {
      const pos = composition.image.position;
      const fp = composition.image.focalPoint;
      if (pos === "top") return "50% 0%";
      if (pos === "bottom") return "50% 100%";
      if (pos === "left") return "0% 50%";
      if (pos === "right") return "100% 50%";
      return `${Math.round(fp.x * 100)}% ${Math.round(fp.y * 100)}%`;
    })(),
    "--site-hero-object-zoom": String(composition.image.zoom ?? 1),
    // Adaptive hero presentation colors (computed — not Brand Studio).
    "--site-hero-headline": presentationVars["--site-hero-headline"],
    "--site-hero-eyebrow": presentationVars["--site-hero-eyebrow"],
    "--site-hero-body": presentationVars["--site-hero-body"],
    "--site-hero-cta-bg": presentationVars["--site-hero-cta-bg"],
    "--site-hero-cta-fg": presentationVars["--site-hero-cta-fg"],
    "--site-hero-cta-secondary-fg":
      presentationVars["--site-hero-cta-secondary-fg"],
    "--site-hero-cta-secondary-border":
      presentationVars["--site-hero-cta-secondary-border"],
    "--site-content-max": contentMaxWidth(project.siteWidth),
    "--site-section-pad":
      project.creativePolish?.spacing === "airy"
        ? "5.5rem"
        : project.creativePolish?.spacing === "comfortable"
          ? "4.5rem"
          : "4rem",
    "--site-heading-scale": project.creativePolish?.visualHierarchy
      ? "1.06"
      : "1",
    /* Remap Tailwind semantic tokens inside the canvas */
    "--background": background,
    "--foreground": fg,
    "--muted": muted,
    "--surface": surface,
    "--border": border,
    "--accent": accent,
    "--color-background": background,
    "--color-foreground": fg,
    "--color-muted": muted,
    "--color-surface": surface,
    "--color-border": border,
    "--color-accent": accent,
    backgroundColor: background,
    color: fg,
    fontFamily: fontCssVar(project.bodyFont, BODY_FONTS),
  } as CSSProperties;
}
