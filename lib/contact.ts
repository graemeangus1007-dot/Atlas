import type { ProjectContact } from "@/types/business-project";

/** Build a default contact email from the business name. */
export function buildContactEmail(businessName: string): string {
  const slug = businessName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 18);
  return `hello@${slug || "business"}.com`;
}

/** Default contact fields for a new / mock project. */
export function defaultProjectContact(
  businessName: string,
  description?: string,
): ProjectContact {
  const name = businessName.trim() || "Your Business";
  return {
    title: `Visit ${name}`,
    description:
      description?.trim() ||
      "Stop by, call, or send a message — we’d love to hear from you.",
    phone: "(555) 014-2088",
    email: buildContactEmail(name),
    location: "128 Harbor Street, Riverview",
    formId: null,
    buttonText: "Send message",
    successMessage:
      "Thanks — we received your message and will get back to you soon.",
    showPhoneField: true,
    showCompanyField: false,
    formEnabled: true,
  };
}

/** Resolve button label from current or legacy contact fields. */
export function resolveContactButtonText(contact: ProjectContact): string {
  const value = contact.buttonText ?? contact.formButtonText;
  if (typeof value === "string" && value.trim()) return value;
  return "Send message";
}

/** Resolve success copy from current or legacy contact fields. */
export function resolveContactSuccessMessage(contact: ProjectContact): string {
  const value = contact.successMessage ?? contact.formSuccessMessage;
  if (typeof value === "string" && value.trim()) return value;
  return "Thanks — we received your message and will get back to you soon.";
}
