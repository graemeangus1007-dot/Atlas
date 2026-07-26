"use client";

import { useEffect, useRef } from "react";
import ContactFormNotifications from "@/components/editor/contact-form-notifications";
import EditableText from "@/components/editor/editable-text";
import PreviewSection from "@/components/preview/section";
import { cardStyleClass } from "@/lib/templates";
import type { CardStyle, FooterLayout } from "@/lib/templates";
import type { ProjectContact } from "@/types/business-project";

type EditorContactProps = {
  contact: ProjectContact;
  onChange: (patch: Partial<ProjectContact>) => void;
  projectId?: string | null;
  footerLayout?: FooterLayout;
  cardStyle?: CardStyle;
};

const DEFAULT_BUTTON = "Send message";
const DEFAULT_SUCCESS =
  "Thanks — we received your message and will get back to you soon.";

/**
 * Editable contact section — details + configurable lead form.
 */
export default function EditorContact({
  contact,
  onChange,
  projectId = null,
  footerLayout = "centered",
  cardStyle = "elevated",
}: EditorContactProps) {
  const ensuringRef = useRef(false);
  const ensuredProjectRef = useRef<string | null>(null);

  // Ensure a lead_forms row once per project. Only write formId — never reset
  // buttonText / successMessage from lead_forms metadata on every render.
  useEffect(() => {
    if (!projectId) return;
    if (contact.formId) {
      ensuredProjectRef.current = projectId;
      return;
    }
    if (ensuringRef.current) return;
    if (ensuredProjectRef.current === projectId) return;

    ensuringRef.current = true;
    void (async () => {
      try {
        const res = await fetch("/api/forms/ensure", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId,
            name: "Contact form",
          }),
        });
        const data = (await res.json()) as { form?: { id: string } };
        if (res.ok && data.form?.id) {
          ensuredProjectRef.current = projectId;
          // Only attach the id — leave editable copy fields alone.
          onChange({ formId: data.form.id });
        }
      } catch {
        // Autosave / publish can retry ensure later.
      } finally {
        ensuringRef.current = false;
      }
    })();
    // Intentionally omit onChange — only ensure once until formId exists.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, contact.formId]);

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

  const formEnabled = contact.formEnabled !== false;
  // Controlled values — use "" when unset so typing is never forced back to a
  // fallback string via `value={x || "default"}`.
  const buttonTextValue =
    contact.buttonText ?? contact.formButtonText ?? DEFAULT_BUTTON;
  const successMessageValue =
    contact.successMessage ?? contact.formSuccessMessage ?? DEFAULT_SUCCESS;

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

        <div className="mx-auto mt-10 max-w-xl rounded-2xl border border-border bg-background/40 p-5 text-left">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">
            Contact form
          </p>
          <p className="mt-1 text-xs text-muted">
            Submissions appear in Leads. The published site connects automatically.
          </p>

          <label className="mt-4 flex items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={formEnabled}
              onChange={(e) => onChange({ formEnabled: e.target.checked })}
            />
            Enable contact form
          </label>

          {formEnabled ? (
            <div className="mt-4 space-y-3">
              <label className="block text-xs text-muted">
                Button text
                <input
                  type="text"
                  value={buttonTextValue}
                  placeholder={DEFAULT_BUTTON}
                  onChange={(e) => onChange({ buttonText: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
                />
              </label>
              <label className="block text-xs text-muted">
                Success message
                <textarea
                  value={successMessageValue}
                  placeholder={DEFAULT_SUCCESS}
                  onChange={(e) =>
                    onChange({ successMessage: e.target.value })
                  }
                  rows={2}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
                />
              </label>
              <label className="flex items-center gap-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={contact.showPhoneField !== false}
                  onChange={(e) =>
                    onChange({ showPhoneField: e.target.checked })
                  }
                />
                Show phone field
              </label>
              <label className="flex items-center gap-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={Boolean(contact.showCompanyField)}
                  onChange={(e) =>
                    onChange({ showCompanyField: e.target.checked })
                  }
                />
                Show company field
              </label>

              <ContactFormNotifications
                formId={contact.formId}
                projectId={projectId}
              />
            </div>
          ) : null}
        </div>
      </div>
    </PreviewSection>
  );
}
