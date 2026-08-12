/**
 * HeroCompositionResolver — persisted | inferred → canonical composition.
 */

import { inferLegacyHeroComposition } from "@/lib/hero-composition/infer-legacy";
import type {
  HeroComposition,
  HeroCompositionResolveInput,
} from "@/lib/hero-composition/types";
import { HERO_COMPOSITION_VERSION } from "@/lib/hero-composition/types";
import { getTemplate } from "@/lib/templates";
import type { BusinessProject } from "@/types/business-project";

function isHeroComposition(value: unknown): value is HeroComposition {
  if (!value || typeof value !== "object") return false;
  const v = value as Partial<HeroComposition>;
  return (
    v.version === HERO_COMPOSITION_VERSION &&
    typeof v.layout === "string" &&
    typeof v.minHeight === "string" &&
    typeof v.contentAlignment === "string" &&
    typeof v.verticalAlignment === "string" &&
    typeof v.contentWidth === "string" &&
    Boolean(v.image) &&
    Boolean(v.treatment) &&
    Boolean(v.typography) &&
    Boolean(v.cta) &&
    Boolean(v.mobile) &&
    Boolean(v.accents)
  );
}

function normalizePersisted(
  stored: HeroComposition,
  fallback: HeroComposition,
): HeroComposition {
  return {
    ...fallback,
    ...stored,
    version: HERO_COMPOSITION_VERSION,
    image: { ...fallback.image, ...stored.image },
    treatment: {
      ...fallback.treatment,
      ...stored.treatment,
      gradient:
        stored.treatment?.gradient === undefined
          ? fallback.treatment.gradient
          : stored.treatment.gradient,
      textScrim:
        stored.treatment?.textScrim === undefined
          ? fallback.treatment.textScrim
          : stored.treatment.textScrim,
    },
    typography: { ...fallback.typography, ...stored.typography },
    cta: { ...fallback.cta, ...stored.cta },
    mobile: { ...fallback.mobile, ...stored.mobile },
    accents: { ...fallback.accents, ...stored.accents },
  };
}

function normalizeFit(
  fit: "cover" | "contain" | "full" | undefined,
): "cover" | "contain" | undefined {
  if (fit === "contain" || fit === "full") return "contain";
  if (fit === "cover") return "cover";
  return undefined;
}

/**
 * When a composition is applied (pattern or persisted), keep structural fields
 * but always let live project presentation / overlay / treatment win.
 * Restraint and readability edits must not require a patternId to take effect.
 */
function applyLivePresentationOverlay(
  base: HeroComposition,
  input: HeroCompositionResolveInput,
): HeroComposition {
  const presentation = input.heroImagePresentation;
  const treatment = input.heroTreatment;
  const fit = normalizeFit(presentation?.fit);
  const hasLiveOverlay = typeof input.heroOverlay === "number";
  const hasLiveTreatment = Boolean(treatment);
  if (!hasLiveOverlay && !hasLiveTreatment && !presentation) {
    return base;
  }
  return {
    ...base,
    image: {
      fit: fit ?? base.image.fit,
      position: presentation?.position ?? base.image.position,
      zoom: presentation?.zoom ?? base.image.zoom,
      focalPoint: presentation?.focalPoint ?? base.image.focalPoint,
    },
    treatment: {
      overlay: hasLiveOverlay
        ? (input.heroOverlay as number)
        : base.treatment.overlay,
      gradient:
        treatment && "gradient" in treatment
          ? treatment.gradient ?? null
          : base.treatment.gradient,
      textScrim:
        treatment && "textScrim" in treatment
          ? treatment.textScrim ?? null
          : base.treatment.textScrim,
    },
  };
}

/**
 * Resolve a canonical HeroComposition for rendering.
 * Never mutates stored project data.
 */
export function resolveHeroComposition(
  input: HeroCompositionResolveInput,
): HeroComposition {
  const legacy = inferLegacyHeroComposition(input);
  if (isHeroComposition(input.heroComposition)) {
    return applyLivePresentationOverlay(
      normalizePersisted(input.heroComposition, legacy),
      input,
    );
  }
  return legacy;
}

/**
 * Resolve from a BusinessProject (uses templateId → heroLayout).
 */
export function resolveHeroCompositionFromProject(
  project: Pick<
    BusinessProject,
    | "templateId"
    | "heroOverlay"
    | "heroTreatment"
    | "heroImagePresentation"
    | "heroComposition"
  >,
): HeroComposition {
  const template = getTemplate(project.templateId);
  return resolveHeroComposition({
    heroComposition: project.heroComposition,
    heroLayout: template.heroLayout,
    heroOverlay: project.heroOverlay,
    heroTreatment: project.heroTreatment,
    heroImagePresentation: project.heroImagePresentation,
  });
}
