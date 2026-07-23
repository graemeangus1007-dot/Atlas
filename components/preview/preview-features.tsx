import SectionHeading from "@/components/preview/section-heading";
import PreviewSection from "@/components/preview/section";
import { cardStyleClass } from "@/lib/templates";
import type { CardStyle } from "@/lib/templates";
import type { WebsiteFeature } from "@/types/website-content";

type PreviewFeaturesProps = {
  features: WebsiteFeature[];
  cardStyle?: CardStyle;
};

/**
 * Feature cards — card style from the active template.
 */
export default function PreviewFeatures({
  features,
  cardStyle = "elevated",
}: PreviewFeaturesProps) {
  return (
    <PreviewSection id="features">
      <SectionHeading
        eyebrow="Why choose us"
        title="What makes us different"
        accentClassName="text-[color:var(--site-accent)]"
      />

      <ul className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((feature) => (
          <li
            key={feature.title}
            className={`rounded-2xl border p-6 transition-all duration-200 hover:-translate-y-0.5 hover:border-[color:var(--site-accent)]/40 ${cardStyleClass(cardStyle)}`}
          >
            <span
              className="mb-4 block h-1.5 w-10 rounded-full bg-[color:var(--site-accent)]"
              aria-hidden="true"
            />
            <h3 className="site-heading atlas-display-text text-xl font-semibold text-foreground">
              {feature.title}
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-muted">
              {feature.description}
            </p>
          </li>
        ))}
      </ul>
    </PreviewSection>
  );
}
