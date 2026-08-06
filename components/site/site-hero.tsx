"use client";

import type { CSSProperties, ReactNode } from "react";
import Button from "@/components/ui/button";
import {
  buildHeroRenderPlan,
  type HeroComposition,
} from "@/lib/hero-composition";
import type { GeneratedWebsiteContent } from "@/types/website-content";

export type SiteHeroSlots = {
  eyebrow?: ReactNode;
  headline?: ReactNode;
  subheadline?: ReactNode;
  primaryCta?: ReactNode;
  secondaryCta?: ReactNode;
};

type SiteHeroProps = {
  content: GeneratedWebsiteContent["hero"];
  composition: HeroComposition;
  /** test id root — editor uses editor-hero, preview uses preview-hero */
  testId?: string;
  /** Optional editable replacements for text nodes */
  slots?: SiteHeroSlots;
};

function dataAttrProps(attrs: Record<string, string>) {
  return attrs as Record<string, string>;
}

/**
 * Shared hero renderer for Editor, Preview, and (structurally) Publish.
 * All layout decisions come from the resolved HeroComposition.
 */
export default function SiteHero({
  content,
  composition,
  testId = "site-hero",
  slots,
}: SiteHeroProps) {
  const plan = buildHeroRenderPlan(composition);
  const eyebrowText = content.eyebrow?.trim() || "";
  const showSecondary =
    composition.typography.showSecondaryCta &&
    Boolean(content.secondaryCta?.trim());

  const eyebrowNode =
    slots?.eyebrow !== undefined ? (
      slots.eyebrow
    ) : eyebrowText ? (
      <p className="text-sm font-medium uppercase tracking-wide text-[color:var(--site-accent)]">
        {eyebrowText}
      </p>
    ) : null;

  const headlineNode = slots?.headline ?? (
    <h1
      className={`site-heading atlas-display-text font-semibold tracking-tight text-foreground ${plan.titleSizeClass} ${
        eyebrowText || slots?.eyebrow ? "mt-4" : ""
      }`}
    >
      {content.headline}
    </h1>
  );

  const subheadlineNode = slots?.subheadline ?? (
    <p
      className={`mt-5 text-base leading-relaxed text-muted sm:text-lg ${plan.ledeWidthClass}`}
    >
      {content.subheadline}
    </p>
  );

  const primaryCtaNode = slots?.primaryCta ?? (
    <Button
      href="#contact"
      className="site-button bg-[color:var(--site-accent)] px-8 py-3.5 text-[color:var(--site-bg)] hover:bg-[color:var(--site-accent)] hover:brightness-110"
    >
      {content.primaryCta}
    </Button>
  );

  const secondaryCtaNode = showSecondary
    ? (slots?.secondaryCta ?? (
        <Button
          href="#about"
          variant="secondary"
          className="site-button px-8 py-3.5"
        >
          {content.secondaryCta}
        </Button>
      ))
    : null;

  const actions = (
    <div
      className={`mt-10 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center ${plan.ctaJustifyClass}`}
    >
      {primaryCtaNode}
      {secondaryCtaNode}
    </div>
  );

  if (plan.variant === "split") {
    return (
      <section
        id="home"
        className={`relative isolate overflow-hidden border-b border-border ${plan.sectionClassName}`}
        data-testid={testId}
        data-hero-placeholder={content.isPlaceholder ? "true" : "false"}
        {...dataAttrProps(plan.dataAttributes)}
        style={plan.cssVars as CSSProperties}
      >
        <div className="site-shell grid items-center gap-10 lg:grid-cols-2">
          <div
            className={`relative z-10 ${plan.contentAlignClass}`}
            data-hero-content="true"
          >
            {eyebrowNode}
            {headlineNode}
            {subheadlineNode}
            {actions}
          </div>
          <div className="relative aspect-[4/3] overflow-hidden rounded-3xl border border-border">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={content.imageUrl}
              alt=""
              className="site-hero-image h-full w-full"
              data-testid={testId === "editor-hero" ? "editor-hero-image" : undefined}
            />
            <div className="site-hero-overlay absolute inset-0" aria-hidden="true" />
            <div
              className="site-hero-gradient absolute inset-0"
              aria-hidden="true"
            />
            <div
              className="site-hero-text-scrim absolute inset-x-0 bottom-0"
              aria-hidden="true"
            />
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      id="home"
      className={`relative isolate overflow-hidden border-b border-border ${plan.sectionClassName}`}
      data-testid={testId}
      data-hero-placeholder={content.isPlaceholder ? "true" : "false"}
      {...dataAttrProps(plan.dataAttributes)}
      style={plan.cssVars as CSSProperties}
    >
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={content.imageUrl}
          alt=""
          className="site-hero-image h-full w-full"
          data-testid={testId === "editor-hero" ? "editor-hero-image" : undefined}
        />
        <div className="site-hero-overlay absolute inset-0" />
        <div className="site-hero-gradient absolute inset-0" aria-hidden="true" />
        <div
          className="site-hero-text-scrim absolute inset-x-0 bottom-0"
          aria-hidden="true"
        />
        {composition.accents.showAccentWash ? (
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,var(--site-accent-soft),transparent_55%)]" />
        ) : null}
        {composition.accents.showGrid ? (
          <div className="atlas-hero-grid absolute inset-0 opacity-15" />
        ) : null}
      </div>

      <div
        className={`site-shell relative z-10 px-0 ${plan.contentAlignClass}`}
        data-hero-content="true"
      >
        {eyebrowNode}
        {headlineNode}
        {subheadlineNode}
        {actions}
      </div>
    </section>
  );
}
