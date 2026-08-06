"use client";

import EditableText from "@/components/editor/editable-text";
import EditorContact from "@/components/editor/editor-contact";
import EditorServices from "@/components/editor/editor-services";
import PreviewDesignSections from "@/components/preview/preview-design-sections";
import PreviewFeatures from "@/components/preview/preview-features";
import PreviewGallery from "@/components/preview/preview-gallery";
import SiteHero from "@/components/site/site-hero";
import { useTemplate } from "@/context/template-context";
import { buildHeroRenderPlan } from "@/lib/hero-composition";
import type { TemplateSectionId } from "@/lib/templates/types";
import type { ProjectContact } from "@/types/business-project";
import type { GeneratedWebsiteContent, WebsiteService } from "@/types/website-content";

type EditorCanvasProps = {
  content: GeneratedWebsiteContent;
  contact: ProjectContact;
  projectId?: string | null;
  onBusinessNameChange: (value: string) => void;
  onHeadlineChange: (value: string) => void;
  onSubheadlineChange: (value: string) => void;
  onAboutChange: (value: string) => void;
  onPrimaryCtaChange: (value: string) => void;
  onServiceChange: (index: number, patch: Partial<WebsiteService>) => void;
  onContactChange: (patch: Partial<ProjectContact>) => void;
  onGalleryTitleChange: (assetId: string, title: string) => void;
};

/**
 * Live website canvas with inline-editable fields.
 * Branding CSS variables are applied by the parent via `.site-canvas`.
 * Honors Visual Designer sectionOrder, logo, and section images.
 */
export default function EditorCanvas({
  content,
  contact,
  projectId = null,
  onBusinessNameChange,
  onHeadlineChange,
  onSubheadlineChange,
  onAboutChange,
  onPrimaryCtaChange,
  onServiceChange,
  onContactChange,
  onGalleryTitleChange,
}: EditorCanvasProps) {
  const { template } = useTemplate();
  const order =
    content.sectionOrder && content.sectionOrder.length > 0
      ? content.sectionOrder
      : template.sectionOrder;
  const coreIds = new Set(template.sectionOrder);
  const renderedDesign = new Set<string>();

  function renderCore(sectionId: string) {
    switch (sectionId as TemplateSectionId) {
      case "hero": {
        const composition = content.heroComposition;
        const plan = buildHeroRenderPlan(composition);
        const eyebrow = content.hero.eyebrow?.trim() || "";
        return (
          <SiteHero
            key="hero"
            content={content.hero}
            composition={composition}
            testId="editor-hero"
            slots={{
              eyebrow: eyebrow ? (
                <p
                  className="site-hero-eyebrow text-sm font-medium uppercase tracking-wide text-[color:var(--site-hero-eyebrow,var(--site-accent))]"
                  data-testid="editor-hero-eyebrow"
                >
                  {eyebrow}
                </p>
              ) : null,
              headline: (
                <div data-testid="editor-hero-headline">
                  <EditableText
                    as="h1"
                    value={content.hero.headline}
                    onChange={onHeadlineChange}
                    aria-label="Hero headline"
                    className={`site-heading atlas-display-text font-semibold tracking-tight text-[color:var(--site-hero-headline,var(--site-fg))] ${plan.titleSizeClass} ${
                      eyebrow ? "mt-4" : ""
                    }`}
                  />
                </div>
              ),
              subheadline: (
                <div data-testid="editor-hero-subheadline">
                  <EditableText
                    as="p"
                    value={content.hero.subheadline}
                    onChange={onSubheadlineChange}
                    aria-label="Hero subheadline"
                    className={`mt-5 text-base leading-relaxed text-[color:var(--site-hero-body,var(--site-muted))] sm:text-lg ${plan.ledeWidthClass}`}
                  />
                </div>
              ),
              primaryCta: (
                <div className="site-button site-button-primary inline-flex min-w-[10rem] flex-col items-center justify-center bg-[color:var(--site-hero-cta-bg,var(--site-accent))] px-6 py-3.5 text-sm font-medium text-[color:var(--site-hero-cta-fg,var(--site-bg))] transition-all duration-200 hover:brightness-110">
                  <EditableText
                    as="span"
                    value={content.hero.primaryCta}
                    onChange={onPrimaryCtaChange}
                    aria-label="Call-to-action button text"
                    className="text-center"
                    inputClassName="text-center"
                  />
                </div>
              ),
              secondaryCta: (
                <span className="site-button site-button-secondary inline-flex items-center justify-center border border-border px-8 py-3.5 text-sm font-medium text-[color:var(--site-hero-cta-secondary-fg,var(--site-fg))]">
                  {content.hero.secondaryCta}
                </span>
              ),
            }}
          />
        );
      }
      case "about":
        return (
          <section
            key="about"
            id="about"
            className="scroll-mt-20 border-b border-border px-5 py-16 sm:px-8 sm:py-20"
          >
            <div
              className={`site-shell grid gap-10 px-0 lg:items-start ${
                content.about.imageUrl
                  ? "lg:grid-cols-[1.05fr_0.95fr]"
                  : "lg:grid-cols-[0.9fr_1.1fr]"
              }`}
            >
              <div>
                <p className="text-sm font-medium uppercase tracking-wide text-[color:var(--site-accent)]">
                  About
                </p>
                <h2 className="site-heading atlas-display-text mt-3 text-3xl font-semibold tracking-tight text-foreground">
                  {content.about.title}
                </h2>
              </div>
              <div className="space-y-4">
                {content.about.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={content.about.imageUrl}
                    alt=""
                    className="aspect-[4/3] w-full rounded-3xl object-cover"
                    data-testid="about-section-image"
                  />
                ) : null}
                <div className="site-card rounded-3xl border p-6 sm:p-8">
                  <EditableText
                    as="p"
                    multiline
                    value={content.about.description}
                    onChange={onAboutChange}
                    aria-label="About section"
                    className="text-base leading-relaxed text-muted sm:text-lg"
                  />
                  <p className="mt-6 text-sm text-foreground/80">
                    — The team at {content.businessName}
                  </p>
                </div>
              </div>
            </div>
          </section>
        );
      case "services":
        return (
          <EditorServices
            key="services"
            services={content.services}
            onServiceChange={onServiceChange}
            cardStyle={template.cardStyle}
            showIcons={Boolean(content.creativePolish?.serviceIcons)}
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
            lightboxEnabled={content.galleryInteraction?.mode === "lightbox"}
            lightboxNavigation={
              content.galleryInteraction?.navigation !== false
            }
            lightboxCaptions={content.galleryInteraction?.captions === true}
          />
        );
      case "contact":
        return (
          <EditorContact
            key="contact"
            contact={contact}
            projectId={projectId}
            onChange={onContactChange}
            footerLayout={template.footerLayout}
            cardStyle={template.cardStyle}
          />
        );
      default:
        return null;
    }
  }

  return (
    <div
      className="site-canvas overflow-hidden rounded-2xl border border-border shadow-[0_24px_80px_-40px_rgba(0,0,0,0.65)] transition-all duration-300"
      data-template={template.id}
      data-motion={content.creativePolish?.motion ? "on" : "off"}
      data-motion-preset={
        content.creativePolish?.motionPreset ??
        (content.creativePolish?.motion ? "subtle" : "none")
      }
      data-section-reveal={
        (content.creativePolish?.sectionReveal ?? content.creativePolish?.motion)
          ? "on"
          : "off"
      }
      data-hover-effects={
        (content.creativePolish?.hoverEffects ?? content.creativePolish?.motion)
          ? "on"
          : "off"
      }
      data-hierarchy={content.creativePolish?.visualHierarchy ? "on" : "off"}
      data-spacing={content.creativePolish?.spacing ?? "default"}
    >
      <header className="sticky top-0 z-20 border-b border-border bg-[color:var(--site-bg)]/85 backdrop-blur-xl">
        <nav className="site-shell flex h-16 items-center justify-between gap-4 px-5 sm:px-8">
          <div className="flex min-w-0 items-center gap-2">
            {content.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={content.logoUrl}
                alt=""
                className="h-8 w-auto max-w-[9rem] object-contain"
                data-testid="site-logo"
              />
            ) : null}
            <EditableText
              as="span"
              value={content.businessName}
              onChange={onBusinessNameChange}
              aria-label="Business name"
              className="site-heading atlas-display-text text-lg font-semibold tracking-tight text-[color:var(--site-primary)]"
            />
          </div>
          <ul className="hidden items-center gap-7 text-sm text-muted md:flex">
            <li className="site-link cursor-default">Home</li>
            <li className="site-link cursor-default">About</li>
            <li className="site-link cursor-default">Services</li>
            <li className="site-link cursor-default">Contact</li>
          </ul>
        </nav>
      </header>

      {order.map((sectionId) => {
        if (coreIds.has(sectionId as TemplateSectionId)) {
          return renderCore(sectionId);
        }
        if (
          content.designSections?.enabled?.includes(sectionId) &&
          content.designSections
        ) {
          renderedDesign.add(sectionId);
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

      {content.designSections?.enabled?.length ? (
        <PreviewDesignSections
          sections={{
            ...content.designSections,
            enabled: content.designSections.enabled.filter(
              (id) => !renderedDesign.has(id),
            ),
          }}
          cardStyle={template.cardStyle}
        />
      ) : null}
    </div>
  );
}
