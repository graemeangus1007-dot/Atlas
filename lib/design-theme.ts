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
  const overlay = normalizeOverlay(project.heroOverlay ?? 50);

  return {
    "--site-bg": background,
    "--site-fg": fg,
    "--site-muted": muted,
    "--site-surface": surface,
    "--site-border": border,
    "--site-primary": project.primaryColor,
    "--site-secondary": project.secondaryColor,
    "--site-accent": accent,
    "--site-accent-soft": accentToSoft(accent),
    "--site-heading-font": fontCssVar(project.headingFont, HEADING_FONTS),
    "--site-body-font": fontCssVar(project.bodyFont, BODY_FONTS),
    "--site-button-radius": buttonRadius(project.buttonStyle),
    "--site-hero-overlay": String(overlay),
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
