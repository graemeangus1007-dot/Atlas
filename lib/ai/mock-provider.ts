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
    // Small delay so UI loading states can be exercised.
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
  const businessName = input.businessName.trim() || "Northshore Studio";
  const businessType = input.businessType.trim() || "Creative Studio";
  const description =
    input.description.trim() ||
    `${businessName} helps customers get reliable results with clear communication and careful craft.`;

  const emailLocal = slugifyEmailLocal(businessName);

  return {
    businessName,
    businessType,
    description,
    heroHeadline: `Welcome to ${businessName}`,
    heroSubheadline: `Trusted ${businessType.toLowerCase()} service — built around your goals.`,
    primaryCta: "Get a free quote",
    aboutTitle: `About ${businessName}`,
    aboutBody: description,
    services: [
      {
        title: "Core service",
        description: `Our signature ${businessType.toLowerCase()} offering, tailored to what you need most.`,
      },
      {
        title: "Consultation",
        description:
          "A clear plan of action so you know exactly what happens next — no guesswork.",
      },
      {
        title: "Ongoing support",
        description:
          "Friendly follow-up and refinements so your results keep improving over time.",
      },
    ],
    contact: {
      title: "Contact us",
      description: `Tell us about your project — the ${businessName} team typically replies within one business day.`,
      phone: "(555) 010-2040",
      email: `${emailLocal}@example.com`,
      location: "Your city, ST",
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
