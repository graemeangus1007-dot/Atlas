import SectionHeading from "@/components/preview/section-heading";
import PreviewSection from "@/components/preview/section";
import { cardStyleClass } from "@/lib/templates";
import type { CardStyle } from "@/lib/templates";
import type { WebsiteService } from "@/types/website-content";

type PreviewServicesProps = {
  services: WebsiteService[];
  cardStyle?: CardStyle;
};

/**
 * Service cards — card style from the active template.
 */
export default function PreviewServices({
  services,
  cardStyle = "elevated",
}: PreviewServicesProps) {
  return (
    <PreviewSection id="services">
      <SectionHeading
        eyebrow="Services"
        title="What we offer"
        accentClassName="text-[color:var(--site-accent)]"
      />

      <ul className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {services.map((service) => (
          <li
            key={service.title}
            className={`rounded-2xl border p-6 transition-all duration-200 hover:-translate-y-0.5 hover:border-[color:var(--site-accent)]/40 ${cardStyleClass(cardStyle)}`}
          >
            <h3 className="site-heading atlas-display-text text-xl font-semibold text-foreground">
              {service.title}
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-muted">
              {service.description}
            </p>
          </li>
        ))}
      </ul>
    </PreviewSection>
  );
}
