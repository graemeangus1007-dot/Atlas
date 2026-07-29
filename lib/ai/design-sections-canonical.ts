/**
 * Canonical design-section shapes shared by edit ops, project types, and all renderers.
 */

import type {
  InsertableSectionType,
  ProjectDesignSections,
} from "@/lib/ai/edit-operations";
import type { GeneratedFaqItem, GeneratedTestimonial } from "@/lib/ai/types";
import type { BusinessProject } from "@/types/business-project";
import type { GeneratedWebsiteContent } from "@/types/website-content";

/** Canonical FAQ item — question + answer only. */
export type CanonicalFaqItem = GeneratedFaqItem;

export function createDefaultFaqItems(businessName: string): CanonicalFaqItem[] {
  const name = businessName.trim() || "our team";
  return [
    {
      question: `How do I get started with ${name}?`,
      answer:
        "Share a few details about your goals and we will recommend the right next step — usually within one business day.",
    },
    {
      question: "What areas do you serve?",
      answer:
        "We work with customers in our primary service area and can discuss nearby regions on request.",
    },
    {
      question: "Do you offer consultations?",
      answer:
        "Yes — most new customers begin with a short consult so we can understand your needs.",
    },
  ];
}

export function createDefaultTestimonials(
  businessName: string,
): GeneratedTestimonial[] {
  const name = businessName.trim() || "This business";
  return [
    {
      quote: `${name} exceeded our expectations from the first visit.`,
      author: "Alex R.",
      role: "Customer",
    },
    {
      quote: "Clear communication, quality work, and a team that cares.",
      author: "Jordan M.",
      role: "Local business owner",
    },
  ];
}

function isNonEmptyFaq(items: unknown): items is CanonicalFaqItem[] {
  return (
    Array.isArray(items) &&
    items.length > 0 &&
    items.every(
      (item) =>
        item &&
        typeof item === "object" &&
        typeof (item as CanonicalFaqItem).question === "string" &&
        (item as CanonicalFaqItem).question.trim().length > 0 &&
        typeof (item as CanonicalFaqItem).answer === "string" &&
        (item as CanonicalFaqItem).answer.trim().length > 0,
    )
  );
}

/**
 * True when a design section would actually render in editor / preview / publish.
 */
export function isDesignSectionVisibleInProject(
  project: BusinessProject,
  type: InsertableSectionType,
): boolean {
  const sections = project.designSections;
  if (!sections?.enabled.includes(type)) return false;

  switch (type) {
    case "faq":
      return isNonEmptyFaq(sections.faq);
    case "testimonials":
      return (sections.testimonials?.length ?? 0) > 0;
    case "team":
      return (sections.team?.length ?? 0) > 0;
    case "pricing":
      return (sections.pricing?.length ?? 0) > 0;
    case "bookingCta":
      return Boolean(sections.bookingCta?.title && sections.bookingCta?.buttonText);
    case "newsletter":
      return Boolean(sections.newsletter?.title && sections.newsletter?.buttonText);
    case "gallery":
      return true;
    default:
      return false;
  }
}

/** Same visibility rules against generated website content (renderer input). */
export function isDesignSectionVisibleInContent(
  content: GeneratedWebsiteContent,
  type: InsertableSectionType,
): boolean {
  const sections = content.designSections;
  if (!sections?.enabled.includes(type)) return false;
  if (type === "faq") return isNonEmptyFaq(sections.faq);
  if (type === "testimonials") return (sections.testimonials?.length ?? 0) > 0;
  if (type === "team") return (sections.team?.length ?? 0) > 0;
  if (type === "pricing") return (sections.pricing?.length ?? 0) > 0;
  if (type === "bookingCta") {
    return Boolean(sections.bookingCta?.title && sections.bookingCta?.buttonText);
  }
  if (type === "newsletter") {
    return Boolean(sections.newsletter?.title && sections.newsletter?.buttonText);
  }
  if (type === "gallery") return true;
  return false;
}

/**
 * Post-apply assertion: every insertSection in the batch must be visibly present.
 */
export function assertInsertedSectionsVisible(
  project: BusinessProject,
  operations: Array<{ operation: string; type?: string }>,
): { ok: true } | { ok: false; missing: InsertableSectionType[] } {
  const missing: InsertableSectionType[] = [];
  for (const op of operations) {
    if (op.operation !== "insertSection" || !op.type) continue;
    const type = op.type as InsertableSectionType;
    if (!isDesignSectionVisibleInProject(project, type)) {
      missing.push(type);
    }
  }
  if (missing.length > 0) return { ok: false, missing };
  return { ok: true };
}

export function normalizeDesignSectionsFaq(
  sections: ProjectDesignSections | undefined,
  businessName: string,
): ProjectDesignSections | undefined {
  if (!sections) return sections;
  if (!sections.enabled.includes("faq")) return sections;
  if (isNonEmptyFaq(sections.faq)) return sections;
  return {
    ...sections,
    faq: createDefaultFaqItems(businessName),
  };
}
