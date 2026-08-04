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
  AI_QUESTIONNAIRE_BROADCAST_CHANNEL,
  clearAiQuestionnaire,
  clearAiQuestionnaireSnapshotCache,
  getAiQuestionnaireServerSnapshot,
  getAiQuestionnaireSnapshot,
  isAiQuestionnaireNewer,
  loadAiQuestionnaire,
  saveAiQuestionnaire,
  subscribeAiQuestionnaire,
  aiQuestionnaireStorageKey,
} from "@/lib/ai/questionnaire-storage";
export type { SaveAiQuestionnaireResult } from "@/lib/ai/questionnaire-storage";
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
export {
  INTENT_CATEGORIES,
  INTENT_PRIORITY,
  routeIntent,
  shouldSkipBusinessReasoning,
} from "@/lib/ai/intent-router";
export type { IntentCategory, IntentRouteResult } from "@/lib/ai/intent-router";
export {
  findFaqIndexByQuestion,
  planExplicitContentEdits,
} from "@/lib/ai/content-edit-planner";
export {
  IMAGE_OPERATION_KINDS,
  SECTION_IMAGE_SLOTS,
  isImageOperationKind,
  isSectionImageSlot,
} from "@/lib/ai/image-operations";
export type {
  ImageOperation,
  ImageOperationKind,
  ImageTargetRef,
  SectionImageSlot,
} from "@/lib/ai/image-operations";
export { validateImageOperations } from "@/lib/ai/validate-image-operations";
export { applyImageOperations } from "@/lib/ai/apply-image-operations";
export {
  isImageEditRequest,
  planImageOperations,
  runImageAgent,
  tryRunImageAgent,
} from "@/lib/ai/image-agent";
export type {
  ImageAgentInput,
  ImageAgentResult,
  ImageEditorState,
} from "@/lib/ai/image-agent";
export type { AtlasAiOperation } from "@/lib/ai/editor-revisions";
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
export {
  ADVISOR_TOP_N,
  advisorProjectFingerprint,
  createAdvisorPipeline,
  limitTopRecommendations,
  rankAdvisorFindings,
  reviewBusinessProject,
  shouldRefreshAdvisorReport,
  suppressDuplicateFindings,
} from "@/lib/ai/business-advisor";
export { DEFAULT_ADVISOR_MODULES } from "@/lib/ai/advisor-modules";
export { applyAdvisorRecommendation } from "@/lib/ai/apply-advisor-recommendation";
export {
  assertInsertedSectionsVisible,
  createDefaultFaqItems,
  createDefaultTestimonials,
  isDesignSectionVisibleInContent,
  isDesignSectionVisibleInProject,
} from "@/lib/ai/design-sections-canonical";
export type { CanonicalFaqItem } from "@/lib/ai/design-sections-canonical";
export {
  CRITIQUE_CATEGORY_LABELS,
  CRITIQUE_CATEGORY_WEIGHTS,
  CRITIQUE_SCORE_CATEGORIES,
  scoreBusinessProject,
} from "@/lib/ai/critique-scoring";
export {
  critiqueCategoryForFinding,
  explainAdvisorFinding,
  impactLabel,
} from "@/lib/ai/critique-explanations";
export type {
  AdvisorCategory,
  AdvisorFinding,
  AdvisorImpact,
  AdvisorModule,
  AdvisorModuleId,
  BusinessAdvisorReport,
  BusinessRecommendation,
} from "@/lib/ai/business-advisor-types";
export type {
  CritiqueCategoryScores,
  CritiqueScoreBreakdown,
  CritiqueScoreCategory,
} from "@/lib/ai/critique-scoring";
export type { CritiqueExplanation } from "@/lib/ai/critique-explanations";
export type { ApplyAdvisorRecommendationResult, AdvisorApplyStatus } from "@/lib/ai/apply-advisor-recommendation";
export {
  reviewCreativeDirector,
  planCompleteWebsite,
  shouldRefreshCreativeDirector,
  buildCreativeRecommendations,
  suppressDuplicateCreativeRecommendations,
  rankCreativeRecommendations,
  creativeDirectorFingerprint,
  CREATIVE_DIRECTOR_TOP_N,
  COMPLETE_WEBSITE_TOP_N,
} from "@/lib/ai/creative-director";
export {
  detectMissingCapabilities,
  COMPLETENESS_CHECKS,
} from "@/lib/ai/creative-director-capabilities";
export {
  scoreWebsiteCompleteness,
  classifyMaturityLevel,
} from "@/lib/ai/creative-director-scoring";
export {
  applyCreativeRecommendation,
  applyAllCreativeRecommendations,
} from "@/lib/ai/apply-creative-recommendation";
export type {
  CreativeDirectorReport,
  CreativeDirectorRecommendation,
  CreativeMaturityLevel,
  CreativeRecommendationKind,
  MissingCapability,
  MissingCapabilityId,
  CompleteWebsitePlan,
  CreativeDirectorOperation,
} from "@/lib/ai/creative-director-types";
export { COMPLETE_WEBSITE_THRESHOLD } from "@/lib/ai/creative-director-types";
export type {
  ApplyCreativeRecommendationResult,
  ApplyAllCreativeResult,
  CreativeApplyStatus,
} from "@/lib/ai/apply-creative-recommendation";
export {
  decideAtlasBrain,
  formatExecutionPlanForUser,
  planAtlasBrain,
  runAtlasBrain,
  tryRunAtlasBrain,
} from "@/lib/ai/atlas-brain";
export {
  buildDesignCritiqueContext,
  buildMockDesignCritique,
  formatDesignCritiqueExplanation,
  isDesignCritiqueExecuteRequest,
  isDesignCritiqueRequest,
  runDesignCritique,
  validateDesignCritique,
} from "@/lib/ai/design-critique";
export {
  critiqueToOperations,
  critiqueToRecommendations,
  dedupeImprovements,
  dedupeOperations,
  formatRecommendationSupportPlan,
} from "@/lib/ai/critique-to-operations";
export {
  DESIGN_CRITIQUE_JSON_SCHEMA,
  DESIGN_CRITIQUE_SCHEMA_NAME,
  assertCritiqueSchemaStrictShape,
  buildOpenAiDesignCritiqueSchema,
  findUnsupportedOpenAiSchemaKeywords,
} from "@/lib/ai/design-critique-schema";
export {
  categorizeIncompleteReason,
  categorizeOpenAiFailure,
  formatFallbackUserMessage,
  sanitizeOpenAiSchemaError,
} from "@/lib/ai/openai-error-categories";
export {
  OPENAI_CRITIQUE_DEFAULTS,
  resolveOpenAiCritiqueOutputConfig,
} from "@/lib/ai/openai-config";
export {
  composeCritiqueAssistantContent,
  formatCritiqueFallback,
  formatCritiqueFallbackCard,
  parseCritiqueAssistantContent,
} from "@/lib/ai/critique-fallback-presentation";
export {
  CRITIQUE_CACHE_TTL_MS,
  CRITIQUE_PIPELINE_VERSION,
  CRITIQUE_PROMPT_VERSION,
  CRITIQUE_SCHEMA_VERSION,
  buildCritiqueCacheKey,
  buildDesignCritiquePrompt,
  getCritiquePipelineVersions,
  invalidateCritiquePipelineCache,
  invalidateCritiquePipelineCacheForProject,
  parseDesignCritiqueResponse,
  resetCritiquePipelineCacheForTests,
  runAtlasCritiquePipeline,
} from "@/lib/ai/critique-pipeline";
export {
  getAiRuntimeSnapshot,
  AI_RUNTIME_DEBUG_TEMPORARY,
} from "@/lib/ai/ai-runtime-diagnostics";
export type {
  DesignCritique,
  DesignCritiqueContext,
  DesignCritiqueMode,
  DesignCritiqueResult,
  CritiqueImprovement,
  CritiqueFallbackReason,
  ProposedChange,
} from "@/lib/ai/design-critique-types";
export {
  STRATEGY_VERSION,
  applyDesignStrategyToCritique,
  buildDesignStrategy,
  designStrategyInputFromContext,
  formatDesignStrategySection,
  prioritizeImprovementsByStrategy,
  runDesignStrategyPass,
  scoreImprovementAgainstStrategy,
  strategizeImprovementCopy,
} from "@/lib/ai/design-strategy";
export type {
  DesignAgencyTone,
  DesignFocusArea,
  DesignStrategy,
  DesignStrategyInput,
} from "@/lib/ai/design-strategy-types";
export {
  DESIGN_AGENCIES_TONES,
  DESIGN_FOCUS_AREAS,
} from "@/lib/ai/design-strategy-types";
export {
  DESIGN_KNOWLEDGE_REGISTRY,
  MAX_PROMPT_DESIGN_PRINCIPLES,
  countDesignPrinciplesByCategory,
  formatDesignPrinciplesForPrompt,
  getDesignPrincipleById,
  getDesignPrinciplesByCategory,
  listAllDesignPrinciples,
  rankDesignPrinciples,
  selectRelevantDesignPrinciples,
  textExposesDesignPrincipleIds,
} from "@/lib/ai/design-knowledge";
export type {
  DesignKnowledgeCategory,
  DesignKnowledgeEvidence,
  DesignKnowledgeSelectionContext,
  DesignPrinciple,
} from "@/lib/ai/design-knowledge";
export { selectPrinciplesForCritiquePrompt } from "@/lib/ai/design-critique-prompts";
export {
  decideWithAtlasBrainEngine,
  formatNaturalPreferenceNote,
  stageContinuation,
  stageExplicitCommand,
  stageNaturalLanguageEdit,
  stageCritique,
  stageExplicitDesign,
  stageBusinessGoal,
  stageQuestion,
  stageClarification,
  DECISION_STAGES,
  COMMAND_KINDS,
  CONFIDENCE_EXECUTE_IMMEDIATE,
  CONFIDENCE_EXECUTE_EXPLAIN,
  CONFIDENCE_CLARIFY,
} from "@/lib/ai/atlas-brain-decision-engine";
export {
  extractNaturalLanguageEditPlan,
  isNaturalLanguageEditRequest,
  planNaturalLanguageEdits,
  shouldExecuteNlEditPlan,
  NL_EDIT_EXECUTE_CONFIDENCE,
  NL_EDIT_PLANNER_VERSION,
} from "@/lib/ai/nl-edit-planner";
export type {
  NlEditCategory,
  NlEditPlan,
  NlEditPlanStep,
  NlEditPlannerInput,
} from "@/lib/ai/nl-edit-planner";
export {
  classifyCritiqueRequest,
  isCritiqueOrRedesignRequest,
  shouldOverridePendingClarification,
  CRITIQUE_ROUTING_PATH,
} from "@/lib/ai/critique-request";
export type {
  CritiqueClassification,
  CritiqueRouteIntent,
  CritiqueSignalId,
} from "@/lib/ai/critique-request";
export {
  applyImprovementRequest,
  parseCritiqueMessage,
  toExecutiveSummary,
} from "@/lib/ai/critique-message-presentation";
export type {
  CritiqueImprovementCard,
  ParsedCritiqueMessage,
} from "@/lib/ai/critique-message-presentation";
export type {
  DecisionStage,
  CommandKind,
  AtlasDecisionEngineResult,
  AtlasDecisionEngineInput,
} from "@/lib/ai/atlas-brain-decision-engine";
export {
  inferMemoryFromMessage,
  mergeAtlasMemory,
  updateAtlasMemory,
  formatMemoryContext,
  seedMemoryFromProject,
} from "@/lib/ai/atlas-brain-memory";
export type {
  AtlasAgentId,
  AtlasBrainDecision,
  AtlasBrainIntent,
  AtlasExecutionPlan,
  AtlasExecutionStep,
  AtlasProjectMemory,
} from "@/lib/ai/atlas-brain-types";
export { ATLAS_AGENT_IDS, ATLAS_BRAIN_CLARIFICATION_OPTIONS } from "@/lib/ai/atlas-brain-types";
export {
  ATLAS_VOICE,
  ATLAS_DESIGNER_CLARIFICATION_OPTIONS,
  ATLAS_BANNED_PHRASES,
  atlasProgressLabel,
  atlasAppliedSummary,
  buildClarificationQuestion,
  findBannedPhrase,
} from "@/lib/ai/atlas-designer-voice";
export type { AtlasBrainResult } from "@/lib/ai/atlas-brain";
export {
  detectActionConfirmation,
  resolvePlanReference,
  looksLikePlanReference,
  shouldExecuteActionMemory,
  storeRecommendations,
  storePendingClarification,
  clearPendingClarification,
  clearRecommendations,
  removeAppliedRecommendations,
  matchClarificationAnswer,
  hasActiveRecommendations,
  hasPendingClarification,
  getActionMemory,
  selectRecommendationsToApply,
  APPLY_ALL_PHRASES,
} from "@/lib/ai/atlas-action-memory";
export type {
  AtlasActionMemory,
  AtlasStoredRecommendation,
  AtlasPendingClarification,
  ActionConfirmation,
  ClarificationDestination,
  PlanReferenceResult,
} from "@/lib/ai/atlas-action-memory";
export {
  parseSectionMoveRequest,
  isSectionOrderRequest,
  moveSectionInOrder,
  getEffectiveSectionOrder,
} from "@/lib/ai/section-order";
export {
  isExecutionDisputeRequest,
  mergeExecutionResults,
  sectionDisplayName,
} from "@/lib/ai/edit-execution-result";
export type {
  AtlasLastExecution,
  EditExecutionResult,
} from "@/lib/ai/edit-execution-result";
export {
  applyStatusFromExecution,
  isSectionAlreadyAtIntent,
  isSectionPresentOnPage,
  verifyEditExecution,
  verifyEditOperation,
  verifyMoveSection,
} from "@/lib/ai/verify-edit-execution";
export { tryRepairDisputedExecution } from "@/lib/ai/execution-repair";
export {
  analyzeHeroReadability,
  buildHeroReadabilityExplanation,
  captureBrandPalette,
  defaultHeroPreservationContext,
  filterOperationsForBrandPreservation,
  getHeroReadabilityRepairLevel,
  heroTreatmentsToOperations,
  isBrandRegressionComplaint,
  isHeroReadabilityRequest,
  isUserReportedHeroDifficulty,
  planHeroReadabilityOperations,
  restoreBrandPalette,
  treatmentsForRepairLevel,
  verifyHeroReadabilityImprovement,
  withHeroReadabilityRepairLevel,
} from "@/lib/ai/hero-readability";
export type {
  EditPreservationContext,
  HeroReadabilityAssessment,
  HeroReadabilityIssue,
  HeroReadabilityRepairLevel,
  HeroReadabilityTreatment,
  HeroVisualAnalyzer,
  ProtectedBrandPalette,
} from "@/lib/ai/hero-readability";
export {
  analyzeHeroVisualBalance,
  isHeroImageVisibilityComplaint,
  isHeroVisualRepairRequest,
  planHeroBalanceRepair,
  verifyHeroBalanceRepair,
} from "@/lib/ai/hero-visual-balance";
export type {
  HeroBalanceDiagnostics,
  HeroTreatment,
  HeroVisualBalanceAssessment,
  HeroVisualBalanceIssue,
} from "@/lib/ai/hero-visual-balance";
export {
  storeLastExecution,
  getLastExecution,
} from "@/lib/ai/atlas-action-memory";
export {
  readMotionState,
  motionFieldsForPreset,
  desiredMotionPresetFromRequest,
  isMotionStateActive,
} from "@/lib/ai/motion-model";
export {
  resolveDesignSystem,
  designSystemToOperations,
  designSystemInputFromProject,
  detectPreferredLanguage,
  attachDesignSystem,
  imageryKeywordsForProject,
  formatDesignSystemReference,
  isDesignLanguageId,
  DESIGN_LANGUAGES,
  AUTO_APPLY_CONFIDENCE,
} from "@/lib/ai/design-system-intelligence";
export { DESIGN_LANGUAGE_IDS } from "@/lib/ai/design-system-types";
export type {
  DesignLanguageId,
  DesignSystem,
  DesignSystemInput,
  DesignSystemResolution,
  PersistedDesignSystem,
  TypographyStrategy,
  ColorStrategy,
  ImageryStyle,
  MotionStyle,
} from "@/lib/ai/design-system-types";
