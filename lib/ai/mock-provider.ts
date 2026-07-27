import { validateBrandContrast } from "@/lib/ai/contrast";
import { getIndustryCopyPack, pickVariation } from "@/lib/ai/industry-content";
import { layoutPresetFromTone } from "@/lib/ai/layout-presets";
import { buildMediaPlaceholders } from "@/lib/ai/media-placeholders";
import {
  DEFAULT_OPTIONAL_SECTIONS,
  enabledOptionalSections,
  normalizeOptionalSections,
  type AiOptionalSectionId,
} from "@/lib/ai/optional-sections";
import { coalesceNonEmpty } from "@/lib/ai/resolve-generate-input";
import type {
  AiProvider,
  AiRegenerateSection,
  GenerateWebsiteInput,
  GenerateWebsiteResult,
  GeneratedOptionalSections,
  GeneratedWebsiteDraft,
  RegenerateSectionResult,
} from "@/lib/ai/types";

function slugifyEmailLocal(name: string): string {
  const cleaned = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 24);
  return cleaned || "hello";
}

/**
 * Deterministic mock website drafts (Sprint 20.1 polish).
 * Explicit questionnaire values always win over placeholders.
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

  async regenerateSection(input: {
    section: AiRegenerateSection;
    currentDraft: GeneratedWebsiteDraft;
    variation?: number;
    projectId: string;
    businessName: string;
    businessType: string;
    description: string;
    goals?: string[];
    questionnaire?: GenerateWebsiteInput["questionnaire"];
  }): Promise<RegenerateSectionResult> {
    const started = Date.now();
    const variation = Math.max(0, input.variation ?? 1);
    const seed = `${input.businessName}:${input.section}:${variation}`;
    const fresh = buildMockWebsiteDraft(
      {
        projectId: input.projectId,
        businessName: input.businessName,
        businessType: input.businessType,
        description: input.description,
        goals: input.goals,
        questionnaire: input.questionnaire,
      },
      { variationSalt: seed },
    );

    let patch: Partial<GeneratedWebsiteDraft> = {};
    if (input.section === "hero") {
      patch = {
        heroEyebrow: fresh.heroEyebrow,
        heroHeadline: fresh.heroHeadline,
        heroSubheadline: fresh.heroSubheadline,
        primaryCta: fresh.primaryCta,
        secondaryCta: fresh.secondaryCta,
      };
    } else if (input.section === "about") {
      patch = {
        aboutTitle: fresh.aboutTitle,
        aboutBody: fresh.aboutBody,
        description: fresh.description,
      };
    } else {
      patch = { services: fresh.services };
    }

    await new Promise((resolve) => setTimeout(resolve, 30));
    return {
      ok: true,
      provider: "mock",
      section: input.section,
      patch,
      durationMs: Date.now() - started,
    };
  }
}

function buildOptionalSectionContent(
  enabled: AiOptionalSectionId[],
  businessName: string,
  pack: ReturnType<typeof getIndustryCopyPack>,
  seed: string,
): GeneratedOptionalSections {
  const out: GeneratedOptionalSections = {};
  if (enabled.includes("testimonials")) {
    out.testimonials = [
      {
        quote: pickVariation(
          [
            `${businessName} made everything simple from day one.`,
            `We finally found a partner who delivers what they promise.`,
            `Clear communication and quality work — highly recommend.`,
          ],
          seed,
          1,
        ),
        author: pickVariation(["Alex R.", "Jordan M.", "Sam K."], seed, 2),
        role: pickVariation(
          ["Customer", "Local business owner", "Repeat client"],
          seed,
          3,
        ),
      },
      {
        quote: `Professional, friendly, and easy to work with.`,
        author: pickVariation(["Taylor B.", "Casey L.", "Riley P."], seed, 4),
        role: "Verified review",
      },
    ];
  }
  if (enabled.includes("faq")) {
    out.faq = [
      {
        question: `How do I get started with ${businessName}?`,
        answer:
          "Share a few details about your goals and we will recommend the right next step — usually within one business day.",
      },
      {
        question: "What areas do you serve?",
        answer:
          "We work with customers in our primary service area and can discuss nearby regions on request.",
      },
      {
        question: "Do you offer free consultations?",
        answer:
          "Yes — most new customers begin with a short consult so we can understand your needs before quoting.",
      },
    ];
  }
  if (enabled.includes("team")) {
    out.team = [
      {
        name: pickVariation(["Morgan Hale", "Jamie Ortiz", "Chris Nguyen"], seed, 5),
        role: "Founder",
        bio: `${pack.aboutOpeners[0] || "Leads the team with a focus on quality and clear communication."}`,
      },
      {
        name: pickVariation(["Avery Kim", "Quinn Brooks", "Reese Patel"], seed, 6),
        role: "Customer success",
        bio: "Keeps projects on track and makes sure every customer feels informed.",
      },
    ];
  }
  if (enabled.includes("pricing")) {
    out.pricing = [
      {
        name: "Starter",
        price: "From $99",
        description: "Essential support for getting started.",
        features: ["Core service", "Email support", "Clear next steps"],
      },
      {
        name: "Professional",
        price: "Custom",
        description: "Full-service partnership for growing teams.",
        features: ["Priority scheduling", "Dedicated contact", "Quarterly review"],
      },
    ];
  }
  if (enabled.includes("bookingCta")) {
    out.bookingCta = {
      title: "Ready to book?",
      body: `Choose a time that works and the ${businessName} team will confirm shortly.`,
      buttonText: pickVariation(pack.primaryCtas, seed, 7),
    };
  }
  if (enabled.includes("newsletter")) {
    out.newsletter = {
      title: "Stay in the loop",
      body: "Occasional updates — no spam, unsubscribe anytime.",
      buttonText: "Subscribe",
    };
  }
  return out;
}

export function buildMockWebsiteDraft(
  input: GenerateWebsiteInput,
  options?: { variationSalt?: string },
): GeneratedWebsiteDraft {
  const q = input.questionnaire;
  const salt = options?.variationSalt || input.businessName || "atlas";

  const businessName =
    coalesceNonEmpty(input.businessName, q?.businessName) ||
    "Northshore Studio";
  const businessType =
    coalesceNonEmpty(input.businessType, q?.businessType) || "Creative Studio";
  const description =
    coalesceNonEmpty(input.description, q?.description) ||
    `${businessName} helps customers get reliable results with clear communication and careful craft.`;

  const pack = getIndustryCopyPack(businessType);
  const seed = `${businessName}:${businessType}:${salt}`;
  const layoutPreset = layoutPresetFromTone(q?.tone);

  const primary =
    q?.primaryServices && q.primaryServices.length > 0
      ? q.primaryServices
      : ["Core service", "Consultation", "Ongoing support"];
  const secondary = q?.secondaryServices ?? [];
  const serviceArea = coalesceNonEmpty(q?.serviceArea) || "";
  const target = coalesceNonEmpty(q?.targetCustomer) || "";
  const years = coalesceNonEmpty(q?.yearsInBusiness) || "";

  const aboutOpener = pickVariation(pack.aboutOpeners, seed, 10);
  const aboutBits = [aboutOpener, description];
  if (years) aboutBits.push(`Serving clients for ${years}.`);
  if (target) aboutBits.push(`We focus on ${target}.`);
  if (serviceArea) aboutBits.push(`Proudly serving ${serviceArea}.`);

  const services = [
    ...primary.slice(0, 3).map((title) => ({
      title,
      description: pack.serviceBlurb(title, target, serviceArea),
    })),
    ...secondary.slice(0, Math.max(0, 3 - primary.length)).map((title) => ({
      title,
      description: pack.serviceBlurb(title, target, serviceArea),
    })),
  ].slice(0, 3);

  while (services.length < 3) {
    services.push({
      title: "Ongoing support",
      description: pack.serviceBlurb(
        "Ongoing support",
        target,
        serviceArea,
      ),
    });
  }

  const emailLocal = slugifyEmailLocal(businessName);
  const phone = coalesceNonEmpty(q?.phone) || "(555) 010-2040";
  const email = coalesceNonEmpty(q?.email) || `${emailLocal}@example.com`;
  const location = coalesceNonEmpty(q?.address) || "Your city, ST";

  const primaryColor =
    coalesceNonEmpty(q?.primaryColor) || layoutPreset.secondaryColor;
  const accentColor =
    coalesceNonEmpty(q?.accentColor) ||
    coalesceNonEmpty(q?.primaryColor) ||
    "#3db8a8";

  const optionalState = normalizeOptionalSections({
    ...DEFAULT_OPTIONAL_SECTIONS,
    ...(q?.optionalSections || {}),
  });
  const enabledSections = enabledOptionalSections(optionalState);
  // Gallery placeholders always generated; gallery section only when enabled.
  const mediaPlaceholders = buildMediaPlaceholders({
    businessName,
    businessType,
  });

  const contrastWarnings = validateBrandContrast({
    primaryColor,
    accentColor,
    backgroundColor: layoutPreset.backgroundColor,
  });

  return {
    businessName,
    businessType,
    description,
    heroEyebrow: businessName,
    heroHeadline: pickVariation(pack.headlines, seed, 20).replace(
      /\{name\}/g,
      businessName,
    ),
    heroSubheadline: target
      ? pickVariation(
          [
            `${businessType} for ${target}${serviceArea ? ` in ${serviceArea}` : ""}.`,
            ...pack.subheadlines,
          ],
          seed,
          21,
        )
      : pickVariation(pack.subheadlines, seed, 21),
    primaryCta: pickVariation(pack.primaryCtas, seed, 22),
    secondaryCta: pickVariation(pack.secondaryCtas, seed, 23),
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
      siteTitle: pack.seoTitle(businessName, businessType),
      metaDescription: pack
        .seoDescription(businessName, description)
        .slice(0, 155),
      socialTitle: `${businessName} — ${businessType}`,
      socialDescription: description.slice(0, 155),
      robotsIndex: true,
    },
    enabledSections,
    optionalSections: buildOptionalSectionContent(
      enabledSections,
      businessName,
      pack,
      seed,
    ),
    layoutPreset,
    brand: {
      primaryColor,
      accentColor,
      secondaryColor: layoutPreset.secondaryColor,
      backgroundColor: layoutPreset.backgroundColor,
      headingFont: layoutPreset.headingFont,
      bodyFont: layoutPreset.bodyFont,
      buttonStyle: layoutPreset.buttonStyle,
      layoutPresetId: layoutPreset.id,
    },
    mediaPlaceholders: {
      hero: mediaPlaceholders.hero,
      gallery: optionalState.gallery ? mediaPlaceholders.gallery : [],
    },
    contrastWarnings,
  };
}
