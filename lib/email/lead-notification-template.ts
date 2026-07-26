import { escapeHtml } from "@/lib/leads/sanitize";
import { DEFAULT_EMAIL_SUBJECT_TEMPLATE } from "@/lib/leads/types";

export type LeadNotificationContent = {
  leadName: string;
  leadEmail: string;
  leadPhone: string | null;
  leadCompany: string | null;
  leadMessage: string;
  projectName: string;
  submittedAt: string;
  /** Absolute Atlas URL to open this lead — must already be validated. */
  leadUrl: string;
  subjectTemplate?: string | null;
};

function applySubjectTemplate(
  template: string,
  vars: Record<string, string>,
): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key: string) => {
    return vars[key] ?? "";
  });
}

export function buildLeadNotificationSubject(
  content: LeadNotificationContent,
): string {
  const template =
    content.subjectTemplate?.trim() || DEFAULT_EMAIL_SUBJECT_TEMPLATE;
  const subject = applySubjectTemplate(template, {
    name: content.leadName,
    email: content.leadEmail,
    project: content.projectName,
    phone: content.leadPhone || "",
    company: content.leadCompany || "",
  }).trim();
  return subject.slice(0, 200) || DEFAULT_EMAIL_SUBJECT_TEMPLATE;
}

/**
 * Build HTML + plain-text bodies. All lead fields are HTML-escaped.
 * Never include IP hashes or provider secrets.
 */
export function buildLeadNotificationEmail(content: LeadNotificationContent): {
  subject: string;
  html: string;
  text: string;
} {
  const subject = buildLeadNotificationSubject(content);
  const name = escapeHtml(content.leadName);
  const email = escapeHtml(content.leadEmail);
  const phone = content.leadPhone ? escapeHtml(content.leadPhone) : "—";
  const company = content.leadCompany ? escapeHtml(content.leadCompany) : "—";
  const message = escapeHtml(content.leadMessage).replace(/\n/g, "<br/>");
  const project = escapeHtml(content.projectName);
  const when = escapeHtml(content.submittedAt);
  const url = escapeHtml(content.leadUrl);

  const html = `<!DOCTYPE html>
<html><body style="font-family:system-ui,sans-serif;line-height:1.5;color:#111;">
  <h1 style="font-size:18px;">New lead for ${project}</h1>
  <p style="margin:0 0 12px;color:#555;">Submitted ${when}</p>
  <table style="border-collapse:collapse;width:100%;max-width:560px;">
    <tr><td style="padding:6px 0;color:#666;width:110px;">Name</td><td style="padding:6px 0;">${name}</td></tr>
    <tr><td style="padding:6px 0;color:#666;">Email</td><td style="padding:6px 0;"><a href="mailto:${email}">${email}</a></td></tr>
    <tr><td style="padding:6px 0;color:#666;">Phone</td><td style="padding:6px 0;">${phone}</td></tr>
    <tr><td style="padding:6px 0;color:#666;">Company</td><td style="padding:6px 0;">${company}</td></tr>
  </table>
  <p style="margin:16px 0 6px;color:#666;">Message</p>
  <div style="padding:12px;border:1px solid #e5e5e5;border-radius:8px;background:#fafafa;">${message}</div>
  <p style="margin:20px 0 0;">
    <a href="${url}" style="display:inline-block;padding:10px 14px;background:#111;color:#fff;text-decoration:none;border-radius:8px;">
      Open in Atlas
    </a>
  </p>
  <p style="margin:16px 0 0;font-size:12px;color:#888;">You received this because email notifications are enabled for your contact form.</p>
</body></html>`;

  const text = [
    `New lead for ${content.projectName}`,
    `Submitted ${content.submittedAt}`,
    "",
    `Name: ${content.leadName}`,
    `Email: ${content.leadEmail}`,
    `Phone: ${content.leadPhone || "—"}`,
    `Company: ${content.leadCompany || "—"}`,
    "",
    "Message:",
    content.leadMessage,
    "",
    `Open in Atlas: ${content.leadUrl}`,
  ].join("\n");

  return { subject, html, text };
}

/**
 * Build a safe absolute lead deep-link. Rejects open redirects by only
 * appending a path under the trusted Atlas origin.
 */
export function buildSecureLeadUrl(
  atlasOrigin: string,
  leadId: string,
): string {
  const origin = atlasOrigin.replace(/\/+$/, "");
  // Only allow http(s) origins we control (caller passes getPublicAtlasOrigin).
  let parsed: URL;
  try {
    parsed = new URL(origin);
  } catch {
    throw new Error("Invalid Atlas origin for lead links.");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Invalid Atlas origin protocol for lead links.");
  }
  if (!/^[0-9a-f-]{8,}$/i.test(leadId)) {
    throw new Error("Invalid lead id for lead links.");
  }
  return `${parsed.origin}/leads?lead=${encodeURIComponent(leadId)}`;
}
