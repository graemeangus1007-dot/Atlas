type PlaceholderSectionProps = {
  id: string;
  title: string;
  description: string;
};

/**
 * Visible landing-page placeholder so nav hash links have real scroll targets.
 */
export default function PlaceholderSection({
  id,
  title,
  description,
}: PlaceholderSectionProps) {
  return (
    <section
      id={id}
      className="scroll-mt-20 border-t border-border px-5 py-20 sm:px-8 sm:py-24"
    >
      <div className="mx-auto max-w-3xl text-center">
        <h2 className="atlas-display-text font-[family-name:var(--font-atlas-display)] text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          {title}
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-muted sm:text-lg">
          {description}
        </p>
      </div>
    </section>
  );
}
