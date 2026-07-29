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
import type { TemplateSectionId } from "@/lib/templates/types";
import type { GeneratedWebsiteContent } from "@/types/website-content";

type WebsiteRendererProps = {
  content: GeneratedWebsiteContent;
  template: WebsiteTemplate;
  /** Optional gallery title edit hook (editor). */
  onGalleryTitleChange?: (assetId: string, title: string) => void;
  /** When false, omits the sticky product preview chrome actions parent. */
  showNav?: boolean;
};

function renderCoreSection(
  sectionId: string,
  content: GeneratedWebsiteContent,
  template: WebsiteTemplate,
  onGalleryTitleChange?: (assetId: string, title: string) => void,
) {
  switch (sectionId as TemplateSectionId) {
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
}

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
  const order =
    content.sectionOrder && content.sectionOrder.length > 0
      ? content.sectionOrder
      : template.sectionOrder;

  const coreIds = new Set(template.sectionOrder);
  const designOnly = (content.designSections?.enabled ?? []).filter(
    (id) => !coreIds.has(id as TemplateSectionId),
  );

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
          logoUrl={content.logoUrl}
        />
      ) : null}

      <main className="flex-1">
        {order.map((sectionId) => {
          if (coreIds.has(sectionId as TemplateSectionId)) {
            return renderCoreSection(
              sectionId,
              content,
              template,
              onGalleryTitleChange,
            );
          }
          // Design sections interleaved when present in sectionOrder
          if (
            content.designSections?.enabled?.includes(sectionId) &&
            content.designSections
          ) {
            return (
              <PreviewDesignSections
                key={`design-${sectionId}`}
                sections={{
                  ...content.designSections,
                  enabled: [sectionId],
                }}
                cardStyle={template.cardStyle}
              />
            );
          }
          return null;
        })}
        {/* Any remaining design sections not listed in sectionOrder */}
        {content.designSections?.enabled?.length ? (
          <PreviewDesignSections
            sections={{
              ...content.designSections,
              enabled: designOnly.filter(
                (id) => !(content.sectionOrder ?? []).includes(id),
              ),
            }}
            cardStyle={template.cardStyle}
          />
        ) : null}
      </main>
    </div>
  );
}
