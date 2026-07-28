"use client";

import PreviewAbout from "@/components/preview/preview-about";
import PreviewContact from "@/components/preview/preview-contact";
import PreviewDesignSections from "@/components/preview/preview-design-sections";
import PreviewFeatures from "@/components/preview/preview-features";
import PreviewGallery from "@/components/preview/preview-gallery";
import PreviewHero from "@/components/preview/preview-hero";
import PreviewNav from "@/components/preview/preview-nav";
import PreviewServices from "@/components/preview/preview-services";
import type { WebsiteTemplate } from "@/lib/templates";
import type { GeneratedWebsiteContent } from "@/types/website-content";

type WebsiteRendererProps = {
  content: GeneratedWebsiteContent;
  template: WebsiteTemplate;
  /** Optional gallery title edit hook (editor). */
  onGalleryTitleChange?: (assetId: string, title: string) => void;
  /** When false, omits the sticky product preview chrome actions parent. */
  showNav?: boolean;
};

/**
 * Assembles a generated website from template configuration + content.
 * Section components are shared — only order and variants change.
 */
export default function WebsiteRenderer({
  content,
  template,
  onGalleryTitleChange,
  showNav = true,
}: WebsiteRendererProps) {
  return (
    <div
      className="flex min-h-full flex-1 flex-col"
      data-template={template.id}
      data-card-style={template.cardStyle}
      data-hero-layout={template.heroLayout}
      data-nav-style={template.navStyle}
      data-gallery-layout={template.galleryLayout}
      data-footer-layout={template.footerLayout}
    >
      {showNav ? (
        <PreviewNav
          businessName={content.businessName}
          navStyle={template.navStyle}
        />
      ) : null}

      <main className="flex-1">
        {template.sectionOrder.map((sectionId) => {
          switch (sectionId) {
            case "hero":
              return (
                <PreviewHero
                  key="hero"
                  content={content.hero}
                  heroLayout={template.heroLayout}
                />
              );
            case "about":
              return (
                <PreviewAbout
                  key="about"
                  businessName={content.businessName}
                  about={content.about}
                  cardStyle={template.cardStyle}
                />
              );
            case "services":
              return (
                <PreviewServices
                  key="services"
                  services={content.services}
                  cardStyle={template.cardStyle}
                />
              );
            case "features":
              return (
                <PreviewFeatures
                  key="features"
                  features={content.features}
                  cardStyle={template.cardStyle}
                />
              );
            case "gallery":
              return (
                <PreviewGallery
                  key="gallery"
                  items={content.gallery}
                  galleryLayout={template.galleryLayout}
                  onTitleChange={onGalleryTitleChange}
                />
              );
            case "contact":
              return (
                <PreviewContact
                  key="contact"
                  contact={content.contact}
                  footerLayout={template.footerLayout}
                  cardStyle={template.cardStyle}
                />
              );
            default:
              return null;
          }
        })}
        {content.designSections?.enabled?.length ? (
          <PreviewDesignSections
            sections={content.designSections}
            cardStyle={template.cardStyle}
          />
        ) : null}
      </main>
    </div>
  );
}
