/**
 * Adaptive presentation decisions — never mutate brand identity.
 */

import { contrastRatio } from "@/lib/ai/contrast";
import {
  bestReadableInk,
  ctaTextOnBackground,
  isDarkBrandColor,
  isGoldLikeAccent,
  isLightBrandSurface,
  snapOverlayStrength,
} from "@/lib/brand-presentation/color-roles";
import type {
  AdaptiveBrandPresentation,
  BrandIdentity,
  HeroImagePresentationContext,
} from "@/lib/brand-presentation/types";
import {
  NEAR_BLACK_PRESENTATION,
  WHITE_PRESENTATION,
} from "@/lib/brand-presentation/types";
import type { HeroComposition } from "@/lib/hero-composition";

export type AdaptBrandPresentationInput = {
  identity: BrandIdentity;
  image: HeroImagePresentationContext;
  composition: HeroComposition;
  effectiveHeroSurface: string;
  currentOverlay: number;
};

export function adaptBrandPresentation(
  input: AdaptBrandPresentationInput,
): AdaptiveBrandPresentation {
  const { identity, image, composition, effectiveHeroSurface } = input;
  const goldAccent = isGoldLikeAccent(identity.accent);
  const lightBrand = isLightBrandSurface(identity.neutral);
  const darkPrimary = isDarkBrandColor(identity.primary);
  const pattern = composition.patternId ?? "";
  const photoLed =
    pattern === "hero.cinematic_full_width" ||
    pattern === "hero.coastal_service" ||
    pattern === "hero.contractor_left";
  const minimal = pattern === "hero.premium_minimal";

  // --- Minimal / no image: brand ink colors; don't invent a crush overlay ---
  if (!image.hasImage || minimal) {
    const ink = lightBrand ? NEAR_BLACK_PRESENTATION : WHITE_PRESENTATION;
    const ctaBg = identity.accent;
    const preserveOverlay = minimal
      ? 0
      : snapOverlayStrength(
          Math.min(input.currentOverlay, composition.treatment.overlay),
        );
    const preserveScrim = minimal
      ? { enabled: false, opacity: 0, blur: 0 }
      : {
          enabled: Boolean(composition.treatment.textScrim?.enabled),
          opacity: composition.treatment.textScrim?.opacity ?? 0,
          blur: composition.treatment.textScrim?.blur ?? 0,
        };
    const preserveGradient = minimal
      ? null
      : composition.treatment.gradient
        ? { ...composition.treatment.gradient }
        : null;
    return {
      heroHeadlineColor: lightBrand ? identity.primary : ink,
      heroEyebrowColor: identity.accent,
      heroBodyColor: lightBrand ? "#475467" : "#d0d5dd",
      heroPrimaryCTAStyle: {
        background: ctaBg,
        color: ctaTextOnBackground(ctaBg),
        emphasis: "default",
      },
      heroSecondaryCTAStyle: {
        background: "transparent",
        color: lightBrand ? identity.primary : WHITE_PRESENTATION,
        border: lightBrand ? "rgba(16,24,40,0.18)" : "rgba(255,255,255,0.28)",
        emphasis: "outline",
      },
      heroOverlayStrength: preserveOverlay,
      heroScrim: preserveScrim,
      heroGradient: preserveGradient,
      heroButtonContrast: contrastRatio(ctaTextOnBackground(ctaBg), ctaBg) ?? 4.5,
      decisions: {
        usedWhitePresentation: false,
        headlineColorDecision: lightBrand ? "brand_ink" : "theme_ink",
        ctaDecision: "brand_accent_cta",
        scrimDecision: preserveScrim.enabled ? "preserve_composition_scrim" : "none",
        gradientDecision: preserveGradient
          ? "preserve_composition_gradient"
          : "none",
        presentationDecision: minimal
          ? "minimal_brand_ink"
          : "no_image_asset_brand_ink",
        overlayDecision: minimal ? "zero" : "preserve_composition_overlay",
      },
    };
  }

  // --- Photo-led adaptive path ---
  const lightImage = image.brightness === "light";
  const darkImage = image.brightness === "dark";
  const busy = image.complexity === "busy";

  // Photo heroes: prefer white presentation when imagery is light/busy or the
  // brand is dark — local scrim makes white readable without palette changes.
  // Pure contrast-on-raw-pixels would wrongly pick dark ink on bright beaches.
  const preferWhite =
    lightImage ||
    busy ||
    darkPrimary ||
    !lightBrand ||
    pattern === "hero.cinematic_full_width";

  const brandInkCandidate = lightBrand
    ? identity.primary
    : darkPrimary
      ? WHITE_PRESENTATION
      : identity.primary;

  const headline = preferWhite
    ? WHITE_PRESENTATION
    : bestReadableInk(effectiveHeroSurface, [
        WHITE_PRESENTATION,
        brandInkCandidate,
        NEAR_BLACK_PRESENTATION,
      ]);
  const usedWhitePresentation = headline.toLowerCase() === WHITE_PRESENTATION;

  // Gold = eyebrow / CTA accent, never long body.
  const eyebrow = goldAccent
    ? identity.accent
    : usedWhitePresentation
      ? identity.accent
      : identity.accent;

  const body = usedWhitePresentation
    ? "rgba(255,255,255,0.88)"
    : lightBrand
      ? "#475467"
      : "#d0d5dd";

  // CTA: gold brands keep gold CTA; otherwise brand accent.
  const ctaBg = identity.accent;
  const ctaColor = ctaTextOnBackground(ctaBg);
  const ctaEmphasis =
    goldAccent || pattern === "hero.cinematic_full_width" ? "strong" : "default";

  // Treatment ladder: move/localize → scrim → gradient → overlay last.
  let overlay = Math.min(input.currentOverlay, composition.treatment.overlay);
  let scrimEnabled = Boolean(composition.treatment.textScrim?.enabled);
  let scrimOpacity = composition.treatment.textScrim?.opacity ?? 0.22;
  let scrimBlur = composition.treatment.textScrim?.blur ?? 6;
  let gradient = composition.treatment.gradient
    ? { ...composition.treatment.gradient }
    : null;

  if (lightImage || busy || goldAccent) {
    // Prefer local contrast over global wash.
    overlay = Math.min(overlay, 25);
    scrimEnabled = true;
    scrimOpacity = Math.max(scrimOpacity, lightImage ? 0.28 : 0.24);
    scrimBlur = Math.max(scrimBlur, 6);
    gradient = {
      direction: "bottom",
      strength: busy ? 0.42 : 0.36,
      coverage: busy ? 0.52 : 0.46,
    };
  } else if (darkImage) {
    overlay = Math.min(overlay, 25);
    scrimEnabled = true;
    scrimOpacity = Math.min(Math.max(scrimOpacity, 0.18), 0.28);
    gradient = gradient ?? {
      direction: "bottom",
      strength: 0.32,
      coverage: 0.45,
    };
  } else if (photoLed) {
    overlay = Math.min(overlay, 25);
    scrimEnabled = true;
    scrimOpacity = Math.max(scrimOpacity, 0.2);
    gradient = gradient ?? {
      direction: "bottom",
      strength: 0.34,
      coverage: 0.48,
    };
  }

  // Crushing overlays are never the first tool.
  if (overlay >= 50) {
    overlay = 25;
    scrimEnabled = true;
    scrimOpacity = Math.max(scrimOpacity, 0.26);
  }

  overlay = snapOverlayStrength(overlay);

  return {
    heroHeadlineColor: headline,
    heroEyebrowColor: eyebrow,
    heroBodyColor: body,
    heroPrimaryCTAStyle: {
      background: ctaBg,
      color: ctaColor,
      emphasis: ctaEmphasis,
    },
    heroSecondaryCTAStyle: {
      background: "transparent",
      color: usedWhitePresentation ? WHITE_PRESENTATION : identity.primary,
      border: usedWhitePresentation
        ? "rgba(255,255,255,0.35)"
        : "rgba(16,24,40,0.2)",
      emphasis: "outline",
    },
    heroOverlayStrength: overlay,
    heroScrim: {
      enabled: scrimEnabled,
      opacity: scrimOpacity,
      blur: scrimBlur,
    },
    heroGradient: gradient,
    heroButtonContrast: contrastRatio(ctaColor, ctaBg) ?? 4.5,
    decisions: {
      usedWhitePresentation,
      headlineColorDecision: usedWhitePresentation
        ? "white_presentation_for_contrast"
        : "brand_ink",
      ctaDecision: goldAccent ? "gold_accent_cta" : "brand_accent_cta",
      scrimDecision: scrimEnabled
        ? lightImage || busy
          ? "local_scrim_preferred"
          : "supportive_scrim"
        : "none",
      gradientDecision: gradient
        ? "localized_lower_third"
        : "none",
      presentationDecision:
        lightImage && goldAccent
          ? "white_headings_gold_accents_on_bright_image"
          : busy
            ? "local_contrast_on_busy_image"
            : darkImage
              ? "white_on_dark_imagery"
              : "photo_led_readable_presentation",
      overlayDecision:
        overlay <= 25 ? "capped_for_image_impact" : "composition_overlay",
    },
  };
}
