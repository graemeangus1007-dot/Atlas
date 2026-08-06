/**
 * P1 — Atomic hero pattern application (four executable patterns).
 */

import { HERO_OVERLAY_STEPS, type HeroOverlayStep } from "@/data/design-options";
import { textExposesDesignPatternIds } from "@/lib/ai/design-patterns/registry";
import type { EditOperation } from "@/lib/ai/edit-operations";
import {
  buildHeroRenderPlan,
  HERO_COMPOSITION_VERSION,
  type HeroComposition,
  resolveHeroCompositionFromProject,
} from "@/lib/hero-composition";
import { getTemplate } from "@/lib/templates";
import type { BusinessProject } from "@/types/business-project";

export const EXECUTABLE_HERO_PATTERN_IDS = [
  "hero.cinematic_full_width",
  "hero.coastal_service",
  "hero.contractor_left",
  "hero.premium_minimal",
] as const;

export type ExecutableHeroPatternId =
  (typeof EXECUTABLE_HERO_PATTERN_IDS)[number];

export function isExecutableHeroPatternId(
  id: string,
): id is ExecutableHeroPatternId {
  return (EXECUTABLE_HERO_PATTERN_IDS as readonly string[]).includes(id);
}

export type HeroPatternPlanResult = {
  operations: EditOperation[];
  patternId: ExecutableHeroPatternId;
  requestedPatternId: ExecutableHeroPatternId;
  composition: HeroComposition;
  explanation: string;
  alreadySatisfied: boolean;
  fallbackUsed: boolean;
  fallbackReason: string | null;
  blocked: boolean;
  blockReason: string | null;
};

export type HeroPatternVerifyResult = {
  verified: boolean;
  failures: string[];
  alreadySatisfied: boolean;
  globalThemeChanged: boolean;
  scopeViolations: string[];
};

function snapOverlay(value: number): HeroOverlayStep {
  let best: HeroOverlayStep = HERO_OVERLAY_STEPS[0]!;
  let bestDist = Infinity;
  for (const step of HERO_OVERLAY_STEPS) {
    const dist = Math.abs(step - value);
    if (dist < bestDist) {
      best = step;
      bestDist = dist;
    }
  }
  return best;
}

function hasUsableHeroImage(project: BusinessProject): boolean {
  if (!project.heroImageId) return false;
  return project.mediaLibrary.some((a) => a.id === project.heroImageId && a.url);
}

function headlineLength(project: BusinessProject): number {
  return (project.heroHeadline || "").trim().length;
}

function hasSecondaryCta(project: BusinessProject): boolean {
  return Boolean(project.secondaryCta?.trim());
}

/** Deterministic base presets (audit definitions). */
export function heroPatternPreset(
  patternId: ExecutableHeroPatternId,
): HeroComposition {
  switch (patternId) {
    case "hero.cinematic_full_width":
      return {
        patternId,
        version: HERO_COMPOSITION_VERSION,
        layout: "full_width",
        legacyLayoutKey: "bold-overlay",
        minHeight: "viewport",
        contentAlignment: "center",
        verticalAlignment: "center",
        contentWidth: "medium",
        image: {
          fit: "cover",
          position: "center",
          zoom: 1.05,
          focalPoint: { x: 0.5, y: 0.42 },
        },
        treatment: {
          overlay: 25,
          gradient: {
            direction: "bottom",
            strength: 0.35,
            coverage: 0.55,
          },
          textScrim: { enabled: true, opacity: 0.22, blur: 6 },
        },
        typography: {
          headingScale: "xl",
          headingWeight: 600,
          bodyScale: "md",
          showSecondaryCta: false,
        },
        cta: {
          arrangement: "row",
          alignment: "center",
          primaryEmphasis: "strong",
        },
        mobile: { layout: "keep_overlay", minHeight: "tall" },
        accents: { showAccentWash: true, showGrid: false },
      };
    case "hero.coastal_service":
      return {
        patternId,
        version: HERO_COMPOSITION_VERSION,
        layout: "full_width",
        legacyLayoutKey: "centered",
        minHeight: "medium",
        contentAlignment: "left",
        verticalAlignment: "center",
        contentWidth: "medium",
        image: {
          fit: "cover",
          position: "center",
          zoom: 1,
          focalPoint: { x: 0.5, y: 0.45 },
        },
        treatment: {
          overlay: 25,
          gradient: {
            direction: "bottom",
            strength: 0.28,
            coverage: 0.5,
          },
          textScrim: null,
        },
        typography: {
          headingScale: "lg",
          headingWeight: 600,
          bodyScale: "md",
          showSecondaryCta: true,
        },
        cta: {
          arrangement: "row",
          alignment: "left",
          primaryEmphasis: "default",
        },
        mobile: { layout: "keep_overlay", minHeight: "medium" },
        accents: { showAccentWash: true, showGrid: false },
      };
    case "hero.contractor_left":
      return {
        patternId,
        version: HERO_COMPOSITION_VERSION,
        layout: "full_width",
        legacyLayoutKey: "bold-overlay",
        minHeight: "tall",
        contentAlignment: "left",
        verticalAlignment: "center",
        contentWidth: "medium",
        image: {
          fit: "cover",
          position: "center",
          zoom: 1.08,
          focalPoint: { x: 0.55, y: 0.5 },
        },
        treatment: {
          overlay: 50,
          gradient: {
            direction: "left",
            strength: 0.5,
            coverage: 0.65,
          },
          textScrim: { enabled: true, opacity: 0.28, blur: 4 },
        },
        typography: {
          headingScale: "lg",
          headingWeight: 600,
          bodyScale: "md",
          showSecondaryCta: true,
        },
        cta: {
          arrangement: "row",
          alignment: "left",
          primaryEmphasis: "strong",
        },
        mobile: { layout: "stack_copy_first", minHeight: "medium" },
        accents: { showAccentWash: true, showGrid: false },
      };
    case "hero.premium_minimal":
      return {
        patternId,
        version: HERO_COMPOSITION_VERSION,
        layout: "contained",
        legacyLayoutKey: "minimal",
        minHeight: "short",
        contentAlignment: "center",
        verticalAlignment: "center",
        contentWidth: "narrow",
        image: {
          fit: "cover",
          position: "center",
          zoom: 1,
          focalPoint: { x: 0.5, y: 0.5 },
        },
        treatment: {
          overlay: 0,
          gradient: null,
          textScrim: null,
        },
        typography: {
          headingScale: "sm",
          headingWeight: 500,
          bodyScale: "sm",
          showSecondaryCta: false,
        },
        cta: {
          arrangement: "stack",
          alignment: "center",
          primaryEmphasis: "quiet",
        },
        mobile: { layout: "keep_overlay", minHeight: "short" },
        accents: { showAccentWash: false, showGrid: false },
      };
  }
}

function deepMergeComposition(
  base: HeroComposition,
  patch?: Partial<HeroComposition> | null,
): HeroComposition {
  if (!patch) return { ...base, patternId: base.patternId };
  return {
    ...base,
    ...patch,
    patternId: (patch.patternId as string | null | undefined) ?? base.patternId,
    version: HERO_COMPOSITION_VERSION,
    image: { ...base.image, ...(patch.image ?? {}) },
    treatment: {
      ...base.treatment,
      ...(patch.treatment ?? {}),
      gradient:
        patch.treatment && "gradient" in patch.treatment
          ? patch.treatment.gradient
          : base.treatment.gradient,
      textScrim:
        patch.treatment && "textScrim" in patch.treatment
          ? patch.treatment.textScrim
          : base.treatment.textScrim,
    },
    typography: { ...base.typography, ...(patch.typography ?? {}) },
    cta: { ...base.cta, ...(patch.cta ?? {}) },
    mobile: { ...base.mobile, ...(patch.mobile ?? {}) },
    accents: { ...base.accents, ...(patch.accents ?? {}) },
  };
}

export type HeroPatternStrategyContext = {
  patternIds?: string[] | null;
  agencyTones?: string[] | null;
  industry?: string | null;
};

/**
 * Adapt a preset to the live project (assets, CTA, copy length).
 */
export function adaptHeroPatternComposition(input: {
  patternId: ExecutableHeroPatternId;
  project: BusinessProject;
  patch?: Partial<HeroComposition> | null;
}): {
  composition: HeroComposition;
  patternId: ExecutableHeroPatternId;
  fallbackUsed: boolean;
  fallbackReason: string | null;
  blocked: boolean;
  blockReason: string | null;
} {
  let patternId = input.patternId;
  let fallbackUsed = false;
  let fallbackReason: string | null = null;
  const hasImage = hasUsableHeroImage(input.project);

  if (patternId === "hero.cinematic_full_width" && !hasImage) {
    patternId = "hero.coastal_service";
    fallbackUsed = true;
    fallbackReason =
      "Cinematic heroes need a strong photo, so I used a lighter coastal service composition instead.";
  }

  let composition = deepMergeComposition(
    heroPatternPreset(patternId),
    input.patch,
  );
  composition = {
    ...composition,
    patternId,
    treatment: {
      ...composition.treatment,
      overlay: snapOverlay(composition.treatment.overlay),
    },
  };

  if (!hasSecondaryCta(input.project)) {
    composition = {
      ...composition,
      typography: { ...composition.typography, showSecondaryCta: false },
    };
  }

  if (headlineLength(input.project) > 72 && composition.typography.headingScale === "xl") {
    composition = {
      ...composition,
      typography: { ...composition.typography, headingScale: "lg" },
    };
  }

  if (patternId === "hero.premium_minimal" && !hasImage) {
    composition = {
      ...composition,
      treatment: {
        overlay: 0,
        gradient: null,
        textScrim: null,
      },
      accents: { showAccentWash: false, showGrid: false },
    };
  }

  if (patternId === "hero.contractor_left") {
    composition = {
      ...composition,
      cta: {
        ...composition.cta,
        arrangement: "row",
        alignment: "left",
      },
      mobile: {
        layout: "stack_copy_first",
        minHeight: "medium",
      },
      typography: {
        ...composition.typography,
        showSecondaryCta: hasSecondaryCta(input.project),
      },
    };
  }

  return {
    composition,
    patternId,
    fallbackUsed,
    fallbackReason,
    blocked: false,
    blockReason: null,
  };
}

function compositionsStructurallyEqual(
  a: HeroComposition,
  b: HeroComposition,
): boolean {
  return (
    a.patternId === b.patternId &&
    a.layout === b.layout &&
    a.minHeight === b.minHeight &&
    a.contentAlignment === b.contentAlignment &&
    a.verticalAlignment === b.verticalAlignment &&
    a.contentWidth === b.contentWidth &&
    a.image.fit === b.image.fit &&
    a.image.position === b.image.position &&
    Math.abs(a.image.zoom - b.image.zoom) < 0.02 &&
    Math.abs(a.image.focalPoint.x - b.image.focalPoint.x) < 0.02 &&
    Math.abs(a.image.focalPoint.y - b.image.focalPoint.y) < 0.02 &&
    a.treatment.overlay === b.treatment.overlay &&
    JSON.stringify(a.treatment.gradient ?? null) ===
      JSON.stringify(b.treatment.gradient ?? null) &&
    JSON.stringify(a.treatment.textScrim ?? null) ===
      JSON.stringify(b.treatment.textScrim ?? null) &&
    a.typography.headingScale === b.typography.headingScale &&
    a.typography.showSecondaryCta === b.typography.showSecondaryCta &&
    a.cta.alignment === b.cta.alignment &&
    a.cta.primaryEmphasis === b.cta.primaryEmphasis &&
    a.mobile.layout === b.mobile.layout &&
    a.accents.showAccentWash === b.accents.showAccentWash &&
    a.accents.showGrid === b.accents.showGrid
  );
}

export function explainHeroPatternApplication(input: {
  patternId: ExecutableHeroPatternId;
  fallbackUsed?: boolean;
  fallbackReason?: string | null;
  alreadySatisfied?: boolean;
}): string {
  if (input.alreadySatisfied) {
    const labels: Record<ExecutableHeroPatternId, string> = {
      "hero.cinematic_full_width": "cinematic hero composition",
      "hero.coastal_service": "coastal service hero composition",
      "hero.contractor_left": "contractor-focused hero composition",
      "hero.premium_minimal": "premium minimal hero composition",
    };
    return `The ${labels[input.patternId]} is already active.`;
  }

  const lines: Record<ExecutableHeroPatternId, string> = {
    "hero.cinematic_full_width":
      "I rebuilt the hero as a cinematic, image-led composition with a taller frame and localized contrast behind the copy.",
    "hero.coastal_service":
      "I set an airy coastal service hero with lighter treatment, a warm first impression, and an inviting call to action.",
    "hero.contractor_left":
      "I shifted the hero to a contractor-focused layout with the offer and quote actions clearly grouped on the left.",
    "hero.premium_minimal":
      "I simplified the hero into a premium minimal composition with quieter spacing and one clear action.",
  };

  let text = lines[input.patternId];
  if (input.fallbackUsed && input.fallbackReason) {
    text = `${input.fallbackReason} ${text}`;
  }
  if (textExposesDesignPatternIds(text)) {
    text = text.replace(/\b(?:hero|trust|services|gallery|cta)\.[a-z0-9_]+\b/gi, "");
  }
  return text.trim();
}

/**
 * Resolve an explicit NL request to an executable pattern id.
 */
export function matchExplicitHeroPatternRequest(
  request: string,
): ExecutableHeroPatternId | null {
  const text = request.trim();
  if (!text) return null;

  if (
    /\b(cinematic(\s+full[- ]?width)?|full[- ]?bleed\s+hero|dramatic\s+hero)\b/i.test(
      text,
    ) &&
    /\b(hero|composition|layout|homepage|use|make|try|apply|want)\b/i.test(text)
  ) {
    return "hero.cinematic_full_width";
  }
  if (
    /\b(contractor([- ]style)?|trades?\s+hero|conversion\s+hero)\b/i.test(text) &&
    /\b(hero|composition|layout|style|use|make|try|apply|want)\b/i.test(text)
  ) {
    return "hero.contractor_left";
  }
  if (
    /\b(premium\s+minimal|minimal(\s+premium)?\s+hero|quiet\s+hero|minimalist\s+hero)\b/i.test(
      text,
    )
  ) {
    return "hero.premium_minimal";
  }
  if (
    /\b(coastal(\s+service)?\s+hero|coastal\s+service(\s+composition)?)\b/i.test(
      text,
    )
  ) {
    return "hero.coastal_service";
  }
  // Shorter aliases when clearly asking to change the hero
  if (
    /\b(use|make|apply|try|give\s+(me\s+)?|switch\s+to)\b.+\b(cinematic)\b/i.test(
      text,
    )
  ) {
    return "hero.cinematic_full_width";
  }
  if (
    /\b(use|make|apply|try|give\s+(me\s+)?|switch\s+to)\b.+\b(contractor)\b/i.test(
      text,
    )
  ) {
    return "hero.contractor_left";
  }
  if (
    /\b(use|make|apply|try|give\s+(me\s+)?|switch\s+to)\b.+\b(premium\s+minimal|minimal)\b.+\bhero\b/i.test(
      text,
    ) ||
    /\b(make\s+this\s+a\s+premium\s+minimal\s+hero)\b/i.test(text)
  ) {
    return "hero.premium_minimal";
  }
  if (
    /\b(use|make|apply|try|give\s+(me\s+)?|switch\s+to)\b.+\bcoastal\b/i.test(
      text,
    )
  ) {
    return "hero.coastal_service";
  }
  return null;
}

export function isHeroPatternRedesignRequest(request: string): boolean {
  const text = request.trim();
  return (
    /\b(redesign|rework)\b.+\bhero\b/i.test(text) ||
    /\bhero\b.+\b(redesign|rework)\b/i.test(text) ||
    /\b(professionally\s+improve|improve)\b.+\bhero\b/i.test(text) ||
    /\bmake\s+the\s+hero\s+(look\s+)?professional\b/i.test(text) ||
    /\bprofessional\s+hero\b/i.test(text)
  );
}

export function isHeroPatternApplicationRequest(request: string): boolean {
  return (
    matchExplicitHeroPatternRequest(request) !== null ||
    isHeroPatternRedesignRequest(request)
  );
}

function pickStrategyPattern(
  strategy?: HeroPatternStrategyContext | null,
): ExecutableHeroPatternId | null {
  const ids = strategy?.patternIds ?? [];
  for (const id of ids) {
    if (isExecutableHeroPatternId(id)) return id;
  }
  return null;
}

export function planHeroPatternApplication(input: {
  project: BusinessProject;
  patternId?: string | null;
  request?: string;
  strategyContext?: HeroPatternStrategyContext | null;
  compositionPatch?: Partial<HeroComposition> | null;
}): HeroPatternPlanResult {
  const requested =
    (input.patternId && isExecutableHeroPatternId(input.patternId)
      ? input.patternId
      : null) ||
    (input.request ? matchExplicitHeroPatternRequest(input.request) : null) ||
    (input.request && isHeroPatternRedesignRequest(input.request)
      ? pickStrategyPattern(input.strategyContext)
      : null);

  if (!requested) {
    return {
      operations: [],
      patternId: "hero.premium_minimal",
      requestedPatternId: "hero.premium_minimal",
      composition: heroPatternPreset("hero.premium_minimal"),
      explanation: "I need a clearer hero pattern to apply.",
      alreadySatisfied: false,
      fallbackUsed: false,
      fallbackReason: null,
      blocked: true,
      blockReason: "No executable hero pattern was selected.",
    };
  }

  const adapted = adaptHeroPatternComposition({
    patternId: requested,
    project: input.project,
    patch: input.compositionPatch,
  });

  const current = input.project.heroComposition;
  if (
    current?.patternId === adapted.patternId &&
    compositionsStructurallyEqual(current, adapted.composition)
  ) {
    return {
      operations: [],
      patternId: adapted.patternId,
      requestedPatternId: requested,
      composition: adapted.composition,
      explanation: explainHeroPatternApplication({
        patternId: adapted.patternId,
        alreadySatisfied: true,
      }),
      alreadySatisfied: true,
      fallbackUsed: adapted.fallbackUsed,
      fallbackReason: adapted.fallbackReason,
      blocked: false,
      blockReason: null,
    };
  }

  const explanation = explainHeroPatternApplication({
    patternId: adapted.patternId,
    fallbackUsed: adapted.fallbackUsed,
    fallbackReason: adapted.fallbackReason,
  });

  return {
    operations: [
      {
        operation: "applyHeroPattern",
        patternId: adapted.patternId,
        composition: adapted.composition,
      },
    ],
    patternId: adapted.patternId,
    requestedPatternId: requested,
    composition: adapted.composition,
    explanation,
    alreadySatisfied: false,
    fallbackUsed: adapted.fallbackUsed,
    fallbackReason: adapted.fallbackReason,
    blocked: false,
    blockReason: null,
  };
}

function brandChanged(before: BusinessProject, after: BusinessProject): boolean {
  return (
    before.primaryColor !== after.primaryColor ||
    before.secondaryColor !== after.secondaryColor ||
    before.accentColor !== after.accentColor ||
    before.backgroundColor !== after.backgroundColor ||
    before.headingFont !== after.headingFont ||
    before.bodyFont !== after.bodyFont ||
    before.buttonStyle !== after.buttonStyle ||
    before.siteWidth !== after.siteWidth ||
    before.templateId !== after.templateId
  );
}

function scopeViolations(
  before: BusinessProject,
  after: BusinessProject,
): string[] {
  const violations: string[] = [];
  const forbidden: Array<keyof BusinessProject> = [
    "primaryColor",
    "secondaryColor",
    "accentColor",
    "backgroundColor",
    "headingFont",
    "bodyFont",
    "buttonStyle",
    "siteWidth",
    "templateId",
    "galleryImageIds",
    "services",
    "contact",
    "seo",
    "sectionOrder",
  ];
  for (const key of forbidden) {
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
      violations.push(String(key));
    }
  }
  if (before.heroImageId !== after.heroImageId) {
    violations.push("heroImageId");
  }
  if (
    JSON.stringify(before.mediaLibrary.map((m) => m.id)) !==
    JSON.stringify(after.mediaLibrary.map((m) => m.id))
  ) {
    violations.push("mediaLibrary");
  }
  return violations;
}

function compositionMatchesPlan(
  after: BusinessProject,
  expected: HeroComposition,
): boolean {
  const stored = after.heroComposition;
  if (!stored) return false;
  if (stored.patternId !== expected.patternId) return false;
  if (stored.layout !== expected.layout) return false;
  if (stored.minHeight !== expected.minHeight) return false;
  if (stored.contentAlignment !== expected.contentAlignment) return false;
  if (stored.verticalAlignment !== expected.verticalAlignment) return false;
  if (stored.contentWidth !== expected.contentWidth) return false;
  if (stored.typography.headingScale !== expected.typography.headingScale) {
    return false;
  }
  if (stored.typography.showSecondaryCta !== expected.typography.showSecondaryCta) {
    return false;
  }
  if (stored.cta.alignment !== expected.cta.alignment) return false;
  if (stored.mobile.layout !== expected.mobile.layout) return false;
  if ((after.heroOverlay ?? 50) !== expected.treatment.overlay) return false;
  const pres = after.heroImagePresentation;
  if (!pres) return false;
  const actualFit = pres.fit === "full" ? "contain" : pres.fit;
  if (actualFit !== expected.image.fit) return false;
  return true;
}

/**
 * Verify a coordinated pattern application (not merely that a field exists).
 */
export function verifyHeroPatternApplication(input: {
  before: BusinessProject;
  after: BusinessProject;
  expected: HeroComposition;
  allowAlreadySatisfied?: boolean;
}): HeroPatternVerifyResult {
  const failures: string[] = [];
  const globalThemeChanged = brandChanged(input.before, input.after);
  const violations = scopeViolations(input.before, input.after);

  if (globalThemeChanged) {
    failures.push("global_theme_changed");
  }
  for (const v of violations) {
    if (v !== "heroImageId" || input.before.heroImageId !== input.after.heroImageId) {
      // heroImageId change is always a failure for pattern apply
    }
  }
  if (violations.length) {
    failures.push(`scope_violation:${violations.join(",")}`);
  }

  const patternId = input.after.heroComposition?.patternId;
  if (patternId !== input.expected.patternId) {
    failures.push("pattern_not_persisted");
  }

  if (!compositionMatchesPlan(input.after, input.expected)) {
    failures.push("composition_mismatch");
  }

  // Surface parity — resolved composition matches expected structural plan
  const fromProject = resolveHeroCompositionFromProject(input.after);
  const planResolved = buildHeroRenderPlan(fromProject).contract;
  const planExpected = buildHeroRenderPlan(input.expected).contract;
  if (
    planResolved.layout !== planExpected.layout ||
    planResolved.minHeight !== planExpected.minHeight ||
    planResolved.contentAlignment !== planExpected.contentAlignment ||
    planResolved.headingScale !== planExpected.headingScale ||
    planResolved.mobileLayout !== planExpected.mobileLayout
  ) {
    failures.push("surface_parity_mismatch");
  }
  if (planResolved.layout !== input.expected.layout) {
    failures.push("render_layout_mismatch");
  }

  // Image visibility: if pattern expects photo-led and we have an id, keep it
  if (
    input.expected.patternId === "hero.cinematic_full_width" ||
    input.expected.patternId === "hero.contractor_left" ||
    input.expected.patternId === "hero.coastal_service"
  ) {
    if (
      input.before.heroImageId &&
      input.after.heroImageId !== input.before.heroImageId
    ) {
      failures.push("hero_asset_changed");
    }
  }

  // CTA present
  if (!(input.after.primaryCta || "").trim()) {
    failures.push("cta_missing");
  }

  // Mobile fallback validity
  const mobile = input.after.heroComposition?.mobile;
  if (
    !mobile ||
    !["stack_copy_first", "stack_image_first", "keep_overlay"].includes(
      mobile.layout,
    )
  ) {
    failures.push("mobile_fallback_invalid");
  }

  // Template must not change
  if (input.before.templateId !== input.after.templateId) {
    failures.push("template_changed");
  }

  const alreadySatisfied =
    Boolean(input.allowAlreadySatisfied) &&
    input.before.heroComposition?.patternId === input.expected.patternId &&
    compositionsStructurallyEqual(
      input.before.heroComposition!,
      input.expected,
    );

  return {
    verified: alreadySatisfied ? true : failures.length === 0,
    failures: alreadySatisfied ? [] : failures,
    alreadySatisfied,
    globalThemeChanged,
    scopeViolations: violations,
  };
}

/** Map composition → legacy mirrored fields for CSS / Brand Studio. */
export function mirrorHeroCompositionToLegacyFields(
  project: BusinessProject,
  composition: HeroComposition,
): BusinessProject {
  const overlay = snapOverlay(composition.treatment.overlay) as HeroOverlayStep;
  const textPosition =
    composition.contentAlignment === "right"
      ? "right"
      : composition.contentAlignment === "center"
        ? "center"
        : "left";

  return {
    ...project,
    heroComposition: { ...composition, version: HERO_COMPOSITION_VERSION },
    heroOverlay: overlay,
    heroTreatment: {
      overlayOpacity: overlay,
      gradient: composition.treatment.gradient ?? undefined,
      textScrim: composition.treatment.textScrim ?? undefined,
      textPosition,
    },
    heroImagePresentation: {
      fit: composition.image.fit,
      focalPoint: { ...composition.image.focalPoint },
      zoom: composition.image.zoom,
      position: composition.image.position,
    },
  };
}

/** Ensure template lookup stays available for callers. */
export function heroLayoutForProject(project: BusinessProject) {
  return getTemplate(project.templateId).heroLayout;
}
