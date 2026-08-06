/**
 * Brand / scope preservation snapshot for transformation execution.
 */

import type { BrandScopeSnapshot } from "@/lib/transformation/execution-types";
import type { BusinessProject } from "@/types/business-project";

function sectionFingerprint(project: BusinessProject): string {
  const sections = project.designSections;
  return JSON.stringify({
    aboutTitle: project.aboutTitle ?? "",
    services: (project.services ?? []).map((s) => ({
      t: s.title,
      d: (s.description ?? "").slice(0, 40),
    })),
    testimonials: (sections?.testimonials ?? []).length,
    faq: (sections?.faq ?? []).length,
    team: (sections?.team ?? []).length,
    pricing: (sections?.pricing ?? []).length,
    contactTitle: project.contact?.title ?? "",
  });
}

export function captureBrandScopeSnapshot(
  project: BusinessProject,
): BrandScopeSnapshot {
  return {
    primaryColor: project.primaryColor,
    secondaryColor: project.secondaryColor,
    accentColor: project.accentColor,
    backgroundColor: project.backgroundColor,
    headingFont: project.headingFont,
    bodyFont: project.bodyFont,
    heroImageId: project.heroImageId ?? null,
    mediaLibraryIds: (project.mediaLibrary ?? []).map((m) => m.id).sort(),
    businessName: project.businessName,
    businessType: project.businessType,
    description: project.description,
    contactPhone: project.contact?.phone ?? "",
    contactEmail: project.contact?.email ?? "",
    contactFormEnabled: Boolean(project.contact?.formEnabled),
    formFieldSurface: project.componentSurfaces?.formFields ?? null,
    galleryImageIds: [...(project.galleryImageIds ?? [])],
    sectionContentFingerprint: sectionFingerprint(project),
  };
}

/** Domains no transformation goal may alter unless explicitly in scope. */
export function brandIntegrityViolations(
  before: BrandScopeSnapshot,
  after: BusinessProject,
): string[] {
  const next = captureBrandScopeSnapshot(after);
  const violations: string[] = [];
  if (before.primaryColor !== next.primaryColor) violations.push("primaryColor");
  if (before.secondaryColor !== next.secondaryColor) {
    violations.push("secondaryColor");
  }
  if (before.accentColor !== next.accentColor) violations.push("accentColor");
  if (before.backgroundColor !== next.backgroundColor) {
    violations.push("backgroundColor");
  }
  if (before.headingFont !== next.headingFont) violations.push("headingFont");
  if (before.bodyFont !== next.bodyFont) violations.push("bodyFont");
  if (before.businessName !== next.businessName) violations.push("businessName");
  if (before.businessType !== next.businessType) violations.push("businessType");
  if (before.contactPhone !== next.contactPhone) violations.push("contactPhone");
  if (before.contactEmail !== next.contactEmail) violations.push("contactEmail");
  // Media library identity — transformation must not remove existing assets.
  for (const id of before.mediaLibraryIds) {
    if (!next.mediaLibraryIds.includes(id)) {
      violations.push(`mediaLibrary:${id}`);
    }
  }
  return violations;
}

export function heroAssetPreserved(
  before: BrandScopeSnapshot,
  after: BusinessProject,
): boolean {
  if (!before.heroImageId) return true;
  return after.heroImageId === before.heroImageId;
}
