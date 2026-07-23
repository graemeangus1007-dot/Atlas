"use client";

import EditableText from "@/components/editor/editable-text";
import PreviewSection from "@/components/preview/section";
import { cardStyleClass } from "@/lib/templates";
import type { CardStyle, FooterLayout } from "@/lib/templates";
import type { ProjectContact } from "@/types/business-project";

type EditorContactProps = {
  contact: ProjectContact;
  onChange: (patch: Partial<ProjectContact>) => void;
  footerLayout?: FooterLayout;
  cardStyle?: CardStyle;
};

/**
 * Editable contact section — title, description, phone, email, location.
 */
export default function EditorContact({
  contact,
  onChange,
  footerLayout = "centered",
  cardStyle = "elevated",
}: EditorContactProps) {
  const detailFields = [
    {
      key: "phone" as const,
      label: "Phone",
      value: contact.phone,
      breakClass: "break-words [overflow-wrap:anywhere]",
    },
    {
      key: "email" as const,
      label: "Email",
      value: contact.email,
      breakClass: "break-all [overflow-wrap:anywhere]",
    },
    {
      key: "location" as const,
      label: "Location",
      value: contact.location,
      breakClass: "break-words [overflow-wrap:anywhere]",
    },
  ];

  const headingAlign =
    footerLayout === "split" || footerLayout === "minimal"
      ? "text-left"
      : "text-center";

  return (
    <PreviewSection id="contact" bordered={false}>
      <div className="rounded-3xl border border-border bg-surface/70 px-6 py-12 sm:px-10 sm:py-14">
        <div className={`mx-auto max-w-2xl ${headingAlign}`}>
          <p className="text-sm font-medium uppercase tracking-wide text-[color:var(--site-accent)]">
            Contact
          </p>
          <EditableText
            as="h2"
            value={contact.title}
            onChange={(title) => onChange({ title })}
            aria-label="Contact section title"
            className="site-heading atlas-display-text mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl"
          />
          <EditableText
            as="p"
            multiline
            value={contact.description}
            onChange={(description) => onChange({ description })}
            aria-label="Contact section description"
            className="mt-4 text-base text-muted"
          />
        </div>

        <dl
          className={`mx-auto mt-10 grid max-w-3xl items-stretch gap-4 ${
            footerLayout === "stacked" || footerLayout === "minimal"
              ? "grid-cols-1"
              : footerLayout === "split"
                ? "grid-cols-1"
                : "grid-cols-1 sm:grid-cols-3"
          }`}
        >
          {detailFields.map((field) => (
            <div
              key={field.key}
              className={`flex h-full min-h-[7.5rem] min-w-0 flex-col items-center justify-center rounded-2xl border p-5 text-center ${cardStyleClass(cardStyle)}`}
            >
              <dt className="shrink-0 text-xs font-medium uppercase tracking-wide text-muted">
                {field.label}
              </dt>
              <dd
                title={field.value}
                className={`mt-2 w-full max-w-full ${field.breakClass}`}
              >
                <EditableText
                  as="span"
                  value={field.value}
                  onChange={(value) => onChange({ [field.key]: value })}
                  aria-label={`Contact ${field.label.toLowerCase()}`}
                  className="block text-sm font-medium leading-snug text-foreground"
                />
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </PreviewSection>
  );
}
