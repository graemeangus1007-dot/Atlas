import SectionHeading from "@/components/preview/section-heading";
import PreviewSection from "@/components/preview/section";
import { cardStyleClass } from "@/lib/templates";
import type { CardStyle } from "@/lib/templates";
import type { WebsiteService } from "@/types/website-content";

type PreviewServicesProps = {
  services: WebsiteService[];
  cardStyle?: CardStyle;
  /** Creative Director — show visual anchors on each card. */
  showIcons?: boolean;
};

const SERVICE_ICON_PATHS = [
  "M12 2l2.4 7.2H22l-6 4.8 2.4 7.2L12 16.8 3.6 21.2 6 14 0 9.2h7.6L12 2z",
  "M4 6h16v2H4V6zm0 5h16v2H4v-2zm0 5h10v2H4v-2z",
  "M12 3a9 9 0 100 18 9 9 0 000-18zm0 4a2 2 0 110 4 2 2 0 010-4zm0 6c2.2 0 4 1.1 4 2.5V17H8v-1.5C8 14.1 9.8 13 12 13z",
  "M3 7h18v2H3V7zm2 4h14v8H5v-8zm4 2v4h6v-4H9z",
  "M12 2C8 2 5 5.5 5 10c0 5 7 12 7 12s7-7 7-12c0-4.5-3-8-7-8zm0 10.5a2.5 2.5 0 110-5 2.5 2.5 0 010 5z",
  "M4 4h7v7H4V4zm9 0h7v7h-7V4zM4 13h7v7H4v-7zm9 0h7v7h-7v-7z",
];

/**
 * Service cards — card style from the active template.
 */
export default function PreviewServices({
  services,
  cardStyle = "elevated",
  showIcons = false,
}: PreviewServicesProps) {
  return (
    <PreviewSection id="services">
      <SectionHeading
        eyebrow="Services"
        title="What we offer"
        accentClassName="text-[color:var(--site-accent)]"
      />

      <ul className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {services.map((service, index) => (
          <li
            key={service.title}
            className={`site-motion-card rounded-2xl border p-6 transition-all duration-200 hover:-translate-y-0.5 hover:border-[color:var(--site-accent)]/40 ${cardStyleClass(cardStyle)}`}
          >
            {showIcons ? (
              <span
                className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[color:var(--site-accent-soft)] text-[color:var(--site-accent)]"
                aria-hidden="true"
                data-testid="service-icon"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current">
                  <path
                    d={
                      SERVICE_ICON_PATHS[index % SERVICE_ICON_PATHS.length] ??
                      SERVICE_ICON_PATHS[0]
                    }
                  />
                </svg>
              </span>
            ) : null}
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
