/**
 * Missing-capability detection for the Creative Director (Sprint 25.0A).
 */

import type {
  MissingCapability,
  MissingCapabilityId,
} from "@/lib/ai/creative-director-types";
import type { BusinessProject } from "@/types/business-project";
import { GALLERY_SLOT_COUNT } from "@/types/media";

function hasLogo(project: BusinessProject): boolean {
  return Boolean(
    (project.logoAssetId && project.logoAssetId.trim()) ||
      (project.logo && project.logo.trim()),
  );
}

function hasHeroImage(project: BusinessProject): boolean {
  return Boolean(project.heroImageId && project.heroImageId.trim());
}

function filledGalleryCount(project: BusinessProject): number {
  return project.galleryImageIds.filter((id) => Boolean(id?.trim())).length;
}

function hasTestimonials(project: BusinessProject): boolean {
  return Boolean(
    project.designSections?.enabled.includes("testimonials") &&
      project.designSections.testimonials?.length,
  );
}

function hasFaq(project: BusinessProject): boolean {
  return Boolean(
    project.designSections?.enabled.includes("faq") &&
      project.designSections.faq?.length,
  );
}

function hasTeam(project: BusinessProject): boolean {
  return Boolean(
    project.designSections?.enabled.includes("team") &&
      project.designSections.team?.length,
  );
}

function weakCta(project: BusinessProject): boolean {
  const cta = project.primaryCta.trim().toLowerCase();
  if (!cta) return true;
  return /^(learn more|click here|submit|read more|here)$/i.test(cta);
}

function flatSpacing(project: BusinessProject): boolean {
  const polish = project.creativePolish;
  if (polish?.spacing === "comfortable" || polish?.spacing === "airy") {
    return false;
  }
  return project.siteWidth === "full";
}

function colorsClash(project: BusinessProject): boolean {
  const a = project.primaryColor.trim().toLowerCase();
  const b = project.accentColor.trim().toLowerCase();
  return Boolean(a && b && a === b);
}

function typographyFlat(project: BusinessProject): boolean {
  return (
    project.headingFont === project.bodyFont &&
    (project.headingFont === "inter" || !project.creativePolish?.visualHierarchy)
  );
}

/**
 * Detect what a creative director would call out as missing / weak.
 */
export function detectMissingCapabilities(
  project: BusinessProject,
): MissingCapability[] {
  const missing: MissingCapability[] = [];

  const push = (
    id: MissingCapabilityId,
    label: string,
    category: MissingCapability["category"],
  ) => {
    missing.push({ id, label, category });
  };

  if (!hasHeroImage(project)) {
    push("hero_image", "No hero image", "visual");
  }
  if (!project.sectionImages?.about && !project.sectionImages?.services) {
    push("service_images", "No service / section imagery", "visual");
  }
  if (filledGalleryCount(project) === 0) {
    push("gallery", "No gallery photos", "visual");
  }
  if (
    hasTeam(project) &&
    !project.sectionImages?.team &&
    !project.mediaLibrary.some((a) =>
      /team|staff|founder/i.test(`${a.title} ${a.alt} ${a.description}`),
    )
  ) {
    push("team_photos", "No team photos", "visual");
  }
  if (!project.creativePolish?.serviceIcons) {
    push("icons", "No icons", "visual");
  }
  if (!hasLogo(project)) {
    push("logo", "No logo", "brand");
  }
  if (colorsClash(project)) {
    push("color_consistency", "Color harmony needs work", "brand");
  }
  if (typographyFlat(project)) {
    push("typography", "Typography lacks hierarchy", "brand");
  }
  if (flatSpacing(project)) {
    push("flat_spacing", "Flat spacing", "visual");
    push("spacing", "Spacing feels tight", "visual");
  }
  if (!project.creativePolish?.visualHierarchy) {
    push("visual_hierarchy", "Weak visual hierarchy", "visual");
  }
  if (!project.creativePolish?.motion) {
    push("motion", "No animations", "motion");
  }
  if (!hasTestimonials(project)) {
    push("testimonials", "No testimonials", "content");
    push("social_proof", "No social proof", "conversion");
  }
  if (!hasFaq(project)) {
    push("faq", "No FAQ", "content");
  }
  if (!hasTeam(project)) {
    push("team", "No team section", "content");
  }
  if (!project.description.trim() && !project.aboutTitle?.trim()) {
    push("about", "Thin About story", "content");
  }
  if (
    !project.contact.phone.trim() &&
    !project.contact.email.trim() &&
    project.contact.formEnabled === false
  ) {
    push("contact", "Weak contact options", "conversion");
    push("lead_capture", "No lead capture", "conversion");
  } else if (project.contact.formEnabled === false) {
    push("lead_capture", "Lead capture form off", "conversion");
  }
  if (weakCta(project)) {
    push("weak_cta", "Weak CTA", "conversion");
    push("cta_strength", "CTA needs strengthening", "conversion");
  }

  // Dedupe by id
  const seen = new Set<string>();
  return missing.filter((cap) => {
    if (seen.has(cap.id)) return false;
    seen.add(cap.id);
    return true;
  });
}

/** Capability ids that count toward completeness when present (inverse of missing). */
export const COMPLETENESS_CHECKS: Array<{
  id: MissingCapabilityId;
  weight: number;
  present: (project: BusinessProject) => boolean;
}> = [
  { id: "hero_image", weight: 10, present: (p) => hasHeroImage(p) },
  { id: "logo", weight: 8, present: (p) => hasLogo(p) },
  {
    id: "gallery",
    weight: 8,
    present: (p) => filledGalleryCount(p) >= Math.min(2, GALLERY_SLOT_COUNT),
  },
  {
    id: "icons",
    weight: 6,
    present: (p) => Boolean(p.creativePolish?.serviceIcons),
  },
  {
    id: "motion",
    weight: 6,
    present: (p) => Boolean(p.creativePolish?.motion),
  },
  {
    id: "visual_hierarchy",
    weight: 6,
    present: (p) => Boolean(p.creativePolish?.visualHierarchy),
  },
  {
    id: "spacing",
    weight: 5,
    present: (p) => !flatSpacing(p),
  },
  { id: "testimonials", weight: 10, present: (p) => hasTestimonials(p) },
  { id: "faq", weight: 8, present: (p) => hasFaq(p) },
  { id: "team", weight: 6, present: (p) => hasTeam(p) },
  {
    id: "cta_strength",
    weight: 8,
    present: (p) => !weakCta(p),
  },
  {
    id: "lead_capture",
    weight: 7,
    present: (p) => p.contact.formEnabled !== false,
  },
  {
    id: "typography",
    weight: 5,
    present: (p) => !typographyFlat(p),
  },
  {
    id: "color_consistency",
    weight: 4,
    present: (p) => !colorsClash(p),
  },
  {
    id: "about",
    weight: 3,
    present: (p) => Boolean(p.description.trim()),
  },
];
