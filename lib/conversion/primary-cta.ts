/**
 * Conversion Director Phase 2 — narrow primary CTA refinement only.
 * Assessment + plan; does not mutate BusinessProject directly.
 */

import type { EditOperation } from "@/lib/ai/edit-operations";
import { scoreCtaStrength } from "@/lib/conversion/cta";
import { collectConversionSignals } from "@/lib/conversion/evaluation";
import type { BusinessProject } from "@/types/business-project";

export type PrimaryCTAAssessment = {
  currentLabel: string;
  destination: string | null;
  clarity: number;
  specificity: number;
  intentMatch: number;
  friction: number;
  prominence: number;
  visitorIntent: string | null;
  recommendedAction: string | null;
  recommendedDestination: string | null;
  canRefineSafely: boolean;
  blockedReason?: string;
  alreadySatisfied: boolean;
};

export type RefinePrimaryCTAPlan = {
  kind: "refinePrimaryCTA";
  label: string;
  destination: string | null;
  target: "hero.primaryCta";
  reason: string;
  operations: EditOperation[];
};

export type CtaDestinationCapability = {
  id: string;
  href: string;
  label: string;
};

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function normalizeLabel(label: string): string {
  return label.trim().replace(/\s+/g, " ");
}

function isGenericCta(label: string): boolean {
  const t = normalizeLabel(label).toLowerCase();
  return (
    !t ||
    /^(learn more|click here|submit|ok|get started|contact us|read more|see more)$/i.test(
      t,
    ) ||
    t.length < 4
  );
}

function isStrongQuoteCta(label: string): boolean {
  return /^(get a quote|request a quote|get a free estimate|request an estimate)$/i.test(
    normalizeLabel(label),
  );
}

function isStrongConsultCta(label: string): boolean {
  return /^(schedule a consultation|book a consultation|request a consultation)$/i.test(
    normalizeLabel(label),
  );
}

/** Destinations that actually exist on the current project — never fabricate. */
export function listCtaDestinationCapabilities(
  project: BusinessProject,
): CtaDestinationCapability[] {
  const caps: CtaDestinationCapability[] = [];
  const contact = project.contact;
  const hasContact =
    Boolean(contact?.phone?.trim()) ||
    Boolean(contact?.email?.trim()) ||
    contact?.formEnabled !== false;
  if (hasContact) {
    caps.push({ id: "contact", href: "#contact", label: "contact" });
  }

  if ((project.services ?? []).length > 0) {
    caps.push({ id: "services", href: "#services", label: "services" });
  }

  const pages = project.pages ?? [];
  const menuPage = pages.find((p) =>
    /menu/i.test(`${p.title ?? ""} ${p.slug ?? ""}`),
  );
  if (menuPage) {
    const slug = menuPage.slug?.startsWith("/")
      ? menuPage.slug
      : `/${menuPage.slug || "menu"}`;
    caps.push({ id: "menu", href: slug, label: "menu" });
  } else if (
    /coffee|bakery|restaurant|cafe|dining/i.test(project.businessType || "") &&
    (project.services ?? []).length >= 2
  ) {
    // Real on-page services content can host a menu-oriented action.
    caps.push({ id: "menu", href: "#services", label: "menu" });
  }

  if ((project.galleryImageIds ?? []).filter(Boolean).length > 0) {
    caps.push({ id: "gallery", href: "#gallery", label: "gallery" });
  }

  const aboutPresent =
    Boolean(project.description?.trim()) ||
    pages.some((p) => /about/i.test(`${p.title ?? ""} ${p.slug ?? ""}`));
  if (aboutPresent) {
    caps.push({ id: "about", href: "#about", label: "about" });
  }

  const hasBooking = Boolean(project.designSections?.bookingCta);
  if (hasBooking) {
    caps.push({ id: "booking", href: "#booking", label: "booking" });
  }

  return caps;
}

function industryHaystack(project: BusinessProject): string {
  return [
    project.businessType,
    project.businessName,
    project.description,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function industryVisitorIntent(project: BusinessProject): string {
  const type = industryHaystack(project);
  if (/law|attorney|legal|counsel/.test(type)) return "speak with counsel";
  if (/dental|dentist|clinic|medical/.test(type)) return "book care";
  if (/coffee|bakery|restaurant|cafe|dining/.test(type)) {
    return "explore the menu or visit";
  }
  if (/gym|fitness/.test(type)) return "start training";
  if (/plumb|electric|roof|landscap|builder|contractor/.test(type)) {
    return "request a quote";
  }
  if (/salon|spa/.test(type)) return "book an appointment";
  return "get in touch";
}

function proposeRefinement(input: {
  project: BusinessProject;
  capabilities: CtaDestinationCapability[];
}): {
  label: string | null;
  destination: string | null;
  blockedReason?: string;
} {
  const { project, capabilities } = input;
  const type = industryHaystack(project);
  const name = project.businessName?.trim() || "us";
  const has = (id: string) => capabilities.some((c) => c.id === id);
  const href = (id: string) =>
    capabilities.find((c) => c.id === id)?.href ?? null;

  if (/law|attorney|legal|counsel/.test(type)) {
    if (has("contact")) {
      return {
        label: "Schedule a Consultation",
        destination: href("contact"),
      };
    }
    return {
      label: null,
      destination: null,
      blockedReason:
        "The strongest next step would be “Schedule a Consultation,” but there isn’t a contact path I can safely link it to.",
    };
  }

  if (/plumb|electric|roof|landscap|builder|contractor/.test(type)) {
    if (has("contact")) {
      return { label: "Get a Quote", destination: href("contact") };
    }
    return {
      label: null,
      destination: null,
      blockedReason:
        "The strongest next step would be “Get a Quote,” but there isn’t a contact path I can safely link it to.",
    };
  }

  if (/coffee|bakery|restaurant|cafe|dining/.test(type)) {
    if (has("menu")) {
      return {
        label: /bakery|coffee|cafe/.test(type) ? "View Our Menu" : "See the Menu",
        destination: href("menu"),
      };
    }
    if (has("contact")) {
      return {
        label: `Visit ${name}`,
        destination: href("contact"),
      };
    }
    return {
      label: null,
      destination: null,
      blockedReason:
        "The strongest next step would be “View Our Menu,” but there isn’t currently a menu destination I can safely link it to. Add the menu and I can complete that conversion path.",
    };
  }

  if (/dental|dentist|clinic|medical|salon|spa/.test(type)) {
    if (has("booking") || has("contact")) {
      return {
        label: "Book an Appointment",
        destination: href("booking") ?? href("contact"),
      };
    }
    return {
      label: null,
      destination: null,
      blockedReason:
        "The strongest next step would be booking, but there isn’t a booking or contact path I can safely link it to.",
    };
  }

  if (has("contact")) {
    return { label: "Get in Touch", destination: href("contact") };
  }
  return {
    label: null,
    destination: null,
    blockedReason:
      "I need a real contact or destination on the site before I can refine the primary action safely.",
  };
}

export function assessPrimaryCTA(input: {
  project: BusinessProject;
}): PrimaryCTAAssessment {
  const project = input.project;
  const currentLabel = normalizeLabel(project.primaryCta || "");
  const capabilities = listCtaDestinationCapabilities(project);
  const signals = collectConversionSignals({ project });
  const base = scoreCtaStrength(signals);
  const visitorIntent = industryVisitorIntent(project);
  const primaryDestination =
    capabilities.find((c) => c.id === "contact")?.href ??
    capabilities[0]?.href ??
    null;

  const generic = isGenericCta(currentLabel);
  const specificity = generic
    ? 28
    : currentLabel.length >= 8 && currentLabel.length <= 28
      ? 82
      : 64;
  const clarity = clamp(base.score);
  const type = industryHaystack(project);

  let intentMatch = 55;
  if (/landscap|contractor|builder/.test(type) && isStrongQuoteCta(currentLabel)) {
    intentMatch = 92;
  } else if (/law|attorney|legal|counsel/.test(type) && isStrongConsultCta(currentLabel)) {
    intentMatch = 90;
  } else if (
    /coffee|bakery|restaurant|cafe/.test(type) &&
    /menu|visit|order|reserve/i.test(currentLabel)
  ) {
    intentMatch = 78;
  } else if (!generic) {
    intentMatch = 70;
  }

  const friction = generic ? 42 : 72;
  const prominence = currentLabel ? 75 : 30;

  const proposal = proposeRefinement({ project, capabilities });
  const alreadySatisfied =
    !generic &&
    ((/landscap|contractor|builder/.test(type) &&
      isStrongQuoteCta(currentLabel)) ||
      (/law|attorney|legal|counsel/.test(type) &&
        isStrongConsultCta(currentLabel)) ||
      (clarity >= 72 && intentMatch >= 75 && specificity >= 70));

  if (alreadySatisfied) {
    return {
      currentLabel,
      destination: primaryDestination,
      clarity,
      specificity,
      intentMatch,
      friction,
      prominence,
      visitorIntent,
      recommendedAction: currentLabel,
      recommendedDestination: primaryDestination,
      canRefineSafely: false,
      alreadySatisfied: true,
      blockedReason: undefined,
    };
  }

  if (!proposal.label || !proposal.destination) {
    return {
      currentLabel,
      destination: primaryDestination,
      clarity,
      specificity,
      intentMatch,
      friction,
      prominence,
      visitorIntent,
      recommendedAction: proposal.label,
      recommendedDestination: null,
      canRefineSafely: false,
      alreadySatisfied: false,
      blockedReason: proposal.blockedReason,
    };
  }

  const sameLabel =
    proposal.label.toLowerCase() === currentLabel.toLowerCase();
  if (sameLabel) {
    return {
      currentLabel,
      destination: proposal.destination,
      clarity,
      specificity,
      intentMatch,
      friction,
      prominence,
      visitorIntent,
      recommendedAction: proposal.label,
      recommendedDestination: proposal.destination,
      canRefineSafely: false,
      alreadySatisfied: true,
    };
  }

  return {
    currentLabel,
    destination: primaryDestination,
    clarity,
    specificity,
    intentMatch,
    friction,
    prominence,
    visitorIntent,
    recommendedAction: proposal.label,
    recommendedDestination: proposal.destination,
    canRefineSafely: true,
    alreadySatisfied: false,
  };
}

export function planPrimaryCtaRefinement(input: {
  project: BusinessProject;
}): {
  assessment: PrimaryCTAAssessment;
  plan: RefinePrimaryCTAPlan | null;
  disposition:
    | "applyable"
    | "already_satisfied"
    | "blocked_missing_input"
    | "blocked_unsupported";
} {
  const assessment = assessPrimaryCTA(input);
  if (assessment.alreadySatisfied) {
    return {
      assessment,
      plan: null,
      disposition: "already_satisfied",
    };
  }
  if (!assessment.canRefineSafely || !assessment.recommendedAction) {
    return {
      assessment,
      plan: null,
      disposition: "blocked_missing_input",
    };
  }

  const reason = `I changed the primary action from “${assessment.currentLabel || "a generic label"}” to “${assessment.recommendedAction}” because it better matches how visitors decide. The destination and rest of the page stayed unchanged.`;

  const plan: RefinePrimaryCTAPlan = {
    kind: "refinePrimaryCTA",
    label: assessment.recommendedAction,
    destination: assessment.recommendedDestination,
    target: "hero.primaryCta",
    reason,
    operations: [
      {
        operation: "replaceText",
        target: "hero.primaryCta",
        value: assessment.recommendedAction,
      },
    ],
  };

  return { assessment, plan, disposition: "applyable" };
}

/** Verification after applying a CTA refinement. */
export function verifyPrimaryCtaRefinement(input: {
  before: BusinessProject;
  after: BusinessProject;
  plannedLabel: string;
}): {
  verified: boolean;
  clarityBefore: number;
  clarityAfter: number;
  reasons: string[];
  unrelatedMutationDomains: string[];
} {
  const beforeA = assessPrimaryCTA({ project: input.before });
  const afterA = assessPrimaryCTA({ project: input.after });
  const reasons: string[] = [];
  const unrelated: string[] = [];

  if (normalizeLabel(input.after.primaryCta) !== normalizeLabel(input.plannedLabel)) {
    reasons.push("CTA label did not match the planned refinement.");
  }
  if (afterA.clarity <= beforeA.clarity) {
    reasons.push("CTA clarity did not improve.");
  }
  if (
    input.before.primaryColor !== input.after.primaryColor ||
    input.before.accentColor !== input.after.accentColor ||
    input.before.secondaryColor !== input.after.secondaryColor
  ) {
    unrelated.push("brand_colors");
    reasons.push("Brand colors changed.");
  }
  if (
    input.before.headingFont !== input.after.headingFont ||
    input.before.bodyFont !== input.after.bodyFont
  ) {
    unrelated.push("typography");
    reasons.push("Typography changed.");
  }
  if (input.before.heroImageId !== input.after.heroImageId) {
    unrelated.push("hero_image");
    reasons.push("Hero image changed.");
  }
  if (
    JSON.stringify(input.before.galleryImageIds) !==
    JSON.stringify(input.after.galleryImageIds)
  ) {
    unrelated.push("gallery");
    reasons.push("Gallery changed.");
  }
  if (input.before.heroHeadline !== input.after.heroHeadline) {
    unrelated.push("copy");
    reasons.push("Hero headline changed.");
  }
  if (
    JSON.stringify(input.before.creativePolish?.motion) !==
    JSON.stringify(input.after.creativePolish?.motion)
  ) {
    unrelated.push("motion");
    reasons.push("Motion changed.");
  }

  const verified =
    reasons.length === 0 &&
    afterA.clarity > beforeA.clarity &&
    Boolean(input.after.primaryCta?.trim());

  return {
    verified,
    clarityBefore: beforeA.clarity,
    clarityAfter: afterA.clarity,
    reasons,
    unrelatedMutationDomains: unrelated,
  };
}

export function formatPrimaryCtaExecutionCopy(input: {
  beforeLabel: string;
  afterLabel: string;
}): string {
  const before = normalizeLabel(input.beforeLabel) || "a generic label";
  const after = normalizeLabel(input.afterLabel);
  return `I changed the primary action from “${before}” to “${after}” because it is a clearer next step for visitors. The destination and rest of the page stayed unchanged.`;
}

export function logPrimaryCtaDiagnostics(input: {
  before: PrimaryCTAAssessment;
  after?: PrimaryCTAAssessment | null;
  disposition: string;
  verified?: boolean;
  strategicPriorityBefore?: string | null;
  strategicPriorityAfter?: string | null;
  unrelatedMutationDomains?: string[];
  requestId?: string | null;
}): void {
  if (process.env.NODE_ENV !== "development") return;
  console.info("[atlas:conversion-director:primary-cta]", {
    requestId: input.requestId ?? null,
    ctaBefore: input.before.currentLabel,
    ctaAfter: input.after?.currentLabel ?? null,
    ctaDestinationBefore: input.before.destination,
    ctaDestinationAfter: input.after?.destination ?? null,
    ctaClarityBefore: input.before.clarity,
    ctaClarityAfter: input.after?.clarity ?? null,
    ctaExecutionDisposition: input.disposition,
    ctaBlockedReason: input.before.blockedReason ?? null,
    conversionPriorityBefore: input.strategicPriorityBefore ?? null,
    conversionPriorityAfter: input.strategicPriorityAfter ?? null,
    strategicPriorityBefore: input.strategicPriorityBefore ?? null,
    strategicPriorityAfter: input.strategicPriorityAfter ?? null,
    unrelatedMutationDomains: input.unrelatedMutationDomains ?? [],
    verified: input.verified ?? null,
  });
}
