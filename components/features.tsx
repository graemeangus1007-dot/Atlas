const FEATURES = [
  {
    icon: "⚡",
    title: "AI Website Builder",
    description:
      "Generate a complete website from a few simple questions.",
  },
  {
    icon: "🎨",
    title: "Easy Customization",
    description:
      "Edit text, colors, images, and layouts without code.",
  },
  {
    icon: "🚀",
    title: "One-Click Publishing",
    description:
      "Launch your website with a custom domain in minutes.",
  },
] as const;

/**
 * Feature grid — three product pillars presented as interactive-looking cards.
 */
export default function Features() {
  return (
    <section
      id="features"
      className="scroll-mt-20 border-t border-border px-5 py-24 sm:px-8 sm:py-28"
    >
      <div className="mx-auto max-w-6xl">
        {/* Section intro */}
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="atlas-display-text font-[family-name:var(--font-atlas-display)] text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            Everything you need to launch
          </h2>
          <p className="mt-4 text-base leading-relaxed text-muted sm:text-lg">
            From first draft to live site — Atlas handles the hard parts so you
            can focus on your business.
          </p>
        </div>

        {/* Feature cards */}
        <ul className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
          {FEATURES.map((feature) => (
            <li
              key={feature.title}
              className="group rounded-2xl border border-border bg-surface/60 p-7 transition-all duration-300 hover:-translate-y-1 hover:border-accent/40 hover:bg-surface hover:shadow-[0_20px_40px_-24px_rgba(61,184,168,0.45)]"
            >
              <span
                className="flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-white/[0.03] text-xl transition-colors duration-300 group-hover:border-accent/30 group-hover:bg-accent-soft"
                aria-hidden="true"
              >
                {feature.icon}
              </span>
              <h3 className="atlas-display-text mt-5 font-[family-name:var(--font-atlas-display)] text-lg font-semibold tracking-tight text-foreground">
                {feature.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                {feature.description}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
