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
import {
  adaptHeroPatternComposition,
  mirrorHeroCompositionToLegacyFields,
} from "@/lib/ai/hero-pattern-application";
import { HERO_COMPOSITION_VERSION } from "@/lib/hero-composition";
import { applySectionMove } from "@/lib/ai/section-order";
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
    case "setCreativePolish": {
      if (op.motionPreset === "none" || op.motion === false) {
        return { id, label: "Animations disabled", ok: true };
      }
      if (
        op.motion === true ||
        op.motionPreset === "subtle" ||
        op.motionPreset === "polished" ||
        op.sectionReveal === true
      ) {
        return { id, label: "Motion updated", ok: true };
      }
      if (op.serviceIcons !== undefined) {
        return { id, label: "Service icons updated", ok: true };
      }
      if (op.spacing !== undefined) {
        return { id, label: "Whitespace adjusted", ok: true };
      }
      if (op.visualHierarchy !== undefined) {
        return { id, label: "Visual hierarchy updated", ok: true };
      }
      if (op.contactFormEnabled) {
        return { id, label: "Contact form enabled", ok: true };
      }
      return { id, label: "Creative polish updated", ok: true };
    }
    case "moveSection": {
      const label =
        op.position === "last"
          ? `${op.section} moved to bottom`
          : op.position === "first"
            ? `${op.section} moved to top`
            : op.relativeTo
              ? `${op.section} moved ${op.position} ${op.relativeTo}`
              : `${op.section} reordered`;
      return { id, label, ok: true };
    }
    case "setHeroOverlay":
      return { id, label: "Hero overlay updated", ok: true };
    case "setHeroTreatment":
      return { id, label: "Hero contrast localized", ok: true };
    case "setHeroImagePresentation":
      return { id, label: "Hero image fit updated", ok: true };
    case "applyHeroPattern":
      return { id, label: "Hero pattern composition applied", ok: true };
    case "setGalleryInteraction":
      return {
        id,
        label:
          op.mode === "lightbox"
            ? "Gallery lightbox enabled"
            : "Gallery lightbox disabled",
        ok: true,
      };
    case "updateGalleryItemMetadata":
      return { id, label: "Gallery photo details updated", ok: true };
    case "setComponentSurface": {
      const label =
        op.target === "form_fields"
          ? "Form field styling updated"
          : op.target === "text_panels"
            ? "Text panel styling updated"
            : "Card styling updated";
      return { id, label, ok: true };
    }
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
      case "setCreativePolish": {
        const polish = { ...(next.creativePolish ?? {}) };
        if (op.serviceIcons !== undefined) polish.serviceIcons = op.serviceIcons;
        if (op.motionPreset !== undefined) {
          polish.motionPreset = op.motionPreset;
          polish.motion = op.motionPreset !== "none";
        }
        if (op.motion !== undefined) {
          polish.motion = op.motion;
          if (op.motionPreset === undefined) {
            polish.motionPreset = op.motion ? "subtle" : "none";
          }
        }
        if (op.sectionReveal !== undefined) {
          polish.sectionReveal = op.sectionReveal;
        } else if (op.motionPreset !== undefined || op.motion !== undefined) {
          polish.sectionReveal = Boolean(
            polish.motionPreset !== "none" && polish.motion,
          );
        }
        if (op.hoverEffects !== undefined) {
          polish.hoverEffects = op.hoverEffects;
        } else if (op.motionPreset !== undefined || op.motion !== undefined) {
          polish.hoverEffects = Boolean(
            polish.motionPreset !== "none" && polish.motion,
          );
        }
        polish.respectReducedMotion =
          op.respectReducedMotion !== undefined
            ? op.respectReducedMotion
            : true;
        if (op.visualHierarchy !== undefined) {
          polish.visualHierarchy = op.visualHierarchy;
        }
        if (op.spacing !== undefined) polish.spacing = op.spacing;
        next = { ...next, creativePolish: polish };
        if (op.contactFormEnabled === true) {
          next = {
            ...next,
            contact: { ...next.contact, formEnabled: true },
          };
        }
        break;
      }
      case "moveSection": {
        const moved = applySectionMove(next, {
          section: op.section,
          position: op.position,
          relativeTo: op.relativeTo,
        });
        next = moved.project;
        break;
      }
      case "setHeroOverlay":
        next = { ...next, heroOverlay: op.value };
        break;
      case "setHeroTreatment": {
        const prev = { ...(next.heroTreatment ?? {}) };
        if (op.gradient === null) {
          delete prev.gradient;
        } else if (op.gradient) {
          prev.gradient = op.gradient;
        }
        if (op.textScrim === null) {
          delete prev.textScrim;
        } else if (op.textScrim) {
          prev.textScrim = op.textScrim;
        }
        if (op.textPosition) {
          prev.textPosition = op.textPosition;
        }
        prev.overlayOpacity = next.heroOverlay;
        next = { ...next, heroTreatment: prev };
        break;
      }
      case "setHeroImagePresentation": {
        const prev: NonNullable<BusinessProject["heroImagePresentation"]> = {
          fit: "cover",
          focalPoint: { x: 0.5, y: 0.5 },
          zoom: 1,
          position: "center",
          ...(next.heroImagePresentation ?? {}),
        };
        if (op.fit) prev.fit = op.fit;
        if (op.focalPoint) {
          prev.focalPoint = {
            x: Math.min(1, Math.max(0, op.focalPoint.x)),
            y: Math.min(1, Math.max(0, op.focalPoint.y)),
          };
        }
        if (typeof op.zoom === "number" && Number.isFinite(op.zoom)) {
          prev.zoom = Math.min(2, Math.max(1, op.zoom));
        }
        if (op.position) prev.position = op.position;
        next = { ...next, heroImagePresentation: prev };
        break;
      }
      case "applyHeroPattern": {
        const composition = op.composition
          ? {
              ...op.composition,
              patternId: op.patternId,
              version: HERO_COMPOSITION_VERSION,
            }
          : adaptHeroPatternComposition({
              patternId: op.patternId,
              project: next,
            }).composition;
        next = mirrorHeroCompositionToLegacyFields(next, composition);
        break;
      }
      case "setGalleryInteraction": {
        next = {
          ...next,
          galleryInteraction: {
            mode: op.mode,
            navigation: op.navigation !== false,
            // Explicit op may enable captions; omitted stays false (safe default).
            captions: op.captions === true,
          },
        };
        break;
      }
      case "updateGalleryItemMetadata": {
        let assetId = op.assetId;
        if (
          !assetId &&
          typeof op.galleryIndex === "number" &&
          op.galleryIndex >= 0
        ) {
          assetId = next.galleryImageIds[op.galleryIndex] || undefined;
        }
        if (!assetId) break;
        next = {
          ...next,
          mediaLibrary: next.mediaLibrary.map((asset) => {
            if (asset.id !== assetId) return asset;
            const title = op.hideTitle
              ? ""
              : op.title !== undefined
                ? op.title
                : asset.title;
            return {
              ...asset,
              title,
              ...(op.caption !== undefined
                ? { description: op.caption }
                : {}),
              ...(op.altText !== undefined ? { alt: op.altText } : {}),
            };
          }),
        };
        break;
      }
      case "setComponentSurface": {
        const key =
          op.target === "form_fields"
            ? "formFields"
            : op.target === "text_panels"
              ? "textPanels"
              : "cards";
        next = {
          ...next,
          componentSurfaces: {
            ...(next.componentSurfaces ?? {}),
            [key]: {
              ...(next.componentSurfaces?.[key] ?? {}),
              backgroundColor: op.backgroundColor,
              ...(op.textColor ? { textColor: op.textColor } : {}),
              ...(op.borderColor ? { borderColor: op.borderColor } : {}),
              ...(op.focusColor && key === "formFields"
                ? { focusColor: op.focusColor }
                : {}),
            },
          },
        };
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
