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
  };
}
