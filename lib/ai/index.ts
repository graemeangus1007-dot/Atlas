/** Atlas AI — copywriter helpers + website generation foundation (Sprint 20.0A). */

export { generateSuggestions } from "@/lib/ai/generate-suggestions";
export { generateHeadlineSuggestions } from "@/lib/ai/generate-headline-suggestions";
export { generateAboutSuggestions } from "@/lib/ai/generate-about-suggestions";
export { generateServiceSuggestions } from "@/lib/ai/generate-service-suggestions";

export type { HeadlineSuggestionInput } from "@/lib/ai/generate-headline-suggestions";
export type { AboutSuggestionInput } from "@/lib/ai/generate-about-suggestions";
export type { ServiceSuggestionInput } from "@/lib/ai/generate-service-suggestions";

export {
  AiError,
  isAiError,
  safeAiErrorMessage,
  statusForCode,
} from "@/lib/ai/errors";
export {
  generateWebsiteDraft,
  normalizeGenerateWebsiteInput,
} from "@/lib/ai/generator";
export { buildMockWebsiteDraft, MockAiProvider } from "@/lib/ai/mock-provider";
export {
  DEFAULT_OPENAI_MODEL,
  OpenAiWebsiteProvider,
} from "@/lib/ai/openai-provider";
export {
  buildWebsiteSystemPrompt,
  buildWebsiteUserPrompt,
} from "@/lib/ai/prompts";
export {
  createAiProvider,
  getAiProviderId,
  getOpenAiModel,
  tryCreateAiProvider,
} from "@/lib/ai/provider";
export type {
  AiErrorCode,
  AiProvider,
  AiProviderId,
  GenerateWebsiteFailure,
  GenerateWebsiteInput,
  GenerateWebsiteResult,
  GenerateWebsiteSuccess,
  GeneratedContact,
  GeneratedSeo,
  GeneratedService,
  GeneratedWebsiteDraft,
} from "@/lib/ai/types";
