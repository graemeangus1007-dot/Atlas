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
  AI_CREATE_PROJECT_EDITOR_PATH,
} from "@/lib/ai/create-project-constants";
// createProjectFromDraft is server-only — import from
// @/lib/ai/create-project-from-draft in Route Handlers, not the barrel.
export {
  mapDraftToBusinessProject,
  mapDraftToProjectSeo,
  mapIndustryToBusinessType,
} from "@/lib/ai/draft-to-project";
export {
  allToneDesigns,
  designFromTone,
  normalizeBrandTone,
} from "@/lib/ai/tone-design";
export {
  normalizeIdempotencyKey,
  validateGeneratedWebsiteDraft,
} from "@/lib/ai/validate-draft";
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
export { questionnaireToGenerateInput } from "@/lib/ai/questionnaire-map";
export {
  AI_QUESTIONNAIRE_STORAGE_EVENT,
  clearAiQuestionnaire,
  loadAiQuestionnaire,
  saveAiQuestionnaire,
} from "@/lib/ai/questionnaire-storage";
export {
  isAiQuestionnaireComplete,
  isAiQuestionnaireStepValid,
  splitServiceLines,
  validateAiQuestionnaireStep,
} from "@/lib/ai/questionnaire-validation";
export type {
  AiErrorCode,
  AiProvider,
  AiProviderId,
  GenerateWebsiteFailure,
  GenerateWebsiteInput,
  GenerateWebsiteQuestionnaire,
  GenerateWebsiteResult,
  GenerateWebsiteSuccess,
  GeneratedContact,
  GeneratedSeo,
  GeneratedService,
  GeneratedWebsiteDraft,
} from "@/lib/ai/types";
export type {
  AiProjectMeta,
  AiProjectSocialLinks,
  DraftToProjectInput,
  MappedAiProject,
} from "@/lib/ai/draft-to-project";
export type { ToneDesignDefaults } from "@/lib/ai/tone-design";
export type {
  CreateProjectFromDraftInput,
  CreateProjectFromDraftResult,
} from "@/lib/ai/create-project-from-draft";
