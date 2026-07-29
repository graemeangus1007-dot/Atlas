/**
 * Atlas Creative Director — maturity engine + recommendation pipeline (Sprint 25.0A).
 * Thinks like a creative director reviewing a site before launch.
 * Future modules (Visual Designer, Motion, Image Gen, SEO, A11y, …) plug in here.
 */

import {
  detectMissingCapabilities,
} from "@/lib/ai/creative-director-capabilities";
import {
  classifyMaturityLevel,
  scoreWebsiteCompleteness,
} from "@/lib/ai/creative-director-scoring";
import type {
  CompleteWebsitePlan,
  CreativeDirectorInput,
  CreativeDirectorRecommendation,
  CreativeDirectorReport,
  CreativeRecommendationKind,
  MissingCapabilityId,
} from "@/lib/ai/creative-director-types";
import { COMPLETE_WEBSITE_THRESHOLD } from "@/lib/ai/creative-director-types";
import type { CreativeDirectorOperation } from "@/lib/ai/creative-director-types";
import type { BusinessProject } from "@/types/business-project";
import { GALLERY_SLOT_COUNT } from "@/types/media";

export const CREATIVE_DIRECTOR_TOP_N = 8;
export const COMPLETE_WEBSITE_TOP_N = 16;

const IMPACT_RANK = { high: 3, medium: 2, low: 1 } as const;

function firstLibraryAssetId(project: BusinessProject): string | null {
  const asset = project.mediaLibrary.find((item) => !item.unavailable);
  return asset?.id ?? null;
}

function findAssetByHint(
  project: BusinessProject,
  hint: RegExp,
): string | null {
  const asset = project.mediaLibrary.find(
    (item) =>
      !item.unavailable &&
      hint.test(`${item.title} ${item.name} ${item.alt} ${item.description}`),
  );
  return asset?.id ?? null;
}

function rec(input: {
  id: string;
  kind: CreativeRecommendationKind;
  title: string;
  explanation: string;
  impact: CreativeDirectorRecommendation["impact"];
  impactScore: number;
  confidence?: number;
  operations: CreativeDirectorOperation[];
  capabilityIds: MissingCapabilityId[];
  applyable?: boolean;
  blockedReason?: string;
  estimatedTime?: string;
}): CreativeDirectorRecommendation {
  const applyable =
    input.applyable ??
    (input.operations.length > 0 && !input.blockedReason);
  return {
    id: input.id,
    kind: input.kind,
    title: input.title,
    explanation: input.explanation,
    impact: input.impact,
    impactScore: input.impactScore,
    confidence: input.confidence ?? 0.86,
    operations: input.operations,
    capabilityIds: input.capabilityIds,
    applyable,
    ...(input.blockedReason ? { blockedReason: input.blockedReason } : {}),
    estimatedTime: input.estimatedTime ?? "<10 seconds",
  };
}

/**
 * Build structured recommendations from missing capabilities + project state.
 */
export function buildCreativeRecommendations(
  project: BusinessProject,
): CreativeDirectorRecommendation[] {
  const missing = new Set(
    detectMissingCapabilities(project).map((cap) => cap.id),
  );
  const libraryId = firstLibraryAssetId(project);
  const out: CreativeDirectorRecommendation[] = [];

  if (missing.has("hero_image")) {
    out.push(
      rec({
        id: "visual.hero_image",
        kind: "visual",
        title: "Add a real hero image",
        explanation:
          "Your homepage opens on a placeholder. A real hero photo sets the mood instantly and makes the brand feel finished.",
        impact: "high",
        impactScore: 94,
        capabilityIds: ["hero_image"],
        operations: libraryId
          ? [{ operation: "replaceHeroImage", assetId: libraryId }]
          : [],
        applyable: Boolean(libraryId),
        blockedReason: libraryId
          ? undefined
          : "Upload a photo to your media library first, then apply this.",
      }),
    );
  }

  if (missing.has("icons")) {
    out.push(
      rec({
        id: "visual.service_icons",
        kind: "visual",
        title: "Add icons to every service",
        explanation:
          "Your services are easy to understand, but they lack visual anchors. Adding icons improves scanning and makes the page feel more polished.",
        impact: "high",
        impactScore: 88,
        capabilityIds: ["icons"],
        operations: [
          {
            operation: "setCreativePolish",
            serviceIcons: true,
          },
        ],
      }),
    );
  }

  if (missing.has("gallery")) {
    const ops: CreativeDirectorOperation[] = [
      { operation: "insertSection", type: "gallery" },
    ];
    if (libraryId) {
      for (let i = 0; i < GALLERY_SLOT_COUNT; i += 1) {
        ops.push({
          operation: "replaceGalleryImage",
          index: i,
          assetId: libraryId,
        });
      }
    }
    out.push(
      rec({
        id: "visual.gallery",
        kind: "visual",
        title: "Create a photo gallery",
        explanation:
          "A gallery gives visitors something tangible to look at — products, space, or craft — and lifts the whole site out of draft mode.",
        impact: "high",
        impactScore: 90,
        capabilityIds: ["gallery"],
        operations: ops,
        applyable: true,
      }),
    );
  }

  if (missing.has("logo")) {
    const logoId =
      findAssetByHint(project, /\blogo\b/i) ?? libraryId;
    out.push(
      rec({
        id: "brand.logo",
        kind: "brand",
        title: "Use your logo in the navigation",
        explanation:
          "Text-only branding works for drafts. A logo in the nav makes the site feel like a real brand from the first glance.",
        impact: "medium",
        impactScore: 72,
        capabilityIds: ["logo"],
        operations: logoId ? [{ operation: "setLogo", assetId: logoId }] : [],
        applyable: Boolean(logoId),
        blockedReason: logoId
          ? undefined
          : "Upload a logo image first, then apply this.",
      }),
    );
  }

  if (missing.has("motion")) {
    out.push(
      rec({
        id: "motion.scroll_animations",
        kind: "motion",
        title: "Add subtle scroll animations",
        explanation:
          "Still pages feel unfinished. Soft fade and hover motion add presence without distracting from the message.",
        impact: "medium",
        impactScore: 78,
        capabilityIds: ["motion"],
        operations: [{ operation: "setCreativePolish", motion: true }],
      }),
    );
  }

  if (missing.has("visual_hierarchy") || missing.has("typography")) {
    out.push(
      rec({
        id: "visual.hierarchy",
        kind: "visual",
        title: "Improve visual hierarchy",
        explanation:
          "Headlines and body currently compete for attention. Stronger hierarchy guides the eye and makes the story easier to follow.",
        impact: "high",
        impactScore: 86,
        capabilityIds: ["visual_hierarchy", "typography"],
        operations: [
          {
            operation: "setCreativePolish",
            visualHierarchy: true,
          },
          {
            operation: "setTypography",
            headingFont: "manrope",
            bodyFont: "inter",
          },
        ],
      }),
    );
  }

  if (missing.has("flat_spacing") || missing.has("spacing")) {
    out.push(
      rec({
        id: "visual.spacing",
        kind: "visual",
        title: "Improve spacing",
        explanation:
          "Sections feel packed together. Breathing room between blocks makes the design feel intentional and premium.",
        impact: "medium",
        impactScore: 74,
        capabilityIds: ["spacing", "flat_spacing"],
        operations: [
          {
            operation: "setCreativePolish",
            spacing: "comfortable",
          },
          { operation: "setSiteWidth", value: "wide" },
        ],
      }),
    );
  }

  if (missing.has("testimonials") || missing.has("social_proof")) {
    out.push(
      rec({
        id: "content.testimonials",
        kind: "content",
        title: "Add customer testimonials",
        explanation:
          "Strong copy alone rarely closes the deal. Short customer quotes add trust and make the business feel proven.",
        impact: "high",
        impactScore: 92,
        capabilityIds: ["testimonials", "social_proof"],
        operations: [{ operation: "insertSection", type: "testimonials" }],
      }),
    );
  }

  if (missing.has("faq")) {
    out.push(
      rec({
        id: "content.faq",
        kind: "content",
        title: "Add an FAQ section",
        explanation:
          "Visitors often stall on practical questions. An FAQ clears friction before they ever reach out.",
        impact: "medium",
        impactScore: 76,
        capabilityIds: ["faq"],
        operations: [{ operation: "insertSection", type: "faq" }],
      }),
    );
  }

  if (missing.has("team")) {
    out.push(
      rec({
        id: "content.team",
        kind: "content",
        title: "Add a team section",
        explanation:
          "People buy from people. A short team introduction warms up the brand and builds familiarity.",
        impact: "medium",
        impactScore: 70,
        capabilityIds: ["team", "team_photos"],
        operations: [{ operation: "insertSection", type: "team" }],
      }),
    );
  }

  if (missing.has("weak_cta") || missing.has("cta_strength")) {
    const stronger =
      /bakery|cookie|coffee|pastry/i.test(
        `${project.businessName} ${project.businessType}`,
      )
        ? "Order ahead"
        : "Get in touch";
    out.push(
      rec({
        id: "conversion.cta",
        kind: "conversion",
        title: "Strengthen the primary call-to-action",
        explanation:
          "Generic button labels fade into the page. A clearer CTA tells visitors exactly what happens next.",
        impact: "high",
        impactScore: 89,
        capabilityIds: ["weak_cta", "cta_strength"],
        operations: [
          {
            operation: "replaceText",
            target: "hero.primaryCta",
            value: stronger,
          },
          { operation: "setButtonStyle", value: "pill" },
        ],
      }),
    );
  }

  if (missing.has("lead_capture")) {
    out.push(
      rec({
        id: "conversion.lead_capture",
        kind: "conversion",
        title: "Turn on lead capture",
        explanation:
          "Contact details alone leave conversions on the table. A simple form on the page captures interest while it’s hot.",
        impact: "high",
        impactScore: 87,
        capabilityIds: ["lead_capture", "contact"],
        operations: [
          {
            operation: "setCreativePolish",
            contactFormEnabled: true,
          },
          {
            operation: "replaceText",
            target: "contact.buttonText",
            value: "Send a message",
          },
        ],
      }),
    );
  }

  if (missing.has("color_consistency")) {
    out.push(
      rec({
        id: "brand.color_harmony",
        kind: "brand",
        title: "Improve color harmony",
        explanation:
          "When primary and accent match, buttons lose emphasis. A distinct accent color restores hierarchy and brand energy.",
        impact: "medium",
        impactScore: 68,
        capabilityIds: ["color_consistency"],
        operations: [
          {
            operation: "changeTheme",
            accent: "#0f766e",
          },
        ],
      }),
    );
  }

  if (missing.has("service_images") && libraryId) {
    out.push(
      rec({
        id: "visual.section_image",
        kind: "visual",
        title: "Add imagery beside About",
        explanation:
          "Long text blocks feel dense without a visual partner. A photo next to About gives the story a place to land.",
        impact: "medium",
        impactScore: 71,
        capabilityIds: ["service_images"],
        operations: [
          {
            operation: "setSectionImage",
            section: "about",
            assetId: libraryId,
          },
        ],
      }),
    );
  }

  return out;
}

export function suppressDuplicateCreativeRecommendations(
  items: CreativeDirectorRecommendation[],
): CreativeDirectorRecommendation[] {
  const byId = new Map<string, CreativeDirectorRecommendation>();
  for (const item of items) {
    const existing = byId.get(item.id);
    if (!existing || item.impactScore > existing.impactScore) {
      byId.set(item.id, item);
    }
  }
  // Also suppress overlapping capability sets — keep higher impactScore
  const kept: CreativeDirectorRecommendation[] = [];
  const claimed = new Set<MissingCapabilityId>();
  const ranked = [...byId.values()].sort(
    (a, b) =>
      IMPACT_RANK[b.impact] - IMPACT_RANK[a.impact] ||
      b.impactScore - a.impactScore ||
      a.id.localeCompare(b.id),
  );
  for (const item of ranked) {
    const overlap = item.capabilityIds.filter((id) => claimed.has(id));
    // Allow overlap on secondary ids if primary id is unique to this rec
    if (
      overlap.length > 0 &&
      overlap.length === item.capabilityIds.length &&
      kept.some((k) => k.capabilityIds.some((id) => item.capabilityIds.includes(id)))
    ) {
      continue;
    }
    for (const id of item.capabilityIds) claimed.add(id);
    kept.push(item);
  }
  return kept;
}

export function rankCreativeRecommendations(
  items: CreativeDirectorRecommendation[],
): CreativeDirectorRecommendation[] {
  return [...items].sort(
    (a, b) =>
      IMPACT_RANK[b.impact] - IMPACT_RANK[a.impact] ||
      b.impactScore - a.impactScore ||
      b.confidence - a.confidence ||
      a.id.localeCompare(b.id),
  );
}

export function limitCreativeRecommendations(
  items: CreativeDirectorRecommendation[],
  limit: number,
): CreativeDirectorRecommendation[] {
  return items.slice(0, Math.max(0, limit));
}

export function creativeDirectorFingerprint(project: BusinessProject): string {
  return JSON.stringify({
    completeness: scoreWebsiteCompleteness(project),
    heroImageId: project.heroImageId,
    logoAssetId: project.logoAssetId ?? null,
    gallery: project.galleryImageIds,
    polish: project.creativePolish ?? null,
    design: project.designSections
      ? {
          enabled: project.designSections.enabled,
          t: project.designSections.testimonials?.length ?? 0,
          f: project.designSections.faq?.length ?? 0,
          team: project.designSections.team?.length ?? 0,
        }
      : null,
    cta: project.primaryCta,
    siteWidth: project.siteWidth,
    fonts: [project.headingFont, project.bodyFont],
    colors: [project.primaryColor, project.accentColor],
    form: project.contact.formEnabled !== false,
  });
}

function buildStrengths(project: BusinessProject): string[] {
  const strengths: string[] = [];
  if (project.heroHeadline.trim().length >= 12) {
    strengths.push("Your headline copy is clear and confident.");
  }
  if (project.description.trim().length >= 80) {
    strengths.push("Your About story has substance.");
  }
  if (project.services.length >= 2) {
    strengths.push("Your services are easy to understand.");
  }
  if (project.heroImageId) {
    strengths.push("You already have a real hero image.");
  }
  if (project.designSections?.testimonials?.length) {
    strengths.push("Customer voices are already on the page.");
  }
  if (project.creativePolish?.motion) {
    strengths.push("Subtle motion is already in place.");
  }
  if (strengths.length === 0) {
    strengths.push("There’s a solid foundation to build on.");
  }
  return strengths.slice(0, 4);
}

function buildNarrative(
  project: BusinessProject,
  completeness: number,
  maturity: CreativeDirectorReport["maturityLevel"],
  recommendations: CreativeDirectorRecommendation[],
  strengths: string[],
): string {
  const top = recommendations.slice(0, 5).map((r) => `✓ ${r.title}`);
  const strengthLead = strengths[0] ?? "There’s a solid foundation here.";
  const visualGap = recommendations.some((r) => r.kind === "visual");
  const mid = visualGap
    ? "Your copy is strong, but visually the site still feels incomplete."
    : "The structure is coming together — a few targeted upgrades will push it over the line.";

  return [
    "I reviewed your website.",
    strengthLead.replace(/\.$/, "") + ".",
    mid,
    "",
    `Overall completeness: ${completeness}% · ${maturity}`,
    "",
    "The biggest opportunities are:",
    ...top,
  ].join("\n");
}

/**
 * Full Creative Director review.
 */
export function reviewCreativeDirector(
  input: CreativeDirectorInput,
): CreativeDirectorReport {
  const project = input.project;
  if (!project || typeof project !== "object") {
    throw new Error("A current project is required.");
  }

  const completeness = scoreWebsiteCompleteness(project);
  const maturityLevel = classifyMaturityLevel(completeness);
  const missingCapabilities = detectMissingCapabilities(project);
  const strengths = buildStrengths(project);

  const ranked = limitCreativeRecommendations(
    rankCreativeRecommendations(
      suppressDuplicateCreativeRecommendations(
        buildCreativeRecommendations(project),
      ),
    ),
    input.limit ?? CREATIVE_DIRECTOR_TOP_N,
  );

  return {
    overallCompleteness: completeness,
    maturityLevel,
    missingCapabilities,
    recommendedImprovements: ranked,
    strengths,
    narrative: buildNarrative(
      project,
      completeness,
      maturityLevel,
      ranked,
      strengths,
    ),
    reviewedAt: new Date().toISOString(),
    fingerprint: creativeDirectorFingerprint(project),
    offerCompleteWebsite: completeness < COMPLETE_WEBSITE_THRESHOLD,
  };
}

/**
 * Build the full “Complete My Website” improvement plan.
 */
export function planCompleteWebsite(
  project: BusinessProject,
): CompleteWebsitePlan {
  const report = reviewCreativeDirector({
    project,
    limit: COMPLETE_WEBSITE_TOP_N,
  });
  return {
    recommendations: report.recommendedImprovements,
    narrative: [
      "Here’s everything I’d add to make this feel launch-ready.",
      "",
      ...report.recommendedImprovements.map((r) => `• ${r.title}`),
      "",
      "You can Apply All, or pick individual improvements.",
    ].join("\n"),
    overallCompleteness: report.overallCompleteness,
    maturityLevel: report.maturityLevel,
  };
}

export function shouldRefreshCreativeDirector(
  previous: CreativeDirectorReport | null | undefined,
  project: BusinessProject,
): boolean {
  if (!previous) return true;
  return previous.fingerprint !== creativeDirectorFingerprint(project);
}
