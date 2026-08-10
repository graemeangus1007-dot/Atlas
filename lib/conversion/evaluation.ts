/**
 * Conversion Director evaluation orchestrator (advisory only).
 */

import { buildPageSectionInventory } from "@/lib/creative-director/inventory";
import { scoreContactFlow, scoreObjectionHandling } from "@/lib/conversion/contact";
import { scoreCtaStrength } from "@/lib/conversion/cta";
import { scoreFriction } from "@/lib/conversion/friction";
import { scoreOfferStrength } from "@/lib/conversion/offers";
import { scoreProof } from "@/lib/conversion/proof";
import { buildConversionRecommendations } from "@/lib/conversion/recommendations";
import { scoreTrust } from "@/lib/conversion/trust";
import { scoreUrgency } from "@/lib/conversion/urgency";
import {
  CONVERSION_DIRECTOR_VERSION,
  type ConversionDimensionId,
  type ConversionEvaluation,
  type ConversionSignals,
} from "@/lib/conversion/types";
import type { BusinessProject } from "@/types/business-project";
import type { DesignStrategyInput } from "@/lib/ai/design-strategy-types";

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function collectConversionSignals(input: {
  project: BusinessProject;
  strategyInput?: DesignStrategyInput | null;
}): ConversionSignals {
  const inventory = buildPageSectionInventory({
    project: input.project,
    strategyInput: input.strategyInput,
  });
  return {
    industry: inventory.industry,
    heroHeadline: inventory.heroHeadline,
    heroSubheadline: inventory.heroSubheadline,
    primaryCta: inventory.primaryCta,
    secondaryCta: input.project.secondaryCta?.trim() ?? "",
    servicesCount: inventory.servicesCount,
    gallerySlots: inventory.gallerySlots,
    testimonialCount: inventory.testimonialCount,
    faqCount: inventory.faqCount,
    hasPricing: inventory.hasPricing,
    hasBookingCta: inventory.hasBookingCta,
    proofBeforeAsk: inventory.proofBeforeAsk,
    contactPhone: inventory.contactPhone,
    contactEmail: inventory.contactEmail,
    contactLocation: inventory.contactLocation,
    formEnabled: input.project.contact?.formEnabled !== false,
    hasHeroImage: inventory.hasHeroImage,
    completeness: inventory.completeness,
  };
}

export function evaluateConversion(input: {
  project: BusinessProject;
  strategyInput?: DesignStrategyInput | null;
}): ConversionEvaluation {
  const signals = collectConversionSignals(input);
  const trust = scoreTrust(signals);
  const offer = scoreOfferStrength(signals);
  const cta = scoreCtaStrength(signals);
  const proof = scoreProof(signals);
  const friction = scoreFriction(signals);
  const urgency = scoreUrgency(signals);
  const contact = scoreContactFlow(signals);
  const objections = scoreObjectionHandling(signals);

  const scores: Record<ConversionDimensionId, number> = {
    trust: trust.score,
    offerStrength: offer.score,
    ctaStrength: cta.score,
    proof: proof.score,
    friction: friction.score,
    urgency: urgency.score,
    contactFlow: contact.score,
    objectionHandling: objections.score,
  };

  const overallConversion = clamp(
    trust.score * 0.16 +
      offer.score * 0.14 +
      cta.score * 0.16 +
      proof.score * 0.16 +
      friction.score * 0.12 +
      urgency.score * 0.08 +
      contact.score * 0.1 +
      objections.score * 0.08,
  );

  const ordered = (
    Object.entries(scores) as Array<[ConversionDimensionId, number]>
  ).sort((a, b) => a[1] - b[1]);
  const highestPriorityImprovement =
    ordered[0] && ordered[0][1] < 78 ? ordered[0][0] : null;

  const strengths = [
    ...trust.strengths,
    ...offer.strengths,
    ...cta.strengths,
    ...proof.strengths,
    ...friction.strengths,
    ...contact.strengths,
    ...objections.strengths,
  ].slice(0, 5);

  const weaknesses = [
    ...trust.weaknesses,
    ...offer.weaknesses,
    ...cta.weaknesses,
    ...proof.weaknesses,
    ...friction.weaknesses,
    ...contact.weaknesses,
    ...objections.weaknesses,
    ...urgency.weaknesses,
  ].slice(0, 5);

  const recommendations = buildConversionRecommendations({
    scores,
    signals,
    highestPriorityImprovement,
    // Safe CTA refine needs a real contact/destination — not fabricated offers.
    ctaCanRefineSafely:
      scores.ctaStrength < 70 &&
      (signals.formEnabled ||
        Boolean(signals.contactPhone?.trim()) ||
        Boolean(signals.contactEmail?.trim()) ||
        signals.servicesCount >= 2),
  });

  const businessInputNeeded = recommendations
    .filter((r) => r.requiresBusinessInput)
    .map((r) => r.title);

  let confidence = 0.78;
  if (signals.testimonialCount > 0) confidence += 0.04;
  if (signals.gallerySlots > 0) confidence += 0.04;
  if (signals.faqCount > 0) confidence += 0.03;
  confidence = Math.min(0.95, confidence);

  const summary =
    overallConversion >= 78
      ? "Conversion fundamentals are solid — remaining gains are refinements to proof, CTA specificity, and friction."
      : "Conversion has clear gaps. Prioritize trust and proof before the ask, then tighten CTA and contact flow.";

  return {
    version: CONVERSION_DIRECTOR_VERSION,
    evaluatedAt: new Date().toISOString(),
    overallConversion,
    trust: scores.trust,
    offerStrength: scores.offerStrength,
    ctaStrength: scores.ctaStrength,
    proof: scores.proof,
    friction: scores.friction,
    urgency: scores.urgency,
    contactFlow: scores.contactFlow,
    objectionHandling: scores.objectionHandling,
    highestPriorityImprovement,
    confidence,
    strengths: strengths.length ? strengths : ["The page has a basic conversion path."],
    weaknesses: weaknesses.length
      ? weaknesses
      : ["No major conversion gaps detected."],
    recommendations,
    businessInputNeeded,
    summary,
  };
}
