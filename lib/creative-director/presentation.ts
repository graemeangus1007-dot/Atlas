/**
 * Creative Director presentation — summaries, personality, Health 2.0, diagnostics.
 * User-facing text must never leak internal IDs.
 */

import type {
  ConversionEvaluation,
  CreativeDirectorDiagnostics,
  CreativeDirectorRecommendation,
  CrossSectionInsight,
  DesignConsistencyEvaluation,
  ExecutiveSummary,
  FlowEvaluation,
  NarrativeEvaluation,
  PageSectionInventory,
  PersonalityEvaluation,
  RhythmEvaluation,
  SectionEvaluation,
  TrustEvaluation,
  WebsiteDimensionScores,
  WebsiteHealthV2,
  WebsitePersonalityTrait,
  WebsiteSectionId,
} from "@/lib/creative-director/types";

const INTERNAL_ID_LEAK =
  /\b(imp-|principle\.|hero\.[a-z_]+|trust\.[a-z_]+|pattern\.|sectionType:)/i;

export function textExposesInternalIds(text: string): boolean {
  return INTERNAL_ID_LEAK.test(text);
}

export function evaluatePersonality(
  inventory: PageSectionInventory,
): PersonalityEvaluation {
  const traits: WebsitePersonalityTrait[] = [];
  const tone = `${inventory.businessTone} ${inventory.designLanguage} ${inventory.industry}`.toLowerCase();

  if (/luxury|estate|high[- ]end|premium|boutique/.test(tone)) {
    traits.push("luxury", "premium");
  }
  if (/modern|contemporary|tech|gym|fitness/.test(tone)) {
    traits.push("modern");
  }
  if (/friendly|family|dental|restaurant|cafe|warm/.test(tone)) {
    traits.push("friendly", "warm", "approachable");
  }
  if (/industrial|contractor|roof|plumb|electric|builder/.test(tone)) {
    traits.push("industrial", "professional", "confident");
  }
  if (/law|legal|attorney|accountant/.test(tone)) {
    traits.push("professional", "trustworthy", "confident");
  }
  if (/photo|creative|studio|bold/.test(tone)) {
    traits.push("bold", "modern");
  }
  if (/minimal|clean/.test(tone)) {
    traits.push("minimal");
  }
  if (traits.length === 0) {
    traits.push("professional", "approachable", "trustworthy");
  }

  const unique = [...new Set(traits)].slice(0, 4);
  return {
    primary: unique,
    explanation: `The site reads as ${unique.join(", ")} based on industry cues, tone, and how the page presents itself.`,
  };
}

export function evaluateDesignConsistency(
  inventory: PageSectionInventory,
): DesignConsistencyEvaluation {
  const issues: DesignConsistencyEvaluation["issues"] = [];
  let score = 82;

  if (inventory.headingFont === inventory.bodyFont) {
    // Not necessarily bad — note lightly
  } else if (
    /playfair|lora/.test(inventory.headingFont) &&
    /inter|manrope/.test(inventory.bodyFont)
  ) {
    score += 4;
  }

  if (!inventory.visualHierarchy) {
    issues.push({
      kind: "hierarchy",
      explanation: "Visual hierarchy polish is off — headings may compete equally.",
    });
    score -= 10;
  }

  if (inventory.spacing === "default" && inventory.servicesCount > 6) {
    issues.push({
      kind: "spacing",
      explanation: "Dense services with default spacing can feel uneven.",
    });
    score -= 6;
  }

  if (!inventory.hasHeroImage && inventory.gallerySlots > 0) {
    issues.push({
      kind: "imagery",
      explanation: "Gallery imagery exists without a hero image to set the visual language.",
    });
    score -= 8;
  }

  return {
    score: Math.max(0, Math.min(100, score)),
    issues,
    explanation:
      issues.length === 0
        ? "Spacing, type, and imagery language feel coordinated."
        : issues[0]!.explanation,
  };
}

export function buildCrossSectionInsights(input: {
  inventory: PageSectionInventory;
  sections: SectionEvaluation[];
  flow: FlowEvaluation;
  trust: TrustEvaluation;
}): CrossSectionInsight[] {
  const insights: CrossSectionInsight[] = [];
  const inv = input.inventory;

  if (
    /craft|quality|premium|luxury|beautiful/i.test(inv.heroHeadline + inv.heroSubheadline) &&
    inv.gallerySlots < 3
  ) {
    insights.push({
      severity: "high",
      relatedSections: ["hero", "gallery"],
      explanation:
        "The hero promises craftsmanship, but the gallery doesn’t prove it yet.",
    });
  }

  if (inv.testimonialCount === 0 && inv.present.has("contact")) {
    insights.push({
      severity: "high",
      relatedSections: ["services", "testimonials", "contact"],
      explanation:
        "The CTA appears before visitors have enough trust from customer proof.",
    });
  }

  if (
    inv.testimonialCount > 0 &&
    inv.order.indexOf("testimonials") > inv.order.indexOf("services") + 2
  ) {
    insights.push({
      severity: "medium",
      relatedSections: ["services", "testimonials"],
      explanation:
        "The testimonials belong directly after services, where the trust question is freshest.",
    });
  }

  if (inv.description.length > 450 && inv.servicesCount <= 3) {
    insights.push({
      severity: "medium",
      relatedSections: ["about", "services"],
      explanation:
        "The About section is too long relative to the rest of the page.",
    });
  }

  if (
    inv.hasAboutCopy &&
    inv.servicesCount > 0 &&
    inv.description.toLowerCase().includes("service")
  ) {
    insights.push({
      severity: "low",
      relatedSections: ["about", "services"],
      explanation:
        "The services section may repeat information already explained in About.",
    });
  }

  for (const issue of input.flow.issues.slice(0, 2)) {
    insights.push({
      severity: issue.severity,
      relatedSections: ["hero", "contact"],
      explanation: issue.explanation,
    });
  }

  // Dedupe by explanation
  const seen = new Set<string>();
  return insights.filter((i) => {
    const key = i.explanation.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 6);
}

export function buildCreativeDirectorRecommendations(input: {
  inventory: PageSectionInventory;
  sections: SectionEvaluation[];
  flow: FlowEvaluation;
  trust: TrustEvaluation;
  conversion: ConversionEvaluation;
  insights: CrossSectionInsight[];
}): CreativeDirectorRecommendation[] {
  const recs: CreativeDirectorRecommendation[] = [];

  if (input.inventory.testimonialCount === 0) {
    recs.push({
      title: "Place proof before the ask",
      creativeDirectorExplanation:
        "Visitors need evidence before they're asked to contact you. Adding testimonials immediately after your services answers the natural question: “Can I trust this company?”",
      priority: "high",
      theme: "trust",
      relatedSections: ["services", "testimonials", "contact"],
      estimatedImpact: 28,
    });
  } else if (
    input.flow.issues.some((i) => i.kind === "testimonials_too_late")
  ) {
    recs.push({
      title: "Move testimonials beneath services",
      creativeDirectorExplanation:
        "Visitors need evidence before they're asked to contact you. Moving testimonials immediately after your services answers the natural question: “Can I trust this company?”",
      priority: "high",
      theme: "flow",
      relatedSections: ["services", "testimonials"],
      estimatedImpact: 24,
    });
  }

  if (input.inventory.gallerySlots < 3) {
    recs.push({
      title: "Strengthen proof imagery",
      creativeDirectorExplanation:
        "Your hero sets an expectation of quality. A stronger gallery — especially finished work and before/after moments — makes that promise feel earned instead of claimed.",
      priority: "high",
      theme: "imagery",
      relatedSections: ["hero", "gallery"],
      estimatedImpact: 22,
    });
  }

  if (input.conversion.ctaClarity < 60) {
    recs.push({
      title: "Clarify the primary next step",
      creativeDirectorExplanation:
        "The call-to-action should sound like a real next step for this business, not a generic button. Clear wording raises decision confidence at the exact moment intent appears.",
      priority: "medium",
      theme: "conversion",
      relatedSections: ["hero", "contact"],
      estimatedImpact: 16,
    });
  }

  if (input.flow.issues.some((i) => i.kind === "information_overload")) {
    recs.push({
      title: "Reduce message overload",
      creativeDirectorExplanation:
        "The page currently asks visitors to process too much at once. Tightening About and focusing services on the highest-value offers restores momentum.",
      priority: "medium",
      theme: "narrative",
      relatedSections: ["about", "services"],
      estimatedImpact: 14,
    });
  }

  // Pull high-priority section recommendations
  for (const section of input.sections) {
    for (const r of section.recommendations) {
      if (r.priority !== "high") continue;
      if (recs.some((x) => x.theme === r.theme && x.title === r.title)) continue;
      recs.push({
        title: r.title,
        creativeDirectorExplanation: r.explanation,
        priority: r.priority,
        theme: r.theme,
        relatedSections: [section.sectionId],
        estimatedImpact: 12,
      });
    }
  }

  return recs
    .sort((a, b) => b.estimatedImpact - a.estimatedImpact)
    .slice(0, 6);
}

export function buildExecutiveSummary(input: {
  dimensions: WebsiteDimensionScores;
  inventory: PageSectionInventory;
  recommendations: CreativeDirectorRecommendation[];
  personality: PersonalityEvaluation;
  trust: TrustEvaluation;
}): ExecutiveSummary {
  const overall = input.dimensions.overallDesignScore;
  const entries = Object.entries(input.dimensions).filter(
    ([k]) => k !== "overallDesignScore",
  ) as Array<[keyof WebsiteDimensionScores, number]>;
  const strongest = [...entries].sort((a, b) => b[1] - a[1])[0];
  const weakest = [...entries].sort((a, b) => a[1] - b[1])[0];

  const strengthLabel: Record<string, string> = {
    firstImpression: "Strong first impression with cohesive branding",
    trust: "Trust signals support the offer",
    conversion: "Conversion path is clear",
    narrativeFlow: "Story progresses cleanly",
    visualHierarchy: "Hierarchy guides the eye",
    brandConsistency: "Brand presentation feels coordinated",
    professionalism: "Overall professional presence",
    visualRhythm: "Healthy visual pacing",
  };

  const weaknessLabel: Record<string, string> = {
    trust: "Trust develops too slowly before the primary conversion request",
    conversion: "The conversion ask needs clearer confidence and next-step wording",
    narrativeFlow:
      "The page story loses momentum between promise and visual proof — trust never fully lands",
    firstImpression: "First impression is not yet distinctive enough",
    visualRhythm: "Section pacing feels heavy without recovery beats",
    sectionBalance: "Section weights feel uneven across the page",
  };

  const fastest =
    input.recommendations[0]?.creativeDirectorExplanation.split(".")[0] ||
    "Strengthen proof before the primary contact ask";

  const traits = input.personality.primary.slice(0, 2).join(" and ");
  const professionalAssessment =
    overall >= 85
      ? `This feels like a professionally designed ${traits} ${input.inventory.industry.toLowerCase()} website with only minor flow refinements left.`
      : overall >= 70
        ? `This feels like a solid ${traits} local website with clear opportunities to tighten trust flow and proof.`
        : `This reads as an early-stage ${traits} site — the promise is forming, but proof and conversion sequencing need agency-level attention.`;

  return {
    overallScore: overall,
    biggestStrength:
      strengthLabel[String(strongest?.[0])] ||
      "Cohesive brand direction on the homepage",
    biggestWeakness:
      weaknessLabel[String(weakest?.[0])] ||
      (input.trust.missing[0]
        ? `Missing ${input.trust.missing[0]!.toLowerCase()} weakens confidence before contact`
        : "Trust and proof sequencing need work"),
    fastestImprovement: fastest.endsWith(".") ? fastest : `${fastest}.`,
    professionalAssessment,
  };
}

export function buildWebsiteHealthV2(
  dimensions: WebsiteDimensionScores,
): WebsiteHealthV2 {
  return {
    overall: dimensions.overallDesignScore,
    design: Math.round(
      (dimensions.visualHierarchy +
        dimensions.whitespace +
        dimensions.sectionBalance +
        dimensions.professionalism) /
        4,
    ),
    trust: dimensions.trust,
    conversion: dimensions.conversion,
    narrative: dimensions.narrativeFlow,
    visualHierarchy: dimensions.visualHierarchy,
    readability: Math.round(
      (dimensions.scanability + dimensions.accessibility + dimensions.whitespace) /
        3,
    ),
    brand: dimensions.brandConsistency,
    mobile: dimensions.mobileExperience,
    accessibility: dimensions.accessibility,
    professionalism: dimensions.professionalism,
  };
}

export function buildDiagnostics(input: {
  dimensions: WebsiteDimensionScores;
  flow: FlowEvaluation;
  rhythm: RhythmEvaluation;
  trust: TrustEvaluation;
  conversion: ConversionEvaluation;
  narrative: NarrativeEvaluation;
  sections: SectionEvaluation[];
  recommendations: CreativeDirectorRecommendation[];
  executiveSummary: ExecutiveSummary;
}): CreativeDirectorDiagnostics {
  const present = input.sections.filter((s) => s.present && s.score > 0);
  const strongest = [...present].sort((a, b) => b.score - a.score)[0];
  const weakest = [...present].sort((a, b) => a.score - b.score)[0];
  const sectionScores: Record<string, number> = {};
  for (const s of input.sections) {
    sectionScores[s.sectionId] = s.score;
  }

  return {
    overallScore: input.dimensions.overallDesignScore,
    flowScore: input.flow.score,
    rhythmScore: input.rhythm.score,
    trustScore: input.trust.score,
    conversionScore: input.conversion.score,
    narrativeScore: input.narrative.score,
    sectionScores,
    strongestSection: (strongest?.sectionId ?? null) as WebsiteSectionId | null,
    weakestSection: (weakest?.sectionId ?? null) as WebsiteSectionId | null,
    highestROIRecommendation: input.recommendations[0]?.title ?? null,
    creativeDirectorSummary: input.executiveSummary.professionalAssessment,
  };
}

export function logCreativeDirectorDiagnostics(
  diagnostics: CreativeDirectorDiagnostics,
  requestId?: string | null,
): void {
  if (typeof console === "undefined" || !console.info) return;
  console.info("[atlas:creative-director]", {
    requestId: requestId ?? null,
    ...diagnostics,
  });
}
