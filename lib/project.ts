import { DEFAULT_BRANDING } from "@/data/design-options";
import { DEFAULT_MEDIA } from "@/data/media";
import { BUSINESS_TYPE_TEMPLATES } from "@/data/website-templates";
import { defaultProjectContact } from "@/lib/contact";
import { applyTemplateToProject } from "@/lib/templates";
import "@/lib/templates";
import type {
  BusinessProject,
  OnboardingFields,
  ProjectStatus,
} from "@/types/business-project";
import { DEFAULT_PROJECT_PAGES } from "@/types/business-project";

/** Human-readable project status for dashboard tiles. */
export function formatProjectStatus(status: ProjectStatus): string {
  switch (status) {
    case "draft":
      return "Draft";
    case "generating":
      return "Generating";
    case "ready":
      return "Ready";
    case "published":
      return "Published";
    default:
      return status;
  }
}

/** Build avatar initials from a business name. */
export function getBusinessInitials(businessName: string): string {
  const parts = businessName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "AT";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

/** Merge onboarding answers into a full BusinessProject shape. */
export function projectFromOnboarding(
  fields: OnboardingFields,
  base: BusinessProject,
): BusinessProject {
  const businessType = fields.businessType || "Other";
  const template = BUSINESS_TYPE_TEMPLATES[businessType];

  const next: BusinessProject = {
    ...base,
    businessName: fields.businessName.trim(),
    businessType: fields.businessType,
    description: fields.description.trim(),
    goals: fields.goals,
    heroHeadline: template.headline,
    heroSubheadline: template.subheadline,
    primaryCta: template.primaryCta,
    services: template.services.map((service) => ({ ...service })),
    contact: defaultProjectContact(
      fields.businessName.trim(),
      template.contactDescription,
    ),
    templateId: fields.templateId || base.templateId || "modern",
    pages: base.pages.length > 0 ? base.pages : DEFAULT_PROJECT_PAGES,
    primaryColor: template.accentColor,
    secondaryColor: base.secondaryColor || DEFAULT_BRANDING.secondaryColor,
    accentColor: template.accentColor,
    backgroundColor: base.backgroundColor || DEFAULT_BRANDING.backgroundColor,
    headingFont: base.headingFont || DEFAULT_BRANDING.headingFont,
    bodyFont: base.bodyFont || DEFAULT_BRANDING.bodyFont,
    buttonStyle: base.buttonStyle || DEFAULT_BRANDING.buttonStyle,
    heroOverlay: base.heroOverlay ?? DEFAULT_BRANDING.heroOverlay,
    siteWidth: base.siteWidth || DEFAULT_BRANDING.siteWidth,
    theme: base.theme || DEFAULT_BRANDING.theme,
    mediaLibrary: base.mediaLibrary ?? [...DEFAULT_MEDIA.mediaLibrary],
    heroImageId: base.heroImageId ?? DEFAULT_MEDIA.heroImageId,
    galleryImageIds: base.galleryImageIds ?? [...DEFAULT_MEDIA.galleryImageIds],
    status: "draft",
    publish: base.publish ?? null,
  };

  return applyTemplateToProject(next, next.templateId);
}

/** Dashboard stats derived from the central BusinessProject. */
export function getDashboardStats(project: BusinessProject) {
  const pageHint =
    project.pages.map((page) => page.title).join(", ") || "No pages yet";

  return [
    {
      id: "status",
      label: "Website Status",
      value: formatProjectStatus(project.status),
      hint:
        project.status === "published"
          ? "Live on the web"
          : "Not published yet",
    },
    {
      id: "pages",
      label: "Pages",
      value: String(project.pages.length),
      hint: pageHint,
    },
    {
      id: "seo",
      label: "SEO Score",
      value: "82%",
      hint: "Good — a few quick wins left",
    },
    {
      id: "visitors",
      label: "Visitors",
      value: "—",
      hint:
        project.status === "published"
          ? "See Analytics for live traffic"
          : "Publish to start tracking",
    },
  ] as const;
}
