/**
 * Infer a HeroComposition from legacy template heroLayout + presentation fields.
 * Must preserve Preview/Publish appearance for existing projects.
 */

import type {
  HeroComposition,
  HeroCompositionResolveInput,
} from "@/lib/hero-composition/types";
import { HERO_COMPOSITION_VERSION } from "@/lib/hero-composition/types";

function clampOverlay(value: number): number {
  if (!Number.isFinite(value)) return 50;
  return Math.min(100, Math.max(0, Math.round(value)));
}

function normalizeFit(
  fit: "cover" | "contain" | "full" | undefined,
): "cover" | "contain" {
  return fit === "contain" || fit === "full" ? "contain" : "cover";
}

/**
 * Build the legacy-equivalent composition for a template heroLayout.
 * Does not read or write persisted heroComposition.
 */
export function inferLegacyHeroComposition(
  input: HeroCompositionResolveInput,
): HeroComposition {
  const layout = input.heroLayout;
  const presentation = input.heroImagePresentation;
  const treatment = input.heroTreatment;
  const projectOverlay = clampOverlay(input.heroOverlay ?? 50);

  const image = {
    fit: normalizeFit(presentation?.fit),
    position: presentation?.position ?? ("center" as const),
    zoom: presentation?.zoom ?? 1,
    focalPoint: presentation?.focalPoint ?? { x: 0.5, y: 0.5 },
  };

  const gradient = treatment?.gradient
    ? {
        direction: treatment.gradient.direction,
        strength: treatment.gradient.strength,
        coverage: treatment.gradient.coverage,
      }
    : null;

  const textScrim = treatment?.textScrim
    ? {
        enabled: treatment.textScrim.enabled,
        opacity: treatment.textScrim.opacity,
        blur: treatment.textScrim.blur,
      }
    : null;

  const baseTreatment = {
    overlay: projectOverlay,
    gradient,
    textScrim,
  };

  switch (layout) {
    case "split":
      return {
        patternId: null,
        version: HERO_COMPOSITION_VERSION,
        layout: "split",
        legacyLayoutKey: "split",
        minHeight: "medium",
        contentAlignment: "left",
        verticalAlignment: "center",
        contentWidth: "medium",
        image,
        // Legacy Preview/Publish force ~30% overlay on the split image panel.
        treatment: { ...baseTreatment, overlay: 30 },
        typography: {
          headingScale: "md",
          headingWeight: 600,
          bodyScale: "md",
          showSecondaryCta: true,
        },
        cta: {
          arrangement: "row",
          alignment: "left",
          primaryEmphasis: "default",
        },
        mobile: {
          layout: "stack_copy_first",
          minHeight: "medium",
        },
        accents: { showAccentWash: false, showGrid: false },
      };

    case "minimal":
      return {
        patternId: null,
        version: HERO_COMPOSITION_VERSION,
        layout: "full_width",
        legacyLayoutKey: "minimal",
        minHeight: "short",
        contentAlignment: "center",
        verticalAlignment: "center",
        contentWidth: "wide",
        image,
        treatment: baseTreatment,
        typography: {
          headingScale: "sm",
          headingWeight: 600,
          bodyScale: "md",
          showSecondaryCta: true,
        },
        cta: {
          arrangement: "row",
          alignment: "center",
          primaryEmphasis: "quiet",
        },
        mobile: {
          layout: "keep_overlay",
          minHeight: "short",
        },
        accents: { showAccentWash: false, showGrid: false },
      };

    case "bold-overlay":
      return {
        patternId: null,
        version: HERO_COMPOSITION_VERSION,
        layout: "full_width",
        legacyLayoutKey: "bold-overlay",
        minHeight: "tall",
        contentAlignment: "left",
        verticalAlignment: "center",
        contentWidth: "medium",
        image,
        // Legacy Preview/Publish force 80% overlay for bold-overlay.
        treatment: { ...baseTreatment, overlay: 80 },
        typography: {
          headingScale: "xl",
          headingWeight: 600,
          bodyScale: "md",
          showSecondaryCta: true,
        },
        cta: {
          arrangement: "row",
          alignment: "left",
          primaryEmphasis: "strong",
        },
        mobile: {
          layout: "keep_overlay",
          minHeight: "medium",
        },
        accents: { showAccentWash: true, showGrid: false },
      };

    case "centered":
    default:
      return {
        patternId: null,
        version: HERO_COMPOSITION_VERSION,
        layout: "full_width",
        legacyLayoutKey: "centered",
        minHeight: "medium",
        contentAlignment: "center",
        verticalAlignment: "center",
        contentWidth: "wide",
        image,
        treatment: baseTreatment,
        typography: {
          headingScale: "lg",
          headingWeight: 600,
          bodyScale: "md",
          showSecondaryCta: true,
        },
        cta: {
          arrangement: "row",
          alignment: "center",
          primaryEmphasis: "default",
        },
        mobile: {
          layout: "keep_overlay",
          minHeight: "medium",
        },
        accents: { showAccentWash: true, showGrid: true },
      };
  }
}
