"use client";

import { useState } from "react";
import AiCreateWebsiteButton from "@/components/ai/ai-create-website-button";
import Button from "@/components/ui/button";
import { applySectionPatch } from "@/lib/ai/regenerate";
import {
  AI_OPTIONAL_SECTION_LABELS,
  type AiOptionalSectionId,
} from "@/lib/ai/optional-sections";
import type {
  AiRegenerateSection,
  GenerateWebsiteQuestionnaire,
  GeneratedWebsiteDraft,
} from "@/lib/ai/types";

type Props = {
  draft: GeneratedWebsiteDraft;
  projectId: string;
  questionnaire?: GenerateWebsiteQuestionnaire | null;
  creating?: boolean;
  createError?: string | null;
  createSuccess?: boolean;
  onCreate: () => void;
  onDraftChange: (draft: GeneratedWebsiteDraft) => void;
};

type PendingComparison = {
  section: AiRegenerateSection;
  patch: Partial<GeneratedWebsiteDraft>;
};

const SECTION_LABELS: Record<AiRegenerateSection, string> = {
  hero: "Hero",
  about: "About",
  services: "Services",
};

function sectionSummary(
  section: AiRegenerateSection,
  draft: GeneratedWebsiteDraft,
): string {
  if (section === "hero") {
    return [draft.heroHeadline, draft.heroSubheadline, draft.primaryCta]
      .filter(Boolean)
      .join("\n");
  }
  if (section === "about") {
    return `${draft.aboutTitle}\n${draft.aboutBody}`;
  }
  return draft.services
    .map((service) => `${service.title}: ${service.description}`)
    .join("\n");
}

/**
 * Read-only preview of a generated website draft + regenerate + create CTA.
 */
export default function AiDraftPreview({
  draft,
  projectId,
  questionnaire = null,
  creating = false,
  createError = null,
  createSuccess = false,
  onCreate,
  onDraftChange,
}: Props) {
  const [regenerating, setRegenerating] = useState<AiRegenerateSection | null>(
    null,
  );
  const [regenError, setRegenError] = useState<string | null>(null);
  const [variation, setVariation] = useState(1);
  const [pending, setPending] = useState<PendingComparison | null>(null);

  async function handleRegenerate(section: AiRegenerateSection) {
    if (creating || createSuccess || regenerating) return;
    setRegenerating(section);
    setRegenError(null);
    setPending(null);

    try {
      const nextVariation = variation + 1;
      const res = await fetch("/api/ai/regenerate", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          section,
          currentDraft: draft,
          variation: nextVariation,
          questionnaire: questionnaire ?? undefined,
          businessName: draft.businessName,
          businessType: draft.businessType,
          description: draft.description,
        }),
      });
      const body = (await res.json()) as {
        patch?: Partial<GeneratedWebsiteDraft>;
        error?: { message?: string };
      };
      if (!res.ok || !body.patch) {
        throw new Error(
          body.error?.message || `Could not regenerate ${section}.`,
        );
      }
      setVariation(nextVariation);
      setPending({ section, patch: body.patch });
    } catch (err) {
      setRegenError(
        err instanceof Error ? err.message : "Regeneration failed.",
      );
    } finally {
      setRegenerating(null);
    }
  }

  function acceptPending() {
    if (!pending) return;
    onDraftChange(applySectionPatch(draft, pending.patch));
    setPending(null);
  }

  function keepCurrent() {
    setPending(null);
  }

  const previewDraft = pending
    ? applySectionPatch(draft, pending.patch)
    : draft;

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
        {draft.layoutPreset ? (
          <p className="mt-2 text-xs text-muted">
            Layout: {draft.layoutPreset.label} · {draft.layoutPreset.heroLayout}{" "}
            hero · {draft.brand.headingFont}/{draft.brand.bodyFont}
          </p>
        ) : null}
      </div>

      {draft.contrastWarnings.length > 0 ? (
        <div
          className="space-y-1 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3"
          role="status"
        >
          <p className="text-sm font-medium text-amber-100">
            Contrast warnings
          </p>
          {draft.contrastWarnings.map((warning) => (
            <p
              key={`${warning.code}-${warning.message}`}
              className="text-sm text-amber-100/90"
            >
              {warning.message}
            </p>
          ))}
        </div>
      ) : null}

      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-foreground">Hero</h3>
          <Button
            type="button"
            variant="secondary"
            className="!px-3 !py-1.5 text-xs"
            disabled={Boolean(regenerating) || creating || createSuccess}
            onClick={() => void handleRegenerate("hero")}
          >
            {regenerating === "hero" ? "Regenerating…" : "Regenerate Hero"}
          </Button>
        </div>
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
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-foreground">
            {draft.aboutTitle}
          </h3>
          <Button
            type="button"
            variant="secondary"
            className="!px-3 !py-1.5 text-xs"
            disabled={Boolean(regenerating) || creating || createSuccess}
            onClick={() => void handleRegenerate("about")}
          >
            {regenerating === "about" ? "Regenerating…" : "Regenerate About"}
          </Button>
        </div>
        <p className="text-sm leading-relaxed text-muted">{draft.aboutBody}</p>
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-foreground">Services</h3>
          <Button
            type="button"
            variant="secondary"
            className="!px-3 !py-1.5 text-xs"
            disabled={Boolean(regenerating) || creating || createSuccess}
            onClick={() => void handleRegenerate("services")}
          >
            {regenerating === "services"
              ? "Regenerating…"
              : "Regenerate Services"}
          </Button>
        </div>
        <ul className="space-y-3">
          {draft.services.map((service) => (
            <li key={service.title} className="rounded-xl border border-border/70 p-3">
              <p className="font-medium text-foreground">{service.title}</p>
              <p className="mt-1 text-sm text-muted">{service.description}</p>
            </li>
          ))}
        </ul>
      </div>

      {draft.enabledSections.length > 0 ? (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-foreground">
            Optional sections
          </h3>
          <ul className="flex flex-wrap gap-2 text-xs text-muted">
            {draft.enabledSections.map((id) => (
              <li
                key={id}
                className="rounded-lg border border-border px-2 py-1"
              >
                {AI_OPTIONAL_SECTION_LABELS[id as AiOptionalSectionId] || id}
              </li>
            ))}
          </ul>
          {draft.optionalSections.testimonials?.length ? (
            <p className="text-sm text-muted">
              “{draft.optionalSections.testimonials[0]?.quote}”
            </p>
          ) : null}
        </div>
      ) : null}

      {draft.mediaPlaceholders.gallery.length > 0 ||
      draft.mediaPlaceholders.hero ? (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-foreground">
            Media placeholders
          </h3>
          <p className="text-sm text-muted">
            Hero: {draft.mediaPlaceholders.hero.label} (
            {draft.mediaPlaceholders.hero.category})
          </p>
          {draft.mediaPlaceholders.gallery.length > 0 ? (
            <ul className="list-disc pl-5 text-sm text-muted">
              {draft.mediaPlaceholders.gallery.slice(0, 4).map((item) => (
                <li key={item.id}>{item.label}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

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

      {pending ? (
        <div
          className="space-y-4 rounded-2xl border border-accent/40 bg-accent-soft/30 p-4"
          role="region"
          aria-labelledby="ai-draft-compare-title"
        >
          <div>
            <h3
              id="ai-draft-compare-title"
              className="text-sm font-semibold text-foreground"
            >
              Compare {SECTION_LABELS[pending.section]}
            </h3>
            <p className="mt-1 text-sm text-muted">
              Review the regenerated copy before replacing the current section.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-border bg-surface/60 p-3">
              <p className="text-xs uppercase tracking-wide text-muted">
                Current
              </p>
              <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">
                {sectionSummary(pending.section, draft)}
              </p>
            </div>
            <div className="rounded-xl border border-accent/50 bg-surface/60 p-3">
              <p className="text-xs uppercase tracking-wide text-accent">
                Regenerated
              </p>
              <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">
                {sectionSummary(pending.section, previewDraft)}
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button type="button" onClick={acceptPending}>
              Accept
            </Button>
            <Button type="button" variant="secondary" onClick={keepCurrent}>
              Keep Current
            </Button>
          </div>
        </div>
      ) : null}

      {regenError ? (
        <p className="text-sm text-red-300" role="alert">
          {regenError}
        </p>
      ) : null}

      <div className="space-y-3 border-t border-border pt-4">
        <p className="text-sm text-muted">
          Looks good? Create a new editable website in the Atlas editor. Your
          current project is left unchanged.
        </p>
        <AiCreateWebsiteButton
          loading={creating}
          disabled={creating || createSuccess || Boolean(pending)}
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
