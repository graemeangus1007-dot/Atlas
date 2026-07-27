import { BUSINESS_TYPE_TEMPLATES } from "@/data/website-templates";
import {
  defaultProjectContact,
  resolveContactButtonText,
  resolveContactSuccessMessage,
} from "@/lib/contact";
import { getPublishableAtlasOrigin } from "@/lib/app-url";
import { placeholderImageUrl, resolveMediaUrl } from "@/lib/media";
import type { BusinessType } from "@/types/business";
import type { BusinessProject } from "@/types/business-project";
import type { GeneratedWebsiteContent } from "@/types/website-content";
import { GALLERY_SLOT_COUNT } from "@/types/media";

export type GenerateWebsiteContentOptions = {
  /** Absolute Atlas origin for contact form POST (server-resolved APP_URL). */
  atlasOrigin?: string | null;
};

const GALLERY_TONES = [
  "from-[color:var(--site-accent)]/35 to-surface",
  "from-white/10 to-surface",
  "from-[color:var(--site-accent)]/20 to-surface",
  "from-white/5 to-surface",
] as const;

function resolveBusinessType(
  businessType: BusinessProject["businessType"],
): BusinessType {
  return businessType || "Other";
}

/**
 * Generate complete website content from a BusinessProject.
 * Editable fields on the project override type-template defaults.
 */
export function generateWebsiteContent(
  project: BusinessProject,
  options: GenerateWebsiteContentOptions = {},
): GeneratedWebsiteContent {
  const businessType = resolveBusinessType(project.businessType);
  const atlasOrigin =
    options.atlasOrigin?.trim().replace(/\/+$/, "") ||
    getPublishableAtlasOrigin();
  const template = BUSINESS_TYPE_TEMPLATES[businessType];
  const businessName = project.businessName.trim() || "Your Business";
  const description =
    project.description.trim() ||
    `${businessName} is a ${businessType.toLowerCase()} dedicated to serving customers with care, quality, and a memorable experience.`;

  const heroImageUrl = resolveMediaUrl(
    project.mediaLibrary,
    project.heroImageId,
  );

  return {
    businessName,
    businessType,
    accentColor:
      project.accentColor || project.primaryColor || template.accentColor,
    hero: {
      eyebrow: project.heroEyebrow?.trim() || businessName,
      headline: project.heroHeadline.trim() || template.headline,
      subheadline: project.heroSubheadline.trim() || template.subheadline,
      primaryCta: project.primaryCta.trim() || template.primaryCta,
      secondaryCta: project.secondaryCta?.trim() || template.secondaryCta,
      imageUrl:
        heroImageUrl || placeholderImageUrl(`${businessName} hero`, 1600, 900),
      isPlaceholder: !heroImageUrl,
    },
    about: {
      title: project.aboutTitle?.trim() || template.aboutTitle,
      description,
    },
    services:
      project.services.length > 0
        ? project.services
        : template.services,
    features: template.features,
    gallery: template.galleryLabels
      .slice(0, GALLERY_SLOT_COUNT)
      .map((label, index) => {
        const assetId = project.galleryImageIds[index] ?? null;
        const asset = assetId
          ? project.mediaLibrary.find((item) => item.id === assetId)
          : undefined;
        const uploaded = asset?.url ?? null;
        const title = asset?.title?.trim() || label;
        const description = asset?.description?.trim() || "";
        const alt = asset?.alt?.trim() || title;

        return {
          id: String(index + 1),
          assetId: asset?.id ?? null,
          title,
          description,
          alt,
          label: title,
          tone: GALLERY_TONES[index] ?? GALLERY_TONES[0],
          imageUrl: uploaded || placeholderImageUrl(label, 800, 600),
          isPlaceholder: !uploaded,
        };
      }),
    contact: (() => {
      const fallback = defaultProjectContact(
        businessName,
        template.contactDescription,
      );
      const contact = project.contact ?? fallback;
      return {
        title: contact.title.trim() || fallback.title,
        description: contact.description.trim() || fallback.description,
        details: [
          {
            label: "Phone",
            value: contact.phone.trim() || fallback.phone,
          },
          {
            label: "Email",
            value: contact.email.trim() || fallback.email,
          },
          {
            label: "Location",
            value: contact.location.trim() || fallback.location,
          },
        ],
        form: {
          enabled: contact.formEnabled !== false,
          formId: contact.formId?.trim() || null,
          buttonText: resolveContactButtonText(contact),
          successMessage: resolveContactSuccessMessage(contact),
          showPhoneField: contact.showPhoneField !== false,
          showCompanyField: Boolean(contact.showCompanyField),
          apiBaseUrl: atlasOrigin,
        },
      };
    })(),
  };
}

/** Soft accent wash for hover / soft backgrounds derived from the brand color. */
export function accentToSoft(accentColor: string, alpha = 0.14): string {
  const hex = accentColor.replace("#", "");
  if (hex.length !== 6) return `rgba(61, 184, 168, ${alpha})`;

  const r = Number.parseInt(hex.slice(0, 2), 16);
  const g = Number.parseInt(hex.slice(2, 4), 16);
  const b = Number.parseInt(hex.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
