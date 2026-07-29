/**
 * Apply validated edit operations onto a BusinessProject (immutable).
 */

import type { BusinessProject } from "@/types/business-project";
import type {
  EditChangeSummary,
  EditOperation,
  InsertableSectionType,
  ProjectDesignSections,
} from "@/lib/ai/edit-operations";
import type {
  GeneratedFaqItem,
  GeneratedOptionalSections,
} from "@/lib/ai/types";
import {
  createDefaultFaqItems,
  createDefaultTestimonials,
} from "@/lib/ai/design-sections-canonical";
import { findFaqIndexByQuestion } from "@/lib/ai/content-edit-planner";
import { defaultProjectSeo } from "@/lib/seo/defaults";

const BLUE_TOKENS = ["blue", "#2563eb", "#3b82f6", "#1d4ed8", "#60a5fa", "#1e40af"];

function emptyDesignSections(): ProjectDesignSections {
  return { enabled: [] };
}

function ensureDesignSections(
  project: BusinessProject,
): ProjectDesignSections {
  return project.designSections
    ? {
        enabled: [...project.designSections.enabled],
        testimonials: project.designSections.testimonials
          ? [...project.designSections.testimonials]
          : undefined,
        faq: project.designSections.faq
          ? [...project.designSections.faq]
          : undefined,
        team: project.designSections.team
          ? [...project.designSections.team]
          : undefined,
        pricing: project.designSections.pricing
          ? [...project.designSections.pricing]
          : undefined,
        bookingCta: project.designSections.bookingCta
          ? { ...project.designSections.bookingCta }
          : undefined,
        newsletter: project.designSections.newsletter
          ? { ...project.designSections.newsletter }
          : undefined,
      }
    : emptyDesignSections();
}

function defaultSectionContent(
  type: InsertableSectionType,
  businessName: string,
): Partial<ProjectDesignSections> {
  switch (type) {
    case "testimonials":
      return {
        testimonials: createDefaultTestimonials(businessName),
      };
    case "faq":
      return {
        faq: createDefaultFaqItems(businessName) satisfies GeneratedFaqItem[],
      };
    case "team":
      return {
        team: [
          {
            name: "Morgan Hale",
            role: "Founder",
            bio: "Leads the team with a focus on quality and clear communication.",
          },
        ],
      };
    case "pricing":
      return {
        pricing: [
          {
            name: "Starter",
            price: "From $99",
            description: "Essential support for getting started.",
            features: ["Core service", "Email support"],
          },
          {
            name: "Professional",
            price: "Custom",
            description: "Full-service partnership for growing teams.",
            features: ["Priority scheduling", "Dedicated contact"],
          },
        ],
      };
    case "bookingCta":
      return {
        bookingCta: {
          title: "Ready to book?",
          body: `Choose a time that works and the ${businessName} team will confirm shortly.`,
          buttonText: "Book now",
        },
      };
    case "newsletter":
      return {
        newsletter: {
          title: "Stay in the loop",
          body: "Occasional updates — no spam, unsubscribe anytime.",
          buttonText: "Subscribe",
        },
      };
    case "gallery":
      return {};
    default: {
      const _exhaustive: never = type;
      return _exhaustive;
    }
  }
}

function applyReplaceText(
  project: BusinessProject,
  target: Extract<EditOperation, { operation: "replaceText" }>["target"],
  value: string,
): BusinessProject {
  switch (target) {
    case "hero.eyebrow":
      return { ...project, heroEyebrow: value };
    case "hero.title":
      return { ...project, heroHeadline: value };
    case "hero.subheadline":
      return { ...project, heroSubheadline: value };
    case "hero.primaryCta":
      return { ...project, primaryCta: value };
    case "hero.secondaryCta":
      return { ...project, secondaryCta: value };
    case "about.title":
      return { ...project, aboutTitle: value };
    case "about.body":
      return { ...project, description: value };
    case "contact.title":
      return { ...project, contact: { ...project.contact, title: value } };
    case "contact.description":
      return {
        ...project,
        contact: { ...project.contact, description: value },
      };
    case "contact.buttonText":
      return { ...project, contact: { ...project.contact, buttonText: value } };
    case "business.name":
      return { ...project, businessName: value };
    case "business.type":
      return {
        ...project,
        businessType: value as BusinessProject["businessType"],
      };
    case "business.description":
      return { ...project, description: value };
    default: {
      const _exhaustive: never = target;
      return _exhaustive;
    }
  }
}

function colorMatches(value: string, from: string): boolean {
  const v = value.toLowerCase();
  const f = from.toLowerCase();
  if (v === f) return true;
  if (f === "blue") {
    return BLUE_TOKENS.some((token) => v.includes(token.replace("#", "")) || v === token);
  }
  if (f.startsWith("#")) return v === f;
  return v.includes(f);
}

function summarizeOp(op: EditOperation, index: number): EditChangeSummary {
  const id = `${op.operation}-${index}`;
  switch (op.operation) {
    case "replaceText":
      if (op.target.startsWith("hero.")) {
        return { id, label: "Hero rewritten", ok: true };
      }
      if (op.target.startsWith("about.")) {
        return { id, label: "About section updated", ok: true };
      }
      if (op.target.startsWith("contact.")) {
        return { id, label: "Contact copy updated", ok: true };
      }
      return { id, label: "Copy updated", ok: true };
    case "changeTheme":
      return { id, label: "Colors updated", ok: true };
    case "setButtonStyle":
      return { id, label: "Buttons updated", ok: true };
    case "setTypography":
      return { id, label: "Typography changed", ok: true };
    case "setSiteWidth":
      return { id, label: "Whitespace adjusted", ok: true };
    case "setTemplate":
      return { id, label: "Layout refreshed", ok: true };
    case "insertSection":
      return {
        id,
        label:
          op.type === "faq"
            ? "FAQ added"
            : op.type === "testimonials"
              ? "Testimonials added"
              : `${op.type} section added`,
        ok: true,
      };
    case "removeSection":
      return { id, label: `${op.type} section removed`, ok: true };
    case "updateSeo":
      return { id, label: "SEO improved", ok: true };
    case "rewriteServices":
      return { id, label: "Services rewritten", ok: true };
    case "shortenNavigation":
      return { id, label: "Navigation shortened", ok: true };
    case "replaceColors":
      return { id, label: "Colors updated", ok: true };
    case "updateFaqAnswer":
      return { id, label: "FAQ answer updated", ok: true };
    case "updateFaqQuestion":
      return { id, label: "FAQ question updated", ok: true };
    case "insertFaq":
      return { id, label: "FAQ added", ok: true };
    case "deleteFaq":
      return { id, label: "FAQ item removed", ok: true };
    default: {
      const _exhaustive: never = op;
      return _exhaustive;
    }
  }
}

function dedupeSummaries(items: EditChangeSummary[]): EditChangeSummary[] {
  const seen = new Set<string>();
  const out: EditChangeSummary[] = [];
  for (const item of items) {
    if (seen.has(item.label)) continue;
    seen.add(item.label);
    out.push(item);
  }
  return out;
}

/**
 * Apply a validated operation list. Returns the updated project + change bullets.
 */
export function applyEditOperations(
  project: BusinessProject,
  operations: EditOperation[],
): { project: BusinessProject; changes: EditChangeSummary[] } {
  let next = { ...project };
  const summaries: EditChangeSummary[] = [];

  for (let i = 0; i < operations.length; i += 1) {
    const op = operations[i]!;
    summaries.push(summarizeOp(op, i));

    switch (op.operation) {
      case "replaceText":
        next = applyReplaceText(next, op.target, op.value);
        break;
      case "changeTheme":
        next = {
          ...next,
          ...(op.primary ? { primaryColor: op.primary } : {}),
          ...(op.secondary ? { secondaryColor: op.secondary } : {}),
          ...(op.accent ? { accentColor: op.accent } : {}),
          ...(op.background ? { backgroundColor: op.background } : {}),
          ...(op.theme ? { theme: op.theme } : {}),
        };
        break;
      case "setButtonStyle":
        next = { ...next, buttonStyle: op.value };
        break;
      case "setTypography":
        next = {
          ...next,
          ...(op.headingFont ? { headingFont: op.headingFont } : {}),
          ...(op.bodyFont ? { bodyFont: op.bodyFont } : {}),
        };
        break;
      case "setSiteWidth":
        next = { ...next, siteWidth: op.value };
        break;
      case "setTemplate":
        next = { ...next, templateId: op.value };
        break;
      case "insertSection": {
        const design = ensureDesignSections(next);
        if (!design.enabled.includes(op.type)) {
          design.enabled = [...design.enabled, op.type];
        }
        if (op.type !== "gallery") {
          const defaults = defaultSectionContent(op.type, next.businessName);
          const existing = (design as Record<string, unknown>)[op.type];
          const missingOrEmpty =
            existing == null ||
            (Array.isArray(existing) && existing.length === 0);
          if (op.content !== undefined) {
            (design as Record<string, unknown>)[op.type] = op.content;
          } else if (missingOrEmpty) {
            Object.assign(design, defaults);
          }
        }
        next = { ...next, designSections: design };
        break;
      }
      case "removeSection": {
        const design = ensureDesignSections(next);
        design.enabled = design.enabled.filter((id) => id !== op.type);
        if (op.type !== "gallery") {
          delete (design as Record<string, unknown>)[op.type];
        }
        next = {
          ...next,
          designSections: design.enabled.length ? design : undefined,
        };
        break;
      }
      case "updateSeo": {
        const base = next.seo ?? defaultProjectSeo(next);
        next = {
          ...next,
          seo: {
            ...base,
            ...(op.siteTitle ? { siteTitle: op.siteTitle } : {}),
            ...(op.metaDescription
              ? { metaDescription: op.metaDescription }
              : {}),
            ...(op.socialTitle ? { socialTitle: op.socialTitle } : {}),
            ...(op.socialDescription
              ? { socialDescription: op.socialDescription }
              : {}),
            ...(op.robotsIndex !== undefined
              ? { robotsIndex: op.robotsIndex }
              : {}),
          },
        };
        break;
      }
      case "rewriteServices":
        next = { ...next, services: op.services.map((s) => ({ ...s })) };
        break;
      case "shortenNavigation": {
        const max = op.maxLabelLength ?? 12;
        next = {
          ...next,
          pages: next.pages.map((page) => ({
            ...page,
            title:
              page.title.length > max
                ? `${page.title.slice(0, Math.max(1, max - 1)).trimEnd()}…`
                : page.title,
          })),
        };
        break;
      }
      case "replaceColors": {
        const patch: Partial<BusinessProject> = {};
        if (colorMatches(next.primaryColor, op.from)) {
          patch.primaryColor = op.to;
        }
        if (colorMatches(next.secondaryColor, op.from)) {
          patch.secondaryColor = op.to;
        }
        if (colorMatches(next.accentColor, op.from)) {
          patch.accentColor = op.to;
        }
        if (colorMatches(next.backgroundColor, op.from)) {
          patch.backgroundColor = op.to;
        }
        // If named color family didn't match hexes, still tint brand accents.
        if (
          op.from === "blue" &&
          !patch.primaryColor &&
          !patch.accentColor
        ) {
          patch.primaryColor = op.to;
          patch.accentColor = op.to;
        }
        next = { ...next, ...patch };
        break;
      }
      case "insertFaq": {
        const design = ensureDesignSections(next);
        if (!design.enabled.includes("faq")) {
          design.enabled = [...design.enabled, "faq"];
        }
        design.faq =
          op.items && op.items.length > 0
            ? op.items.map((item) => ({ ...item }))
            : createDefaultFaqItems(next.businessName);
        next = { ...next, designSections: design };
        break;
      }
      case "updateFaqAnswer": {
        const design = ensureDesignSections(next);
        if (!design.enabled.includes("faq")) {
          design.enabled = [...design.enabled, "faq"];
        }
        if (!design.faq?.length) {
          design.faq = createDefaultFaqItems(next.businessName);
        }
        const faqs = [...(design.faq ?? [])];
        let idx =
          op.matchQuestion != null
            ? findFaqIndexByQuestion(
                { ...next, designSections: { ...design, faq: faqs } },
                op.matchQuestion,
              )
            : -1;
        if (idx < 0 && op.index !== undefined) idx = op.index;
        if (idx < 0 || idx >= faqs.length) {
          // Append when the referenced question is missing after seed.
          faqs.push({
            question: op.matchQuestion?.trim() || "Question",
            answer: op.answer,
          });
        } else {
          faqs[idx] = { ...faqs[idx]!, answer: op.answer };
        }
        design.faq = faqs;
        next = { ...next, designSections: design };
        break;
      }
      case "updateFaqQuestion": {
        const design = ensureDesignSections(next);
        if (!design.enabled.includes("faq")) {
          design.enabled = [...design.enabled, "faq"];
        }
        if (!design.faq?.length) {
          design.faq = createDefaultFaqItems(next.businessName);
        }
        const faqs = [...(design.faq ?? [])];
        let idx =
          op.matchQuestion != null
            ? findFaqIndexByQuestion(
                { ...next, designSections: { ...design, faq: faqs } },
                op.matchQuestion,
              )
            : -1;
        if (idx < 0 && op.index !== undefined) idx = op.index;
        if (idx >= 0 && idx < faqs.length) {
          faqs[idx] = { ...faqs[idx]!, question: op.question };
          design.faq = faqs;
          next = { ...next, designSections: design };
        }
        break;
      }
      case "deleteFaq": {
        const design = ensureDesignSections(next);
        const faqs = [...(design.faq ?? [])];
        let idx =
          op.matchQuestion != null
            ? findFaqIndexByQuestion(
                { ...next, designSections: { ...design, faq: faqs } },
                op.matchQuestion,
              )
            : -1;
        if (idx < 0 && op.index !== undefined) idx = op.index;
        if (idx >= 0 && idx < faqs.length) {
          faqs.splice(idx, 1);
          design.faq = faqs;
          if (faqs.length === 0) {
            design.enabled = design.enabled.filter((id) => id !== "faq");
            delete design.faq;
          }
          next = {
            ...next,
            designSections: design.enabled.length ? design : undefined,
          };
        }
        break;
      }
      default: {
        const _exhaustive: never = op;
        return _exhaustive;
      }
    }
  }

  return { project: next, changes: dedupeSummaries(summaries) };
}

/** Merge AI-generated optional section content into designSections storage. */
export function mergeOptionalContentIntoDesignSections(
  enabled: InsertableSectionType[],
  content: GeneratedOptionalSections,
): ProjectDesignSections {
  return {
    enabled: [...enabled],
    ...(content.testimonials ? { testimonials: content.testimonials } : {}),
    ...(content.faq ? { faq: content.faq } : {}),
    ...(content.team ? { team: content.team } : {}),
    ...(content.pricing ? { pricing: content.pricing } : {}),
    ...(content.bookingCta ? { bookingCta: content.bookingCta } : {}),
    ...(content.newsletter ? { newsletter: content.newsletter } : {}),
  };
}
