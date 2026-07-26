export type {
  EmailProvider,
  EmailProviderId,
  SendEmailInput,
  SendEmailResult,
  SendEmailFailure,
  TestConnectionResult,
} from "@/lib/email/types";
export {
  createEmailProvider,
  getEmailProviderId,
  getEmailFromAddress,
} from "@/lib/email/create-provider";
export { MockEmailProvider } from "@/lib/email/mock-provider";
export { ResendEmailProvider } from "@/lib/email/resend-provider";
export {
  redactProviderError,
  normalizeEmailProviderError,
} from "@/lib/email/errors";
export {
  buildLeadNotificationEmail,
  buildLeadNotificationSubject,
  buildSecureLeadUrl,
} from "@/lib/email/lead-notification-template";
export {
  deliverLeadNotification,
  scheduleLeadNotificationDelivery,
  sendTestLeadNotification,
  type DeliverLeadNotificationDeps,
  type LeadNotificationDeliveryResult,
} from "@/lib/email/deliver-lead-notification";
