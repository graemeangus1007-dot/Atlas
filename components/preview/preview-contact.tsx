import SectionHeading from "@/components/preview/section-heading";
import PreviewSection from "@/components/preview/section";
import { cardStyleClass } from "@/lib/templates";
import type { CardStyle, FooterLayout } from "@/lib/templates";
import type { GeneratedWebsiteContent } from "@/types/website-content";

type PreviewContactProps = {
  contact: GeneratedWebsiteContent["contact"];
  footerLayout?: FooterLayout;
  cardStyle?: CardStyle;
};

/**
 * Contact / footer block — layout variant from the active template.
 */
export default function PreviewContact({
  contact,
  footerLayout = "centered",
  cardStyle = "elevated",
}: PreviewContactProps) {
  const details = contact.details.map((detail) => {
    const isEmail = detail.label.toLowerCase() === "email";
    return { ...detail, isEmail };
  });

  if (footerLayout === "split") {
    return (
      <PreviewSection id="contact" bordered={false}>
        <div className="rounded-3xl border border-border bg-surface/70 px-6 py-12 sm:px-10 sm:py-14">
          <div className="grid gap-10 lg:grid-cols-[1fr_1.1fr] lg:items-start">
            <SectionHeading
              eyebrow="Contact"
              title={contact.title}
              description={contact.description}
              align="left"
              accentClassName="text-[color:var(--site-accent)]"
            />
            <dl className="grid gap-4">
              {details.map((detail) => (
                <div
                  key={detail.label}
                  className={`rounded-2xl border p-5 ${cardStyleClass(cardStyle)}`}
                >
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted">
                    {detail.label}
                  </dt>
                  <dd
                    title={detail.value}
                    className={`mt-2 text-sm font-medium text-foreground ${
                      detail.isEmail
                        ? "break-all [overflow-wrap:anywhere]"
                        : "break-words [overflow-wrap:anywhere]"
                    }`}
                  >
                    {detail.value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </PreviewSection>
    );
  }

  if (footerLayout === "stacked" || footerLayout === "minimal") {
    return (
      <PreviewSection id="contact" bordered={false}>
        <div
          className={`border border-border bg-surface/70 px-6 py-10 sm:px-10 ${
            footerLayout === "minimal" ? "rounded-xl py-8" : "rounded-3xl py-12"
          }`}
        >
          <SectionHeading
            eyebrow="Contact"
            title={contact.title}
            description={
              footerLayout === "minimal" ? undefined : contact.description
            }
            align={footerLayout === "minimal" ? "left" : "center"}
            accentClassName="text-[color:var(--site-accent)]"
          />
          <dl
            className={`mt-8 space-y-3 ${
              footerLayout === "minimal" ? "max-w-lg" : "mx-auto max-w-xl"
            }`}
          >
            {details.map((detail) => (
              <div
                key={detail.label}
                className="flex flex-col gap-1 border-b border-border py-3 last:border-b-0 sm:flex-row sm:items-baseline sm:justify-between"
              >
                <dt className="text-xs font-medium uppercase tracking-wide text-muted">
                  {detail.label}
                </dt>
                <dd
                  title={detail.value}
                  className={`text-sm font-medium text-foreground ${
                    detail.isEmail
                      ? "break-all [overflow-wrap:anywhere]"
                      : "break-words [overflow-wrap:anywhere]"
                  }`}
                >
                  {detail.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </PreviewSection>
    );
  }

  const formPreview =
    contact.form?.enabled !== false ? (
      <div className="mx-auto mt-10 max-w-xl rounded-2xl border border-border bg-background/30 p-5 text-left">
        <p className="text-xs font-medium uppercase tracking-wide text-muted">
          Contact form preview
        </p>
        <div className="mt-3 space-y-3">
          <div>
            <p className="text-xs text-muted">Name</p>
            <div className="mt-1 h-9 rounded-lg border border-border bg-surface/50" />
          </div>
          <div>
            <p className="text-xs text-muted">Email</p>
            <div className="mt-1 h-9 rounded-lg border border-border bg-surface/50" />
          </div>
          {contact.form?.showPhoneField !== false ? (
            <div>
              <p className="text-xs text-muted">Phone</p>
              <div className="mt-1 h-9 rounded-lg border border-border bg-surface/50" />
            </div>
          ) : null}
          {contact.form?.showCompanyField ? (
            <div>
              <p className="text-xs text-muted">Company</p>
              <div className="mt-1 h-9 rounded-lg border border-border bg-surface/50" />
            </div>
          ) : null}
          <div>
            <p className="text-xs text-muted">Message</p>
            <div className="mt-1 h-20 rounded-lg border border-border bg-surface/50" />
          </div>
          <div className="inline-flex rounded-xl bg-[color:var(--site-accent)] px-4 py-2 text-sm font-medium text-background">
            {contact.form?.buttonText || "Send message"}
          </div>
        </div>
      </div>
    ) : null;

  return (
    <PreviewSection id="contact" bordered={false}>
      <div className="rounded-3xl border border-border bg-surface/70 px-6 py-12 sm:px-10 sm:py-14">
        <SectionHeading
          eyebrow="Contact"
          title={contact.title}
          description={contact.description}
          accentClassName="text-[color:var(--site-accent)]"
        />

        <dl className="mx-auto mt-10 grid max-w-3xl grid-cols-1 items-stretch gap-4 sm:grid-cols-3">
          {details.map((detail) => (
            <div
              key={detail.label}
              className={`flex h-full min-h-[7.5rem] min-w-0 flex-col items-center justify-center rounded-2xl border p-5 text-center ${cardStyleClass(cardStyle)}`}
            >
              <dt className="shrink-0 text-xs font-medium uppercase tracking-wide text-muted">
                {detail.label}
              </dt>
              <dd
                title={detail.value}
                className={`mt-2 w-full max-w-full text-sm font-medium leading-snug text-foreground ${
                  detail.isEmail
                    ? "break-all [overflow-wrap:anywhere]"
                    : "break-words [overflow-wrap:anywhere]"
                }`}
              >
                {detail.value}
              </dd>
            </div>
          ))}
        </dl>
        {formPreview}
      </div>
    </PreviewSection>
  );
}
