type SectionHeadingProps = {
  eyebrow: string;
  title: string;
  description?: string;
  align?: "left" | "center";
  accentClassName?: string;
};

/**
 * Consistent eyebrow + title (+ optional description) used across preview sections.
 */
export default function SectionHeading({
  eyebrow,
  title,
  description,
  align = "center",
  accentClassName = "text-accent",
}: SectionHeadingProps) {
  const alignment =
    align === "center" ? "mx-auto max-w-2xl text-center" : "text-left";

  return (
    <div className={alignment}>
      <p
        className={`text-sm font-medium uppercase tracking-wide ${accentClassName}`}
      >
        {eyebrow}
      </p>
      <h2 className="site-heading atlas-display-text mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
        {title}
      </h2>
      {description ? (
        <p className="mt-4 text-base text-muted">{description}</p>
      ) : null}
    </div>
  );
}
