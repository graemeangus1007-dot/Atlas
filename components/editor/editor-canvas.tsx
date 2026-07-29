"use client";

import EditableText from "@/components/editor/editable-text";
import EditorContact from "@/components/editor/editor-contact";
import EditorServices from "@/components/editor/editor-services";
import PreviewDesignSections from "@/components/preview/preview-design-sections";
import PreviewFeatures from "@/components/preview/preview-features";
import PreviewGallery from "@/components/preview/preview-gallery";
import { useTemplate } from "@/context/template-context";
import type { AiContentField } from "@/types/ai";
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
  onImproveField: (
    field: AiContentField,
    label: string,
    value: string,
    serviceIndex?: number,
  ) => void;
};

/**
 * Live website canvas with inline-editable fields + AI improve hooks.
 * Branding CSS variables are applied by the parent via `.site-canvas`.
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
  onImproveField,
}: EditorCanvasProps) {
  const { template } = useTemplate();

  return (
    <div
      className="site-canvas overflow-hidden rounded-2xl border border-border shadow-[0_24px_80px_-40px_rgba(0,0,0,0.65)] transition-all duration-300"
      data-template={template.id}
    >
      {/* Editable site nav */}
      <header className="sticky top-0 z-20 border-b border-border bg-[color:var(--site-bg)]/85 backdrop-blur-xl">
        <nav className="site-shell flex h-16 items-center justify-between gap-4 px-5 sm:px-8">
          <EditableText
            as="span"
            value={content.businessName}
            onChange={onBusinessNameChange}
            aria-label="Business name"
            className="site-heading atlas-display-text text-lg font-semibold tracking-tight text-[color:var(--site-primary)]"
          />
          <ul className="hidden items-center gap-7 text-sm text-muted md:flex">
            <li className="site-link cursor-default">Home</li>
            <li className="site-link cursor-default">About</li>
            <li className="site-link cursor-default">Services</li>
            <li className="site-link cursor-default">Contact</li>
          </ul>
        </nav>
      </header>

      {/* Editable hero */}
      <section className="relative isolate overflow-hidden border-b border-border px-5 py-20 text-center sm:px-8 sm:py-28">
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={content.hero.imageUrl}
            alt=""
            className="h-full w-full object-cover"
          />
          <div className="site-hero-overlay absolute inset-0" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,var(--site-accent-soft),transparent_55%)]" />
        </div>
        <div className="site-shell relative z-10">
          <p className="text-sm font-medium uppercase tracking-wide text-[color:var(--site-accent)]">
            {content.businessName}
          </p>
          <EditableText
            as="h1"
            value={content.hero.headline}
            onChange={onHeadlineChange}
            aria-label="Hero headline"
            className="site-heading atlas-display-text mx-auto mt-4 max-w-4xl text-3xl font-semibold tracking-tight text-foreground sm:text-5xl"
            onImproveWithAi={(value) =>
              onImproveField("heroHeadline", "Hero Headline", value)
            }
          />
          <EditableText
            as="p"
            value={content.hero.subheadline}
            onChange={onSubheadlineChange}
            aria-label="Hero subheadline"
            className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-muted sm:text-lg"
            onImproveWithAi={(value) =>
              onImproveField("heroSubheadline", "Hero Subheadline", value)
            }
          />
          <div className="mt-10 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
            <div className="site-button inline-flex min-w-[10rem] flex-col items-center justify-center bg-[color:var(--site-accent)] px-6 py-3.5 text-sm font-medium text-[color:var(--site-bg)] transition-all duration-200 hover:brightness-110">
              <EditableText
                as="span"
                value={content.hero.primaryCta}
                onChange={onPrimaryCtaChange}
                aria-label="Call-to-action button text"
                className="text-center"
                inputClassName="text-center text-foreground"
                onImproveWithAi={(value) =>
                  onImproveField("primaryCta", "Call-to-Action", value)
                }
              />
            </div>
            <span className="site-button inline-flex items-center justify-center border border-border px-8 py-3.5 text-sm font-medium text-foreground">
              {content.hero.secondaryCta}
            </span>
          </div>
        </div>
      </section>

      {/* Editable about */}
      <section
        id="about"
        className="scroll-mt-20 border-b border-border px-5 py-16 sm:px-8 sm:py-20"
      >
        <div className="site-shell grid gap-10 px-0 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-[color:var(--site-accent)]">
              About
            </p>
            <h2 className="site-heading atlas-display-text mt-3 text-3xl font-semibold tracking-tight text-foreground">
              {content.about.title}
            </h2>
          </div>
          <div className="site-card rounded-3xl border p-6 sm:p-8">
            <EditableText
              as="p"
              multiline
              value={content.about.description}
              onChange={onAboutChange}
              aria-label="About section"
              className="text-base leading-relaxed text-muted sm:text-lg"
              onImproveWithAi={(value) =>
                onImproveField("description", "About Section", value)
              }
            />
            <p className="mt-6 text-sm text-foreground/80">
              — The team at {content.businessName}
            </p>
          </div>
        </div>
      </section>

      <EditorServices
        services={content.services}
        onServiceChange={onServiceChange}
        onImproveField={onImproveField}
        cardStyle={template.cardStyle}
      />
      <PreviewFeatures
        features={content.features}
        cardStyle={template.cardStyle}
      />
      <PreviewGallery
        items={content.gallery}
        galleryLayout={template.galleryLayout}
        onTitleChange={onGalleryTitleChange}
      />
      {content.designSections?.enabled?.length ? (
        <PreviewDesignSections
          sections={content.designSections}
          cardStyle={template.cardStyle}
        />
      ) : null}
      <EditorContact
        contact={contact}
        projectId={projectId}
        onChange={onContactChange}
        footerLayout={template.footerLayout}
        cardStyle={template.cardStyle}
      />
    </div>
  );
}
