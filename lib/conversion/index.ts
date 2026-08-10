export {
  CONVERSION_DIRECTOR_VERSION,
  type ConversionDimensionId,
  type ConversionEvaluation,
  type ConversionRecommendation,
  type ConversionSignals,
} from "@/lib/conversion/types";

export { scoreTrust } from "@/lib/conversion/trust";
export { scoreOfferStrength } from "@/lib/conversion/offers";
export { scoreCtaStrength } from "@/lib/conversion/cta";
export { scoreFriction } from "@/lib/conversion/friction";
export { scoreProof } from "@/lib/conversion/proof";
export { scoreUrgency } from "@/lib/conversion/urgency";
export {
  scoreContactFlow,
  scoreObjectionHandling,
} from "@/lib/conversion/contact";

export {
  collectConversionSignals,
  evaluateConversion,
} from "@/lib/conversion/evaluation";

export { buildConversionRecommendations } from "@/lib/conversion/recommendations";

export {
  isConversionDirectorRequest,
  formatConversionDirectorReport,
  conversionTextExposesInternalIds,
  CONVERSION_DIRECTOR_FOLLOW_UPS,
} from "@/lib/conversion/presentation";
