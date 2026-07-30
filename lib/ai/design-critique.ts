/**
 * LLM Design Critique orchestration (Sprint 28.0A / 28.0B).
 * Builds safe context → provider → validate → recommendations.
 * Never mutates BusinessProject; never logs prompt/website payloads.
 */

import { AiError } from "@/lib/ai/errors";
import { getAiProviderId, getOpenAiModel } from "@/lib/ai/provider";
import {
  createAiRequestId,
  logAiCritique,
} from "@/lib/ai/openai-logging";
import {
  categorizeOpenAiFailure,
  formatFallbackUserMessage,
  type CritiqueFallbackReason,
} from "@/lib/ai/openai-error-categories";
import {
  critiqueToRecommendations,
  dedupeImprovements,
} from "@/lib/ai/critique-to-operations";
import {
  validateDesignCritique,
  validateDesignCritiqueWithIssues,
  type CritiqueValidationIssue,
} from "@/lib/ai/design-critique-validation";
import type {
  CritiqueFinding,
  CritiqueImprovement,
  CritiqueStrength,
  DesignCritique,
  DesignCritiqueContext,
  DesignCritiqueFailure,
  DesignCritiqueInput,
  DesignCritiqueMode,
  DesignCritiqueResult,
  ProposedChange,
} from "@/lib/ai/design-critique-types";
import { reviewCreativeDirector } from "@/lib/ai/creative-director";
import { scoreBusinessProject } from "@/lib/ai/critique-scoring";
import {
  designSystemInputFromProject,
  resolveDesignSystem,
} from "@/lib/ai/design-system-intelligence";
import { sanitizePlainText } from "@/lib/leads/sanitize";
import type { BusinessProject } from "@/types/business-project";
import { GALLERY_SLOT_COUNT } from "@/types/media";

export {
  validateDesignCritique,
  validateDesignCritiqueWithIssues,
} from "@/lib/ai/design-critique-validation";

function clip(value: unknown, max: number): string {
  return sanitizePlainText(
    typeof value === "string" ? value : value == null ? "" : String(value),
    { maxLength: max, trimEnds: true },
  );
}

function emptyProposedChange(): ProposedChange {
  return {
    kind: "setCreativePolish",
    target: "",
    value: "",
    sectionType: "",
    headingFont: "",
    bodyFont: "",
    buttonStyle: "",
    siteWidth: "",
    templateId: "",
    theme: "",
    primary: "",
    secondary: "",
    accent: "",
    background: "",
    fromColor: "",
    toColor: "",
    siteTitle: "",
    metaDescription: "",
    spacing: "",
    serviceIcons: false,
    motion: false,
    visualHierarchy: false,
    contactFormEnabled: false,
    assetHint: "",
    sectionSlot: "",
    servicesJson: "",
  };
}

function proposed(
  partial: Partial<ProposedChange> & { kind: ProposedChange["kind"] },
): ProposedChange {
  return { ...emptyProposedChange(), ...partial };
}

/**
 * Build minimized, safe context for the model.
 */
export function buildDesignCritiqueContext(
  project: BusinessProject,
  history: Array<{ role: "user" | "assistant"; content: string }> = [],
  viewportHint?: string | null,
): DesignCritiqueContext {
  const creative = reviewCreativeDirector({ project, limit: 1 });
  const advisorScores = scoreBusinessProject(project);
  const resolved = resolveDesignSystem(designSystemInputFromProject(project));
  const ds = project.designSystem
    ? {
        language: project.designSystem.language,
        label: project.designSystem.label,
        imageryStyle: project.designSystem.imageryStyle,
        motionStyle: project.designSystem.motionStyle,
        explanation: project.designSystem.explanation,
      }
    : {
        language: resolved.designSystem.language,
        label: resolved.designSystem.label,
        imageryStyle: resolved.designSystem.imageryStyle,
        motionStyle: resolved.designSystem.motionStyle,
        explanation: resolved.designSystem.explanation,
      };

  const enabledOptional = Object.entries(project.designSections ?? {})
    .filter(([, value]) => Boolean(value))
    .map(([key]) => key);

  const galleryFilled = (project.galleryImageIds ?? []).filter(Boolean).length;
  const placeholders: string[] = [];
  if (!project.heroImageId) placeholders.push("hero image missing");
  if (galleryFilled === 0) placeholders.push("gallery empty");
  if (!project.logo && !project.logoAssetId) placeholders.push("logo missing");

  const memory = project.atlasMemory ?? {};

  return {
    businessName: clip(project.businessName, 120),
    industry: clip(project.businessType, 80),
    businessDescription: clip(project.description, 600),
    targetAudience: clip(memory.notes?.[0] ?? "", 200) || "local customers",
    primaryGoal: clip(
      memory.primaryGoal || project.goals?.[0] || "win more customers",
      120,
    ),
    services: (project.services ?? []).slice(0, 8).map((s) => ({
      title: clip(s.title, 80),
      description: clip(s.description, 240),
    })),
    homepageCopy: {
      heroEyebrow: clip(project.heroEyebrow ?? "", 80),
      heroTitle: clip(project.heroHeadline, 160),
      heroDescription: clip(project.heroSubheadline, 320),
      primaryCta: clip(project.primaryCta, 60),
      secondaryCta: clip(project.secondaryCta ?? "", 60),
      aboutTitle: clip(project.aboutTitle ?? "About", 80),
      aboutBody: clip(project.description, 800),
      contactTitle: clip(project.contact?.title ?? "Contact", 80),
      contactDescription: clip(project.contact?.description ?? "", 240),
      contactButtonText: clip(project.contact?.buttonText ?? "", 60),
    },
    sectionOrder: (project.sectionOrder ?? []).slice(0, 20).map((s) => clip(s, 40)),
    enabledSections: [
      "hero",
      "about",
      "services",
      "contact",
      ...enabledOptional,
    ].slice(0, 20),
    designSystem: {
      language: clip(ds.language, 40),
      label: clip(ds.label, 80),
      imageryStyle: clip(String(ds.imageryStyle), 120),
      motionStyle: clip(String(ds.motionStyle), 80),
      explanation: clip(ds.explanation, 240),
    },
    colors: {
      primary: clip(project.primaryColor, 40),
      secondary: clip(project.secondaryColor, 40),
      accent: clip(project.accentColor, 40),
      background: clip(project.backgroundColor, 40),
      theme: clip(project.theme, 20),
    },
    typography: {
      headingFont: clip(project.headingFont, 40),
      bodyFont: clip(project.bodyFont, 40),
    },
    spacing: clip(project.creativePolish?.spacing ?? "default", 20),
    buttons: clip(project.buttonStyle, 40),
    siteWidth: clip(project.siteWidth, 20),
    templateId: clip(project.templateId, 40),
    creativePolish: {
      serviceIcons: Boolean(project.creativePolish?.serviceIcons),
      motion: Boolean(project.creativePolish?.motion),
      visualHierarchy: Boolean(project.creativePolish?.visualHierarchy),
      spacing: clip(project.creativePolish?.spacing ?? "default", 20),
    },
    imagery: {
      hasHeroImage: Boolean(project.heroImageId),
      galleryFilledSlots: galleryFilled,
      galleryTotalSlots: GALLERY_SLOT_COUNT,
      hasLogo: Boolean(project.logo || project.logoAssetId),
      libraryCount: project.mediaLibrary?.filter((a) => !a.unavailable).length ?? 0,
      placeholderSummary: placeholders,
    },
    seo: {
      siteTitle: clip(project.seo?.siteTitle ?? "", 120),
      metaDescription: clip(project.seo?.metaDescription ?? "", 160),
      socialTitle: clip(project.seo?.socialTitle ?? "", 120),
      socialDescription: clip(project.seo?.socialDescription ?? "", 160),
      robotsIndex: project.seo?.robotsIndex !== false,
    },
    maturity: {
      overallCompleteness: creative.overallCompleteness,
      maturityLevel: creative.maturityLevel,
      categoryScores: { ...advisorScores.categories },
    },
    atlasMemory: {
      preferredLayouts: (memory.preferredLayouts ?? []).slice(0, 6).map((s) => clip(s, 40)),
      preferredThemes: (memory.preferredThemes ?? []).slice(0, 6).map((s) => clip(s, 40)),
      primaryGoal: clip(memory.primaryGoal ?? "", 120),
      businessTone: clip(memory.businessTone ?? "", 80),
      imageStyle: clip(memory.imageStyle ?? "", 80),
      notes: (memory.notes ?? []).slice(0, 4).map((s) => clip(s, 160)),
    },
    recentConversation: history
      .filter(
        (m) =>
          (m.role === "user" || m.role === "assistant") &&
          typeof m.content === "string",
      )
      .slice(-6)
      .map((m) => ({
        role: m.role,
        content: clip(m.content, 400),
      })),
    viewportHint: clip(viewportHint ?? "", 80),
  };
}

/**
 * Deterministic mock critique for AI_PROVIDER=mock and tests.
 * Tailored to the project — not a silent generic checklist substitute for OpenAI.
 */
export function buildMockDesignCritique(
  context: DesignCritiqueContext,
  request: string,
): DesignCritique {
  const name = context.businessName || "this business";
  const industry = context.industry || "service business";
  const hero = context.homepageCopy.heroTitle;
  const cta = context.homepageCopy.primaryCta;
  const missingHero = !context.imagery.hasHeroImage;
  const missingProof = !context.enabledSections.includes("testimonials");
  const flatSpacing = context.creativePolish.spacing === "default";
  const weakSeo = !context.seo.metaDescription || context.seo.metaDescription.length < 40;

  const strengths: CritiqueStrength[] = [
    {
      id: "strength-clarity",
      title: "Service clarity",
      evidence: `“${hero || "Hero"}” and CTA “${cta || "Contact"}” state what ${name} offers without jargon.`,
    },
  ];
  if (context.services.length >= 2) {
    strengths.push({
      id: "strength-services",
      title: "Concrete services",
      evidence: `Services like “${context.services[0].title}” give visitors a clear menu of offerings.`,
    });
  }

  const problems: CritiqueFinding[] = [];
  if (missingHero) {
    problems.push({
      id: "problem-hero-image",
      title: "Hero lacks emotional imagery",
      observation: `The homepage hero for ${name} is still placeholder-led — visitors never see the craft of this ${industry}.`,
      severity: "missing",
      affectedAreas: ["hero", "imagery", "emotional impact"],
    });
  } else {
    problems.push({
      id: "problem-hierarchy",
      title: "Visual hierarchy is underplayed",
      observation: `Even with imagery present, the hero message “${hero}” competes with equally weighted supporting text rather than leading the eye to one action.`,
      severity: "weak",
      affectedAreas: ["hero", "typography", "visual hierarchy"],
    });
  }
  if (missingProof) {
    problems.push({
      id: "problem-proof",
      title: "Social proof is missing near the CTA",
      observation: `${name} asks visitors to “${cta}” without nearby testimonials or proof — a conversion gap for a ${industry}.`,
      severity: "missing",
      affectedAreas: ["testimonials", "conversion", "trust"],
    });
  }
  if (flatSpacing) {
    problems.push({
      id: "problem-spacing",
      title: "Spacing feels cramped for a premium read",
      observation:
        "Section spacing is still at the default density, which undercuts a calm, agency-grade first impression.",
      severity: "weak",
      affectedAreas: ["spacing", "layout", "mobile"],
    });
  }
  if (weakSeo) {
    problems.push({
      id: "problem-seo",
      title: "SEO metadata undersells the business",
      observation: `Site title/description do not yet reinforce “${name}” + ${industry} for search previews.`,
      severity: context.seo.siteTitle ? "weak" : "missing",
      affectedAreas: ["seo", "messaging"],
    });
  }
  while (problems.length < 1) {
    problems.push({
      id: "problem-cta-path",
      title: "Journey to contact is soft",
      observation: `The path from hero to contact for ${name} could be clearer on mobile and desktop.`,
      severity: "weak",
      affectedAreas: ["user journey", "cta"],
    });
  }

  const improvements: CritiqueImprovement[] = [
    {
      id: "imp-direction",
      title: "Commit to a premium landscape-led direction",
      observation: `The site explains the service, but does not yet feel like a top ${industry} brand.`,
      rationale: `A coordinated direction — imagery, spacing, and a shorter hero — fits ${name}'s audience better than isolated tweaks.`,
      expectedBusinessOutcome:
        "Visitors form a stronger first impression and trust the brand faster.",
      impact: "high",
      affectedAreas: ["brand", "imagery", "spacing", "hero"],
      proposedChanges: [
        proposed({
          kind: "setCreativePolish",
          visualHierarchy: true,
          spacing: "comfortable",
          motion: true,
        }),
        proposed({
          kind: "setTypography",
          headingFont: "playfair",
          bodyFont: "manrope",
        }),
      ],
    },
  ];

  if (missingHero && context.imagery.libraryCount > 0) {
    improvements.push({
      id: "imp-hero-image",
      title: "Place a real hero image",
      observation: "The hero still reads as unfinished without photography.",
      rationale: `For a ${industry}, imagery carries emotional weight before copy is read.`,
      expectedBusinessOutcome: "Higher engagement in the first three seconds.",
      impact: "high",
      affectedAreas: ["hero", "imagery"],
      proposedChanges: [
        proposed({ kind: "replaceHeroImage", assetHint: "hero" }),
      ],
    });
  }

  if (missingProof) {
    improvements.push({
      id: "imp-testimonials",
      title: "Add social proof near the estimate CTA",
      observation: `There is no testimonials section before “${cta}”.`,
      rationale:
        "Proof next to the ask reduces hesitation for first-time visitors.",
      expectedBusinessOutcome: "More visitors complete the contact action.",
      impact: "high",
      affectedAreas: ["testimonials", "conversion"],
      proposedChanges: [
        proposed({ kind: "insertSection", sectionType: "testimonials" }),
      ],
    });
  }

  improvements.push({
    id: "imp-hero-copy",
    title: "Tighten the hero message",
    observation: `Current headline “${hero}” can be shorter and more outcome-led.`,
    rationale: `A sharper promise helps ${name} stand out in a crowded ${industry} market.`,
    expectedBusinessOutcome: "Clearer value proposition and stronger CTA focus.",
    impact: "medium",
    affectedAreas: ["hero", "messaging"],
    proposedChanges: [
      proposed({
        kind: "replaceText",
        target: "hero.title",
        value: hero
          ? hero.length > 48
            ? `${hero.slice(0, 44).trim()}…`
            : `${hero.replace(/\.$/, "")} — crafted with care`
          : `Premium ${industry} from ${name}`,
      }),
    ],
  });

  if (weakSeo) {
    improvements.push({
      id: "imp-seo",
      title: "Rewrite SEO for search & previews",
      observation: "Metadata does not yet mirror the homepage promise.",
      rationale: "Aligned titles and descriptions improve click-through from search.",
      expectedBusinessOutcome: "Clearer previews and better qualified visits.",
      impact: "medium",
      affectedAreas: ["seo"],
      proposedChanges: [
        proposed({
          kind: "updateSeo",
          siteTitle: `${name} | ${industry}`,
          metaDescription: clip(
            `${context.businessDescription || `${name} provides trusted ${industry} services.`} Contact us to get started.`,
            155,
          ),
        }),
      ],
    });
  }

  improvements.push({
    id: "imp-cta",
    title: "Make the primary action unmistakable",
    observation: `CTA “${cta}” should feel like the single obvious next step.`,
    rationale: "One clear action reduces decision friction on mobile.",
    expectedBusinessOutcome: "Higher contact and lead conversion.",
    impact: "medium",
    affectedAreas: ["cta", "conversion", "mobile"],
    proposedChanges: [
      proposed({
        kind: "setCreativePolish",
        contactFormEnabled: true,
        visualHierarchy: true,
      }),
    ],
  });

  const premiumAsk = /premium|agency|redesign|best\s+web/i.test(request);

  return {
    summary: premiumAsk
      ? `${name}'s homepage explains the service clearly, but it does not yet create a strong emotional impression or guide visitors toward one obvious action.`
      : `For ${name}, the foundation is understandable; the opportunity is a more coordinated, premium first impression tied to how ${industry} buyers decide.`,
    currentStrengths: strengths.slice(0, 5),
    coreProblems: problems.slice(0, 7),
    designDirection: {
      name: "Premium landscape-led",
      rationale: `Move ${name} toward larger project imagery, a shorter hero message, stronger spacing, and social proof closer to the estimate CTA.`,
      emotionalGoal: "Calm confidence — visitors feel they found the right specialist.",
      visualPrinciples: [
        "Imagery before ornament",
        "One primary action per viewport",
        "Generous spacing on desktop and mobile",
        "Typography hierarchy that leads the eye",
      ],
    },
    prioritizedImprovements: dedupeImprovements(improvements).slice(0, 7),
    expectedOutcome: `A homepage that feels agency-designed for a ${industry}: clearer hierarchy, stronger trust, and a smoother path to contact.`,
    confidence: 0.82,
  };
}

/**
 * Format a single coherent Atlas narrative (no duplicated “I reviewed…” lines).
 */
export function formatDesignCritiqueExplanation(input: {
  critique: DesignCritique;
  mode: DesignCritiqueMode;
  usedFallback?: boolean;
  requestId?: string;
  fallbackReason?: CritiqueFallbackReason | null;
  audience?: "customer" | "owner";
}): string {
  const { critique, mode } = input;
  const strengths = critique.currentStrengths
    .slice(0, 3)
    .map((s) => `• ${s.title} — ${s.evidence}`)
    .join("\n");
  const improvements = critique.prioritizedImprovements
    .slice(0, 7)
    .map(
      (item, i) =>
        `${i + 1}. ${item.title}\n   Why it matters: ${item.expectedBusinessOutcome}`,
    )
    .join("\n");

  const fallbackNote = input.usedFallback
    ? `${formatFallbackUserMessage({
        category: input.fallbackReason ?? "unknown",
        requestId: input.requestId,
        audience: input.audience,
      })}\n\n`
    : "";

  const close =
    mode === "critique"
      ? "Say Apply All when you’re ready, or apply any single improvement."
      : "I’m applying the coordinated plan next.";

  return [
    fallbackNote + critique.summary,
    "",
    `Design direction: ${critique.designDirection.name} — ${critique.designDirection.rationale}`,
    "",
    "Strengths:",
    strengths,
    "",
    "Top improvements:",
    improvements,
    "",
    critique.expectedOutcome,
    "",
    close,
  ]
    .filter((line, i, arr) => !(line === "" && arr[i - 1] === ""))
    .join("\n")
    .trim();
}

async function callOpenAiCritique(input: {
  request: string;
  mode: DesignCritiqueMode;
  context: DesignCritiqueContext;
  atlasRequestId?: string | null;
}): Promise<{
  critique: DesignCritique;
  requestId: string;
  openaiRequestId: string | null;
  model: string;
  latencyMs: number;
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  responseStatus: string | null;
  validationIssues: CritiqueValidationIssue[] | null;
}> {
  const { runOpenAiDesignCritique } = await import(
    "@/lib/ai/design-critique-provider"
  );
  const result = await runOpenAiDesignCritique(
    {
      request: input.request,
      mode: input.mode,
      context: input.context,
    },
    { atlasRequestId: input.atlasRequestId },
  );

  const validated = validateDesignCritiqueWithIssues(result.raw);
  if (!validated.ok) {
    logAiCritique({
      provider: "openai",
      model: result.model,
      requestId: result.requestId,
      openaiRequestId: result.openaiRequestId,
      durationMs: result.latencyMs,
      ok: false,
      code: "invalid_response",
      category: "validation",
      responseStatus: result.responseStatus,
      critiqueMode: input.mode,
      validationIssues: validated.issues,
      promptTokens: result.promptTokens,
      completionTokens: result.completionTokens,
      totalTokens: result.totalTokens,
    });
    const err = new AiError(
      "invalid_response",
      "OpenAI critique failed schema validation.",
    );
    (err as AiError & {
      category?: string;
      openaiRequestId?: string | null;
      validationIssues?: CritiqueValidationIssue[];
    }).category = "validation";
    (err as AiError & { openaiRequestId?: string | null }).openaiRequestId =
      result.openaiRequestId;
    (err as AiError & { validationIssues?: CritiqueValidationIssue[] }).validationIssues =
      validated.issues;
    throw err;
  }

  return {
    critique: validated.critique,
    requestId: result.requestId,
    openaiRequestId: result.openaiRequestId,
    model: result.model,
    latencyMs: result.latencyMs,
    promptTokens: result.promptTokens,
    completionTokens: result.completionTokens,
    totalTokens: result.totalTokens,
    responseStatus: result.responseStatus,
    validationIssues: null,
  };
}

/**
 * Run design critique via configured provider (openai | mock).
 * On OpenAI failure, returns labeled mock fallback (never silent generic success).
 */
export async function runDesignCritique(
  input: DesignCritiqueInput & {
    atlasRequestId?: string | null;
    audience?: "customer" | "owner";
  },
): Promise<DesignCritiqueResult | DesignCritiqueFailure> {
  const started = Date.now();
  const requestId = input.atlasRequestId?.trim() || createAiRequestId();
  const history = (input.history ?? [])
    .filter(
      (m): m is { role: "user" | "assistant"; content: string } =>
        Boolean(m) &&
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string",
    )
    .map((m) => ({ role: m.role, content: m.content }));

  const context = buildDesignCritiqueContext(
    input.project,
    history,
    input.viewportHint,
  );

  const providerId = getAiProviderId();
  let critique: DesignCritique;
  let usedFallback = false;
  let fallbackReason: CritiqueFallbackReason | null = null;
  let model = providerId === "openai" ? getOpenAiModel() : "mock-critique";
  let latencyMs = 0;
  let promptTokens: number | null = null;
  let completionTokens: number | null = null;
  let totalTokens: number | null = null;
  let diagRequestId = requestId;
  let openaiRequestId: string | null = null;

  try {
    if (input.critiqueFn) {
      critique = validateDesignCritique(
        await input.critiqueFn({
          context,
          request: input.request,
          mode: input.mode,
        }),
      );
      latencyMs = Date.now() - started;
    } else if (providerId === "openai") {
      try {
        const openai = input.openAiCall
          ? await input.openAiCall({
              context,
              request: input.request,
              mode: input.mode,
              atlasRequestId: requestId,
            })
          : await callOpenAiCritique({
              request: input.request,
              mode: input.mode,
              context,
              atlasRequestId: requestId,
            });
        critique = openai.critique;
        diagRequestId = openai.requestId;
        openaiRequestId = openai.openaiRequestId ?? null;
        model = openai.model;
        latencyMs = openai.latencyMs;
        promptTokens = openai.promptTokens;
        completionTokens = openai.completionTokens;
        totalTokens = openai.totalTokens;
      } catch (error) {
        const categorized = categorizeOpenAiFailure(error);
        usedFallback = true;
        fallbackReason = categorized.category;
        openaiRequestId =
          categorized.openaiRequestId ??
          (error as { openaiRequestId?: string | null })?.openaiRequestId ??
          null;
        critique = buildMockDesignCritique(context, input.request);
        latencyMs = Date.now() - started;
        logAiCritique({
          provider: "openai",
          model,
          requestId: diagRequestId,
          openaiRequestId,
          durationMs: latencyMs,
          ok: false,
          code: categorized.code ?? "provider_error",
          category: categorized.category,
          critiqueMode: input.mode,
          validationIssues:
            (error as { validationIssues?: CritiqueValidationIssue[] })
              ?.validationIssues ?? null,
        });
      }
    } else {
      critique = buildMockDesignCritique(context, input.request);
      latencyMs = Date.now() - started;
    }
  } catch (error) {
    const mapped =
      error instanceof AiError
        ? error
        : new AiError(
            "provider_error",
            "Design critique failed. Please try again.",
            { cause: error },
          );
    return {
      ok: false,
      code: mapped.code,
      message: mapped.message,
      diagnostics: {
        provider: providerId,
        model,
        requestId: diagRequestId,
        openaiRequestId,
        latencyMs: Date.now() - started,
        critiqueMode: input.mode,
        usedFallback: false,
        fallbackLabeled: false,
        fallbackReason: null,
      },
    };
  }

  const { recommendations, operations } = critiqueToRecommendations(
    critique,
    input.project,
  );

  const explanation = formatDesignCritiqueExplanation({
    critique,
    mode: input.mode,
    usedFallback,
    requestId: diagRequestId,
    fallbackReason,
    audience: input.audience,
  });

  return {
    ok: true,
    critique,
    recommendations,
    operations,
    explanation,
    usedFallback,
    fallbackReason,
    diagnostics: {
      provider: usedFallback ? "mock" : providerId,
      model: usedFallback ? "mock-critique-fallback" : model,
      requestId: diagRequestId,
      openaiRequestId,
      latencyMs,
      promptTokens,
      completionTokens,
      totalTokens,
      critiqueMode: input.mode,
      findingCount: critique.coreProblems.length,
      operationCount: operations.length,
      usedFallback,
      fallbackLabeled: usedFallback,
      fallbackReason,
    },
  };
}

/** Detect critique-only review asks. */
export function isDesignCritiqueRequest(request: string): boolean {
  return /\b(best\s+web\s+design\s+agency|how\s+would\s+you\s+redesign|what\s+would\s+a\s+(top|world[- ]class|great)\s+agency|review\s+(this|my)\s+(homepage|home\s+page|site|website)|why\s+does\s+this\s+feel|what\s+should\s+i\s+change\s+before\s+launch|critique\s+(my|this)|design\s+critique|what\s+would\s+you\s+improve)\b/i.test(
    request,
  );
}

/** Detect execution-oriented redesign asks (not “how would you redesign…?”). */
export function isDesignCritiqueExecuteRequest(request: string): boolean {
  if (/\b(how|what)\s+would\s+you\b/i.test(request)) return false;
  if (
    /\b(best\s+web\s+design\s+agency|what\s+would\s+a\s+(top|world[- ]class|great)\s+agency)\b/i.test(
      request,
    )
  ) {
    return false;
  }
  return /\b(redesign\s+(this|it|my\s+(homepage|site|website))|make\s+(this|it)\s+look\s+like\s+a\s+premium\s+agency|premium\s+agency\s+designed|make\s+all\s+of\s+(those|these)\s+improvements|apply\s+the\s+(critique\s+)?plan)\b/i.test(
    request,
  );
}
