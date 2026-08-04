import { DEFAULT_BRANDING } from "@/data/design-options";
import { DEFAULT_MEDIA } from "@/data/media";
import { BUSINESS_TYPE_TEMPLATES } from "@/data/website-templates";
import { defaultProjectContact } from "@/lib/contact";
import type { BusinessProject } from "@/types/business-project";
import { DEFAULT_PROJECT_PAGES } from "@/types/business-project";
import { DEFAULT_GALLERY_INTERACTION } from "@/types/gallery";
import type { MediaAsset } from "@/types/media";

const coffeeTemplate = BUSINESS_TYPE_TEMPLATES["Coffee Shop"];
const mockBusinessName = "Riverview Bakery";

/**
 * Canonical mock Atlas project.
 * Used as the Context default and as the fallback when onboarding has not run.
 */
export const MOCK_BUSINESS_PROJECT: BusinessProject = {
  businessName: mockBusinessName,
  businessType: "Coffee Shop",
  description:
    "Riverview Bakery is a neighborhood coffee shop serving specialty drinks, fresh breakfast, and pastries baked every morning. We care about quality ingredients, friendly service, and a warm place to gather.",
  goals: ["Get more customers", "Accept online orders", "Share information"],
  heroHeadline: coffeeTemplate.headline,
  heroSubheadline: coffeeTemplate.subheadline,
  primaryCta: coffeeTemplate.primaryCta,
  services: coffeeTemplate.services.map((service) => ({ ...service })),
  contact: defaultProjectContact(
    mockBusinessName,
    coffeeTemplate.contactDescription,
  ),
  templateId: "modern",
  pages: DEFAULT_PROJECT_PAGES,
  primaryColor: coffeeTemplate.accentColor,
  secondaryColor: DEFAULT_BRANDING.secondaryColor,
  accentColor: coffeeTemplate.accentColor,
  backgroundColor: DEFAULT_BRANDING.backgroundColor,
  headingFont: DEFAULT_BRANDING.headingFont,
  bodyFont: DEFAULT_BRANDING.bodyFont,
  buttonStyle: DEFAULT_BRANDING.buttonStyle,
  heroOverlay: DEFAULT_BRANDING.heroOverlay,
  siteWidth: DEFAULT_BRANDING.siteWidth,
  theme: DEFAULT_BRANDING.theme,
  logo: null,
  mediaLibrary: [] as MediaAsset[],
  heroImageId: DEFAULT_MEDIA.heroImageId,
  galleryImageIds: [...DEFAULT_MEDIA.galleryImageIds],
  galleryInteraction: { ...DEFAULT_GALLERY_INTERACTION },
  status: "draft",
  publish: null,
};
