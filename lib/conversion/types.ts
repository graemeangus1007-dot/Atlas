/**
 * Conversion Director (Phase 1) — advisory conversion intelligence.
 * Owns trust, CTA, offer, proof, friction, urgency, contact, lead generation.
 * Never mutates layout, spacing polish, hero composition, or brand colors.
 */

import type { RecommendationDomain } from "@/lib/scope/types";

export const CONVERSION_DIRECTOR_VERSION = "1.0.0";

export type ConversionDimensionId =
  | "trust"
  | "offerStrength"
  | "ctaStrength"
  | "proof"
  | "friction"
  | "urgency"
  | "contactFlow"
  | "objectionHandling";

export type ConversionRecommendation = {
  owner: "conversion_director";
  domain: RecommendationDomain;
  title: string;
  explanation: string;
  priority: "high" | "medium" | "low";
  estimatedImpact: number;
  /** True when the business must supply real-world facts. */
  requiresBusinessInput: boolean;
  improves: ConversionDimensionId[];
};

export type ConversionEvaluation = {
  version: string;
  evaluatedAt: string;
  overallConversion: number;
  trust: number;
  offerStrength: number;
  ctaStrength: number;
  proof: number;
  friction: number;
  urgency: number;
  contactFlow: number;
  objectionHandling: number;
  highestPriorityImprovement: ConversionDimensionId | null;
  confidence: number;
  strengths: string[];
  weaknesses: string[];
  recommendations: ConversionRecommendation[];
  /** Items that need real business input before execution. */
  businessInputNeeded: string[];
  summary: string;
};

export type ConversionSignals = {
  industry: string;
  heroHeadline: string;
  heroSubheadline: string;
  primaryCta: string;
  secondaryCta: string;
  servicesCount: number;
  gallerySlots: number;
  testimonialCount: number;
  faqCount: number;
  hasPricing: boolean;
  hasBookingCta: boolean;
  proofBeforeAsk: boolean;
  contactPhone: string;
  contactEmail: string;
  contactLocation: string;
  formEnabled: boolean;
  hasHeroImage: boolean;
  completeness: number;
};
