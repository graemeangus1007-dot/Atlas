import { MockEmailProvider } from "@/lib/email/mock-provider";
import { ResendEmailProvider } from "@/lib/email/resend-provider";
import type { EmailProvider, EmailProviderId } from "@/lib/email/types";

/**
 * Resolve the email provider for server routes.
 * Defaults to mock so local/dev never requires Resend.
 * Set EMAIL_PROVIDER=resend for production (server-only).
 */
export function getEmailProviderId(
  override?: string | null,
): EmailProviderId {
  const raw = (override ?? process.env.EMAIL_PROVIDER)?.trim().toLowerCase();
  if (raw === "resend") return "resend";
  return "mock";
}

export function getEmailFromAddress(): string {
  const from = process.env.EMAIL_FROM_ADDRESS?.trim();
  if (from) return from;
  // Safe local default for mock provider only.
  return "Atlas <notifications@localhost>";
}

/**
 * Construct the active email provider (server-only for resend).
 */
export function createEmailProvider(
  override?: string | null,
): EmailProvider {
  switch (getEmailProviderId(override)) {
    case "resend":
      return new ResendEmailProvider();
    case "mock":
    default:
      return new MockEmailProvider();
  }
}
