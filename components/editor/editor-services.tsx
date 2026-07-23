"use client";

import EditableText from "@/components/editor/editable-text";
import SectionHeading from "@/components/preview/section-heading";
import PreviewSection from "@/components/preview/section";
import { cardStyleClass } from "@/lib/templates";
import type { CardStyle } from "@/lib/templates";
import type { AiContentField } from "@/types/ai";
import type { WebsiteService } from "@/types/website-content";

type EditorServicesProps = {
  services: WebsiteService[];
  cardStyle?: CardStyle;
  onServiceChange: (
    index: number,
    patch: Partial<WebsiteService>,
  ) => void;
  onImproveField: (
    field: AiContentField,
    label: string,
    value: string,
    serviceIndex?: number,
  ) => void;
};

/**
 * Editable services grid with Improve with AI on title + description.
 */
export default function EditorServices({
  services,
  cardStyle = "elevated",
  onServiceChange,
  onImproveField,
}: EditorServicesProps) {
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
            key={`service-${index}`}
            className={`rounded-2xl border p-6 transition-all duration-200 hover:border-[color:var(--site-accent)]/40 ${cardStyleClass(cardStyle)}`}
          >
            <EditableText
              as="h2"
              value={service.title}
              onChange={(title) => onServiceChange(index, { title })}
              aria-label={`Service ${index + 1} title`}
              className="site-heading atlas-display-text text-xl font-semibold text-foreground"
              onImproveWithAi={(value) =>
                onImproveField(
                  "serviceTitle",
                  `Service ${index + 1} Title`,
                  value,
                  index,
                )
              }
            />
            <EditableText
              as="p"
              multiline
              value={service.description}
              onChange={(description) =>
                onServiceChange(index, { description })
              }
              aria-label={`Service ${index + 1} description`}
              className="mt-3 text-sm leading-relaxed text-muted"
              onImproveWithAi={(value) =>
                onImproveField(
                  "serviceDescription",
                  `Service ${index + 1} Description`,
                  value,
                  index,
                )
              }
            />
          </li>
        ))}
      </ul>
    </PreviewSection>
  );
}
