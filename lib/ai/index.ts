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
export {
  coalesceNonEmpty,
  resolveGenerateIdentity,
} from "@/lib/ai/resolve-generate-input";
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
  WEBSITE_DRAFT_JSON_SCHEMA,
  WEBSITE_DRAFT_SCHEMA_NAME,
  buildOpenAiWebsiteResponseParams,
} from "@/lib/ai/openai-provider";
export type { OpenAiResponsesClient, OpenAiProviderOptions } from "@/lib/ai/openai-provider";
export {
  OPENAI_DEFAULTS,
  resolveOpenAiRuntimeConfig,
} from "@/lib/ai/openai-config";
export {
  isTransientAiError,
  withAiRetry,
} from "@/lib/ai/openai-retry";
export {
  buildSafeGenerationPayload,
  buildWebsiteDeveloperPrompt,
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
  clearAiQuestionnaireSnapshotCache,
  getAiQuestionnaireServerSnapshot,
  getAiQuestionnaireSnapshot,
  loadAiQuestionnaire,
  saveAiQuestionnaire,
  subscribeAiQuestionnaire,
} from "@/lib/ai/questionnaire-storage";
export {
  isAiQuestionnaireComplete,
  isAiQuestionnaireStepValid,
  splitServiceLines,
  validateAiQuestionnaireStep,
} from "@/lib/ai/questionnaire-validation";
export {
  allLayoutPresets,
  layoutPresetFromTone,
  normalizeLayoutPresetId,
} from "@/lib/ai/layout-presets";
export {
  AI_OPTIONAL_SECTION_IDS,
  AI_OPTIONAL_SECTION_LABELS,
  DEFAULT_OPTIONAL_SECTIONS,
  enabledOptionalSections,
  normalizeOptionalSections,
} from "@/lib/ai/optional-sections";
export {
  contrastRatio,
  meetsWcagAa,
  validateBrandContrast,
} from "@/lib/ai/contrast";
export { buildMediaPlaceholders } from "@/lib/ai/media-placeholders";
export {
  applySectionPatch,
  normalizeRegenerateSection,
  regenerateDraftSection,
} from "@/lib/ai/regenerate";
export type {
  AiErrorCode,
  AiProvider,
  AiProviderId,
  AiRegenerateSection,
  GenerateWebsiteFailure,
  GenerateWebsiteInput,
  GenerateWebsiteQuestionnaire,
  GenerateWebsiteResult,
  GenerateWebsiteSuccess,
  GeneratedContact,
  GeneratedSeo,
  GeneratedService,
  GeneratedWebsiteDraft,
  RegenerateSectionResult,
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

// Sprint 22.0A — Design Assistant foundation
export {
  applyEditOperations,
  mergeOptionalContentIntoDesignSections,
} from "@/lib/ai/apply-edit-operations";
export {
  EDIT_OPERATION_KINDS,
  EDIT_TEXT_TARGETS,
  INSERTABLE_SECTION_TYPES,
  REQUIRED_SECTION_IDS,
  isEditOperationKind,
  isEditTextTarget,
  isInsertableSectionType,
  isRequiredSectionId,
} from "@/lib/ai/edit-operations";
export type {
  EditChangeSummary,
  EditOperation,
  EditOperationKind,
  EditTextTarget,
  InsertableSectionType,
  ProjectDesignSections,
} from "@/lib/ai/edit-operations";
export {
  appendConversationMessage,
  createEmptyEditorConversation,
  serializeConversationForAgent,
} from "@/lib/ai/editor-conversation";
export type {
  EditorConversation,
  EditorConversationMessage,
} from "@/lib/ai/editor-conversation";
export {
  planEditOperations,
  planDirectEditOperations,
  runEditorAgent,
  tryRunEditorAgent,
} from "@/lib/ai/editor-agent";
export type {
  EditorAgentApplyStatus,
  EditorAgentFailure,
  EditorAgentHistoryItem,
  EditorAgentInput,
  EditorAgentResult,
} from "@/lib/ai/editor-agent";
export {
  DESIGN_GOAL_CATEGORIES,
  operationsFromDesignReasoning,
  reasonAboutDesign,
} from "@/lib/ai/design-reasoner";
export type {
  DesignGoalCategory,
  DesignReasonerInput,
  DesignReasoningResult,
} from "@/lib/ai/design-reasoner";
export {
  canRedoEditorRevision,
  canUndoEditorRevision,
  createEmptyRevisionStack,
  pushEditorRevision,
  redoEditorRevision,
  undoEditorRevision,
} from "@/lib/ai/editor-revisions";
export type {
  EditorRevision,
  EditorRevisionStack,
} from "@/lib/ai/editor-revisions";
export { validateEditOperations } from "@/lib/ai/validate-edit-operations";
export { requestEditorAgentEdit } from "@/lib/ai/request-editor-edit";
export {
  NAMED_COLORS,
  namedColorHex,
  parseThemeColorIntent,
  resolveNamedColor,
  wantsPreserveWording,
} from "@/lib/ai/named-colors";
export type { NamedColorId, ParsedThemeColors } from "@/lib/ai/named-colors";
export {
  applyAiFieldValue,
  createAiHistoryEntry,
  readAiFieldValue,
} from "@/lib/ai/apply-ai-field";
export {
  buildDesignAssistantMeta,
  createEmptyDesignAssistantMeta,
  hasMeaningfulProjectDiff,
  logDesignAssistantDiagnostic,
  readDesignAssistantLocal,
  restoreDesignAssistantState,
  toLocalStore,
  writeDesignAssistantLocal,
} from "@/lib/ai/editor-assistant-persistence";
export type { DesignAssistantPersistedMeta } from "@/lib/ai/editor-assistant-types";
