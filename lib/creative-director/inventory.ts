/**
 * Build a deterministic homepage section inventory from project + strategy input.
 */

import type { DesignStrategyInput } from "@/lib/ai/design-strategy-types";
import type {
  PageSectionInventory,
  WebsiteSectionId,
} from "@/lib/creative-director/types";
import type { BusinessProject } from "@/types/business-project";

const DEFAULT_ORDER: WebsiteSectionId[] = [
  "hero",
  "about",
  "services",
  "gallery",
  "testimonials",
  "faq",
  "pricing",
  "cta",
  "contact",
  "footer",
];

function normalizeSectionId(raw: string): WebsiteSectionId | null {
  const s = raw.trim().toLowerCase();
  if (s === "home" || s === "hero") return "hero";
  if (s === "about") return "about";
  if (s === "services" || s === "service") return "services";
  if (s === "gallery" || s === "photos" || s === "portfolio") return "gallery";
  if (s === "testimonials" || s === "reviews" || s === "proof") {
    return "testimonials";
  }
  if (s === "faq" || s === "questions") return "faq";
  if (s === "pricing" || s === "prices") return "pricing";
  if (s === "cta" || s === "bookingcta" || s === "booking") return "cta";
  if (s === "contact") return "contact";
  if (s === "footer") return "footer";
  if (s === "team") return "team";
  if (s === "newsletter") return "newsletter";
  return null;
}

export function buildPageSectionInventory(input: {
  project?: BusinessProject | null;
  strategyInput?: DesignStrategyInput | null;
}): PageSectionInventory {
  const project = input.project;
  const strategy = input.strategyInput;

  const enabled = new Set<string>([
    ...(strategy?.enabledSections ?? []),
    "hero",
    "about",
    "services",
    "contact",
    "footer",
  ]);

  if (project?.designSections?.enabled) {
    for (const id of project.designSections.enabled) enabled.add(id);
  }

  const testimonialCount =
    project?.designSections?.testimonials?.length ??
    (strategy?.hasTestimonials ? 2 : 0);
  const faqCount =
    project?.designSections?.faq?.length ?? (strategy?.hasFaq ? 2 : 0);
  const hasPricing =
    Boolean(project?.designSections?.pricing?.length) ||
    enabled.has("pricing");
  const hasTeam =
    Boolean(project?.designSections?.team?.length) || enabled.has("team");
  const hasBookingCta =
    Boolean(project?.designSections?.bookingCta) ||
    enabled.has("bookingCta") ||
    enabled.has("cta");
  const hasNewsletter =
    Boolean(project?.designSections?.newsletter) || enabled.has("newsletter");

  const gallerySlots =
    strategy?.galleryFilledSlots ??
    (project?.galleryImageIds ?? []).filter(Boolean).length;

  if (testimonialCount > 0) enabled.add("testimonials");
  if (faqCount > 0) enabled.add("faq");
  if (gallerySlots > 0) enabled.add("gallery");
  if (hasPricing) enabled.add("pricing");
  if (hasTeam) enabled.add("team");
  if (hasBookingCta) enabled.add("cta");
  if (hasNewsletter) enabled.add("newsletter");

  const present = new Set<WebsiteSectionId>();
  for (const raw of enabled) {
    const id = normalizeSectionId(raw);
    if (id) present.add(id);
  }
  present.add("hero");
  present.add("services");
  present.add("contact");
  present.add("footer");

  const rawOrder =
    project?.sectionOrder?.length
      ? project.sectionOrder
      : strategy?.sectionOrder?.length
        ? strategy.sectionOrder
        : DEFAULT_ORDER;

  const order: WebsiteSectionId[] = [];
  const seen = new Set<WebsiteSectionId>();
  for (const raw of rawOrder) {
    const id = normalizeSectionId(String(raw));
    if (!id || seen.has(id) || !present.has(id)) continue;
    order.push(id);
    seen.add(id);
  }
  for (const id of DEFAULT_ORDER) {
    if (present.has(id) && !seen.has(id)) {
      order.push(id);
      seen.add(id);
    }
  }
  for (const id of present) {
    if (!seen.has(id)) order.push(id);
  }

  const aboutCopy =
    (project?.description?.trim().length ?? 0) > 40 ||
    (strategy?.businessDescription?.trim().length ?? 0) > 40;

  return {
    order,
    present,
    industry: strategy?.industry || project?.businessType || "Business",
    businessName: strategy?.businessName || project?.businessName || "Business",
    description:
      strategy?.businessDescription || project?.description || "",
    heroHeadline: strategy?.heroTitle || project?.heroHeadline || "",
    heroSubheadline:
      strategy?.heroDescription || project?.heroSubheadline || "",
    primaryCta: strategy?.primaryCta || project?.primaryCta || "",
    servicesCount: project?.services?.length ?? 3,
    gallerySlots,
    testimonialCount,
    faqCount,
    hasPricing,
    hasTeam,
    hasBookingCta,
    hasNewsletter,
    hasHeroImage:
      strategy?.hasHeroImage ?? Boolean(project?.heroImageId),
    hasAboutCopy: aboutCopy,
    contactPhone: project?.contact?.phone?.trim() || "",
    contactEmail: project?.contact?.email?.trim() || "",
    contactLocation: project?.contact?.location?.trim() || "",
    spacing: strategy?.spacing || project?.creativePolish?.spacing || "default",
    visualHierarchy:
      strategy?.visualHierarchy ??
      Boolean(project?.creativePolish?.visualHierarchy),
    buttonStyle: project?.buttonStyle || "rounded",
    headingFont: project?.headingFont || "inter",
    bodyFont: project?.bodyFont || "inter",
    designLanguage: strategy?.designLanguage || "",
    businessTone: strategy?.businessTone || "",
    completeness: strategy?.overallCompleteness ?? 50,
  };
}
