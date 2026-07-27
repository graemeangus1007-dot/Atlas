import type {
  AiProvider,
  GenerateWebsiteInput,
  GenerateWebsiteResult,
  GeneratedWebsiteDraft,
} from "@/lib/ai/types";

function slugifyEmailLocal(name: string): string {
  const cleaned = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 24);
  return cleaned || "hello";
}

function toneCta(tone: string | undefined): string {
  switch ((tone ?? "").toLowerCase()) {
    case "luxury":
      return "Request a consultation";
    case "friendly":
      return "Say hello";
    case "bold":
      return "Get started today";
    case "modern":
      return "Book a call";
    case "professional":
    default:
      return "Get a free quote";
  }
}

/**
 * Deterministic mock website drafts for local/UI development.
 * No network calls — Atlas runs without OPENAI_API_KEY.
 */
export class MockAiProvider implements AiProvider {
  readonly id = "mock" as const;

  async generateWebsite(
    input: GenerateWebsiteInput,
  ): Promise<GenerateWebsiteResult> {
    const started = Date.now();
    const draft = buildMockWebsiteDraft(input);
    await new Promise((resolve) => setTimeout(resolve, 40));
    return {
      ok: true,
      provider: "mock",
      draft,
      durationMs: Date.now() - started,
    };
  }
}

export function buildMockWebsiteDraft(
  input: GenerateWebsiteInput,
): GeneratedWebsiteDraft {
  const q = input.questionnaire;
  const businessName = input.businessName.trim() || "Northshore Studio";
  const businessType = input.businessType.trim() || "Creative Studio";
  const description =
    input.description.trim() ||
    `${businessName} helps customers get reliable results with clear communication and careful craft.`;

  const primary =
    q?.primaryServices && q.primaryServices.length > 0
      ? q.primaryServices
      : ["Core service", "Consultation", "Ongoing support"];
  const secondary = q?.secondaryServices ?? [];
  const serviceArea = q?.serviceArea?.trim();
  const target = q?.targetCustomer?.trim();
  const years = q?.yearsInBusiness?.trim();

  const aboutBits = [description];
  if (years) aboutBits.push(`Serving clients for ${years}.`);
  if (target) aboutBits.push(`We focus on ${target}.`);
  if (serviceArea) aboutBits.push(`Proudly serving ${serviceArea}.`);

  const services = [
    ...primary.slice(0, 3).map((title) => ({
      title,
      description: `Professional ${title.toLowerCase()} for ${
        target || "customers who value quality"
      }${serviceArea ? ` across ${serviceArea}` : ""}.`,
    })),
    ...secondary.slice(0, Math.max(0, 3 - primary.length)).map((title) => ({
      title,
      description: `Additional support through ${title.toLowerCase()}.`,
    })),
  ].slice(0, 3);

  while (services.length < 3) {
    services.push({
      title: "Ongoing support",
      description:
        "Friendly follow-up and refinements so your results keep improving over time.",
    });
  }

  const emailLocal = slugifyEmailLocal(businessName);
  const phone = q?.phone?.trim() || "(555) 010-2040";
  const email = q?.email?.trim() || `${emailLocal}@example.com`;
  const location = q?.address?.trim() || "Your city, ST";

  return {
    businessName,
    businessType,
    description,
    heroHeadline: `Welcome to ${businessName}`,
    heroSubheadline: target
      ? `${businessType} for ${target}${
          serviceArea ? ` in ${serviceArea}` : ""
        }.`
      : `Trusted ${businessType.toLowerCase()} service — built around your goals.`,
    primaryCta: toneCta(q?.tone),
    aboutTitle: `About ${businessName}`,
    aboutBody: aboutBits.join(" "),
    services,
    contact: {
      title: "Contact us",
      description: `Tell us about your project — the ${businessName} team typically replies within one business day.`,
      phone,
      email,
      location,
      buttonText: "Send message",
    },
    seo: {
      siteTitle: `${businessName} | ${businessType}`,
      metaDescription: description.slice(0, 155),
      socialTitle: `${businessName} — ${businessType}`,
      socialDescription: description.slice(0, 155),
      robotsIndex: true,
    },
  };
}
