import Button from "@/components/ui/button";
import { heroSectionClass } from "@/lib/templates";
import type { HeroLayout } from "@/lib/templates";
import type { GeneratedWebsiteContent } from "@/types/website-content";

type PreviewHeroProps = {
  content: GeneratedWebsiteContent["hero"];
  heroLayout?: HeroLayout;
};

/**
 * Generated homepage hero — layout variant comes from the active template.
 */
export default function PreviewHero({
  content,
  heroLayout = "centered",
}: PreviewHeroProps) {
  const sectionClass = heroSectionClass(heroLayout);

  if (heroLayout === "split") {
    return (
      <section
        id="home"
        className={`relative isolate overflow-hidden border-b border-border ${sectionClass}`}
      >
        <div
          className="site-shell grid items-center gap-10 lg:grid-cols-2"
          data-testid="preview-hero"
          data-hero-placeholder={content.isPlaceholder ? "true" : "false"}
        >
          <div className="relative z-10 text-left">
            {content.eyebrow?.trim() ? (
              <p className="text-sm font-medium uppercase tracking-wide text-[color:var(--site-accent)]">
                {content.eyebrow}
              </p>
            ) : null}
            <h1
              className={`site-heading atlas-display-text text-4xl font-semibold tracking-tight text-foreground sm:text-5xl ${
                content.eyebrow?.trim() ? "mt-4" : ""
              }`}
            >
              {content.headline}
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-muted sm:text-lg">
              {content.subheadline}
            </p>
            <div className="mt-10 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
              <Button
                href="#contact"
                className="site-button bg-[color:var(--site-accent)] px-8 py-3.5 text-[color:var(--site-bg)] hover:bg-[color:var(--site-accent)] hover:brightness-110"
              >
                {content.primaryCta}
              </Button>
              <Button
                href="#about"
                variant="secondary"
                className="site-button px-8 py-3.5"
              >
                {content.secondaryCta}
              </Button>
            </div>
          </div>
          <div className="relative aspect-[4/3] overflow-hidden rounded-3xl border border-border">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={content.imageUrl}
              alt=""
              className="site-hero-image h-full w-full"
            />
            <div className="site-hero-overlay absolute inset-0 opacity-30" />
          </div>
        </div>
      </section>
    );
  }

  const alignClass =
    heroLayout === "bold-overlay" ? "text-left" : "text-center";
  const titleSize =
    heroLayout === "bold-overlay"
      ? "text-5xl sm:text-6xl md:text-7xl"
      : heroLayout === "minimal"
        ? "text-3xl sm:text-4xl md:text-5xl"
        : "text-4xl sm:text-5xl md:text-6xl";

  return (
    <section
      id="home"
      className={`relative isolate overflow-hidden border-b border-border ${sectionClass}`}
    >
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={content.imageUrl}
          alt=""
          className="site-hero-image h-full w-full"
        />
        <div
          className={`site-hero-overlay absolute inset-0 ${
            heroLayout === "bold-overlay" ? "opacity-80" : ""
          }`}
        />
        <div className="site-hero-gradient absolute inset-0" aria-hidden="true" />
        <div
          className="site-hero-text-scrim absolute inset-x-0 bottom-0"
          aria-hidden="true"
        />
        {heroLayout !== "minimal" ? (
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,var(--site-accent-soft),transparent_55%)]" />
        ) : null}
        {heroLayout === "centered" ? (
          <div className="atlas-hero-grid absolute inset-0 opacity-15" />
        ) : null}
      </div>

      <div
        className={`site-shell relative z-10 px-0 ${alignClass}`}
        data-testid="preview-hero"
        data-hero-placeholder={content.isPlaceholder ? "true" : "false"}
      >
        {content.eyebrow?.trim() ? (
          <p className="text-sm font-medium uppercase tracking-wide text-[color:var(--site-accent)]">
            {content.eyebrow}
          </p>
        ) : null}
        <h1
          className={`site-heading atlas-display-text font-semibold tracking-tight text-foreground ${titleSize} ${
            content.eyebrow?.trim() ? "mt-4" : ""
          }`}
        >
          {content.headline}
        </h1>
        <p
          className={`mt-5 text-base leading-relaxed text-muted sm:text-lg ${
            heroLayout === "bold-overlay" ? "max-w-xl" : "mx-auto max-w-2xl"
          }`}
        >
          {content.subheadline}
        </p>
        <div
          className={`mt-10 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center ${
            heroLayout === "bold-overlay"
              ? "justify-start"
              : "justify-center"
          }`}
        >
          <Button
            href="#contact"
            className="site-button bg-[color:var(--site-accent)] px-8 py-3.5 text-[color:var(--site-bg)] hover:bg-[color:var(--site-accent)] hover:brightness-110"
          >
            {content.primaryCta}
          </Button>
          <Button
            href="#about"
            variant="secondary"
            className="site-button px-8 py-3.5"
          >
            {content.secondaryCta}
          </Button>
        </div>
      </div>
    </section>
  );
}
