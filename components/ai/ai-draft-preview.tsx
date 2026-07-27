"use client";

import AiCreateWebsiteButton from "@/components/ai/ai-create-website-button";
import type { GeneratedWebsiteDraft } from "@/lib/ai/types";

type Props = {
  draft: GeneratedWebsiteDraft;
  creating?: boolean;
  createError?: string | null;
  createSuccess?: boolean;
  onCreate: () => void;
};

/**
 * Read-only preview of a generated website draft + create-in-editor CTA.
 */
export default function AiDraftPreview({
  draft,
  creating = false,
  createError = null,
  createSuccess = false,
  onCreate,
}: Props) {
  return (
    <section
      className="space-y-6 rounded-2xl border border-border bg-surface/50 p-5 sm:p-6"
      aria-labelledby="ai-draft-preview-title"
    >
      <div>
        <p className="text-xs uppercase tracking-wide text-muted">
          Generated draft
        </p>
        <h2
          id="ai-draft-preview-title"
          className="mt-1 font-[family-name:var(--font-atlas-display)] text-2xl font-semibold text-foreground"
        >
          {draft.businessName}
        </h2>
        <p className="mt-1 text-sm text-muted">{draft.businessType}</p>
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-foreground">Hero</h3>
        {draft.heroEyebrow ? (
          <p className="text-xs uppercase tracking-wide text-muted">
            {draft.heroEyebrow}
          </p>
        ) : null}
        <p className="text-lg font-medium text-foreground">{draft.heroHeadline}</p>
        <p className="text-sm text-muted">{draft.heroSubheadline}</p>
        <p className="text-sm text-accent">{draft.primaryCta}</p>
        {draft.secondaryCta ? (
          <p className="text-sm text-muted">{draft.secondaryCta}</p>
        ) : null}
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-foreground">{draft.aboutTitle}</h3>
        <p className="text-sm leading-relaxed text-muted">{draft.aboutBody}</p>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Services</h3>
        <ul className="space-y-3">
          {draft.services.map((service) => (
            <li key={service.title} className="rounded-xl border border-border/70 p-3">
              <p className="font-medium text-foreground">{service.title}</p>
              <p className="mt-1 text-sm text-muted">{service.description}</p>
            </li>
          ))}
        </ul>
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-foreground">
          {draft.contact.title}
        </h3>
        <p className="text-sm text-muted">{draft.contact.description}</p>
        <ul className="text-sm text-foreground">
          <li>{draft.contact.phone}</li>
          <li>{draft.contact.email}</li>
          <li>{draft.contact.location}</li>
          <li className="text-accent">{draft.contact.buttonText}</li>
        </ul>
      </div>

      <div className="space-y-2 border-t border-border pt-4">
        <h3 className="text-sm font-semibold text-foreground">SEO</h3>
        <p className="text-sm text-foreground">{draft.seo.siteTitle}</p>
        <p className="text-sm text-muted">{draft.seo.metaDescription}</p>
      </div>

      <div className="space-y-3 border-t border-border pt-4">
        <p className="text-sm text-muted">
          Looks good? Create a new editable website in the Atlas editor. Your
          current project is left unchanged.
        </p>
        <AiCreateWebsiteButton
          loading={creating}
          disabled={creating || createSuccess}
          onCreate={onCreate}
        />
        {creating ? (
          <p className="text-sm text-muted" aria-live="polite">
            Creating your website and opening the editor…
          </p>
        ) : null}
        {createSuccess ? (
          <p className="text-sm text-accent" aria-live="polite">
            Website created — opening the editor…
          </p>
        ) : null}
        {createError ? (
          <p className="text-sm text-red-300" role="alert">
            {createError}
          </p>
        ) : null}
      </div>
    </section>
  );
}
