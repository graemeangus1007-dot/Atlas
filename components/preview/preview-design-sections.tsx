type PreviewDesignSectionsProps = {
  sections: NonNullable<
    import("@/types/website-content").GeneratedWebsiteContent["designSections"]
  >;
  cardStyle: string;
};

/**
 * Renders optional Design Assistant sections (testimonials, FAQ, etc.).
 */
export default function PreviewDesignSections({
  sections,
  cardStyle,
}: PreviewDesignSectionsProps) {
  const card =
    cardStyle === "elevated"
      ? "border border-border/60 bg-surface shadow-sm"
      : cardStyle === "glass"
        ? "border border-white/10 bg-white/5 backdrop-blur"
        : cardStyle === "bordered"
          ? "border border-border bg-transparent"
          : "bg-surface/80";

  return (
    <>
      {sections.enabled.includes("testimonials") && sections.testimonials?.length ? (
        <section className="site-section site-section-bordered px-6 py-16">
          <div className="mx-auto max-w-5xl">
            <h2 className="font-[family-name:var(--font-atlas-display)] text-2xl font-semibold text-foreground">
              What customers say
            </h2>
            <div className="mt-8 grid gap-4 md:grid-cols-2">
              {sections.testimonials.map((item, index) => (
                <blockquote
                  key={`${item.author}-${index}`}
                  className={`rounded-2xl p-5 ${card}`}
                >
                  <p className="text-sm leading-relaxed text-foreground/90">
                    “{item.quote}”
                  </p>
                  <footer className="mt-4 text-xs text-muted">
                    <span className="font-medium text-foreground">{item.author}</span>
                    {item.role ? ` · ${item.role}` : null}
                  </footer>
                </blockquote>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {sections.enabled.includes("faq") && sections.faq?.length ? (
        <section className="site-section px-6 py-16">
          <div className="mx-auto max-w-3xl">
            <h2 className="font-[family-name:var(--font-atlas-display)] text-2xl font-semibold text-foreground">
              Frequently asked questions
            </h2>
            <div className="mt-8 space-y-4">
              {sections.faq.map((item, index) => (
                <details
                  key={`${item.question}-${index}`}
                  className={`rounded-2xl p-4 ${card}`}
                >
                  <summary className="cursor-pointer text-sm font-medium text-foreground">
                    {item.question}
                  </summary>
                  <p className="mt-3 text-sm leading-relaxed text-muted">
                    {item.answer}
                  </p>
                </details>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {sections.enabled.includes("team") && sections.team?.length ? (
        <section className="site-section site-section-bordered px-6 py-16">
          <div className="mx-auto max-w-5xl">
            <h2 className="font-[family-name:var(--font-atlas-display)] text-2xl font-semibold text-foreground">
              Meet the team
            </h2>
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              {sections.team.map((member, index) => (
                <div key={`${member.name}-${index}`} className={`rounded-2xl p-5 ${card}`}>
                  <p className="font-medium text-foreground">{member.name}</p>
                  <p className="text-xs text-muted">{member.role}</p>
                  <p className="mt-2 text-sm text-muted">{member.bio}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {sections.enabled.includes("pricing") && sections.pricing?.length ? (
        <section className="site-section px-6 py-16">
          <div className="mx-auto max-w-5xl">
            <h2 className="font-[family-name:var(--font-atlas-display)] text-2xl font-semibold text-foreground">
              Pricing
            </h2>
            <div className="mt-8 grid gap-4 md:grid-cols-2">
              {sections.pricing.map((plan, index) => (
                <div key={`${plan.name}-${index}`} className={`rounded-2xl p-5 ${card}`}>
                  <p className="font-medium text-foreground">{plan.name}</p>
                  <p className="mt-1 text-lg text-[color:var(--site-accent)]">
                    {plan.price}
                  </p>
                  <p className="mt-2 text-sm text-muted">{plan.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {sections.enabled.includes("bookingCta") && sections.bookingCta ? (
        <section className="site-section site-section-bordered px-6 py-16">
          <div className={`mx-auto max-w-3xl rounded-2xl p-8 text-center ${card}`}>
            <h2 className="text-2xl font-semibold text-foreground">
              {sections.bookingCta.title}
            </h2>
            <p className="mt-3 text-sm text-muted">{sections.bookingCta.body}</p>
            <button
              type="button"
              className="mt-6 rounded-[var(--site-button-radius)] bg-[color:var(--site-accent)] px-5 py-2.5 text-sm font-medium text-white"
            >
              {sections.bookingCta.buttonText}
            </button>
          </div>
        </section>
      ) : null}

      {sections.enabled.includes("newsletter") && sections.newsletter ? (
        <section className="site-section px-6 py-16">
          <div className={`mx-auto max-w-3xl rounded-2xl p-8 text-center ${card}`}>
            <h2 className="text-2xl font-semibold text-foreground">
              {sections.newsletter.title}
            </h2>
            <p className="mt-3 text-sm text-muted">{sections.newsletter.body}</p>
            <button
              type="button"
              className="mt-6 rounded-[var(--site-button-radius)] bg-[color:var(--site-accent)] px-5 py-2.5 text-sm font-medium text-white"
            >
              {sections.newsletter.buttonText}
            </button>
          </div>
        </section>
      ) : null}
    </>
  );
}
