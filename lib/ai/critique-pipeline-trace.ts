/**
 * Critique pipeline stage tracing (Sprint 28.0B follow-up).
 * Safe diagnostics only — never prompts, field values, or raw bodies.
 */

import { captureMessage } from "@/lib/monitoring";
import type { CritiqueFallbackReason } from "@/lib/ai/design-critique-types";

export const CRITIQUE_PIPELINE_STAGES = [
  "provider_select",
  "context_build",
  "openai_request",
  "openai_http",
  "response_status",
  "structured_parse",
  "schema_validate",
  "secondary_validate",
  "critique_to_operations",
  "fallback",
  "complete",
] as const;

export type CritiquePipelineStage = (typeof CRITIQUE_PIPELINE_STAGES)[number];

export type CritiqueStageRecord = {
  stage: CritiquePipelineStage;
  ok: boolean;
  atMs: number;
  detail?: string | null;
};

export type CritiquePipelineTrace = {
  atlasRequestId: string;
  openaiRequestId: string | null;
  provider: "openai" | "mock";
  model: string;
  httpStatus: number | null;
  responseStatus: string | null;
  structuredParseOk: boolean | null;
  schemaValidationOk: boolean | null;
  secondaryValidationOk: boolean | null;
  critiqueToOperationsOk: boolean | null;
  usedFallback: boolean;
  fallbackReason: CritiqueFallbackReason | null;
  failingStage: CritiquePipelineStage | null;
  failingFunction: string | null;
  exceptionName: string | null;
  exceptionMessage: string | null;
  stages: CritiqueStageRecord[];
  startedAt: number;
};

export function createCritiquePipelineTrace(input: {
  atlasRequestId: string;
  provider: "openai" | "mock";
  model: string;
}): CritiquePipelineTrace {
  return {
    atlasRequestId: input.atlasRequestId,
    openaiRequestId: null,
    provider: input.provider,
    model: input.model,
    httpStatus: null,
    responseStatus: null,
    structuredParseOk: null,
    schemaValidationOk: null,
    secondaryValidationOk: null,
    critiqueToOperationsOk: null,
    usedFallback: false,
    fallbackReason: null,
    failingStage: null,
    failingFunction: null,
    exceptionName: null,
    exceptionMessage: null,
    stages: [],
    startedAt: Date.now(),
  };
}

export function recordCritiqueStage(
  trace: CritiquePipelineTrace,
  stage: CritiquePipelineStage,
  ok: boolean,
  detail?: string | null,
): void {
  trace.stages.push({
    stage,
    ok,
    atMs: Date.now() - trace.startedAt,
    detail: detail ?? null,
  });
  if (!ok && !trace.failingStage) {
    trace.failingStage = stage;
  }
}

export function markCritiqueFailure(
  trace: CritiquePipelineTrace,
  input: {
    stage: CritiquePipelineStage;
    fn: string;
    error: unknown;
    category?: CritiqueFallbackReason | null;
  },
): void {
  recordCritiqueStage(trace, input.stage, false, input.fn);
  trace.failingStage = input.stage;
  trace.failingFunction = input.fn;
  if (input.error instanceof Error) {
    trace.exceptionName = input.error.name;
    // Safe: already sanitized AiError / categorized messages only
    trace.exceptionMessage = input.error.message.slice(0, 240);
  } else {
    trace.exceptionName = "Unknown";
    trace.exceptionMessage = "Non-Error throw";
  }
  if (input.category) {
    trace.fallbackReason = input.category;
  }
}

/** Log stage trace without secrets / prompts / raw payloads. */
export function logCritiquePipelineTrace(trace: CritiquePipelineTrace): void {
  captureMessage({
    message: `ai.critique.pipeline ${trace.usedFallback ? "fallback" : "ok"}`,
    level: trace.usedFallback || trace.failingStage ? "warning" : "info",
    context: {
      tags: {
        route: "ai.critique.pipeline",
        provider: trace.provider,
      },
      extra: {
        event: "ai.critique.pipeline",
        atlasRequestId: trace.atlasRequestId,
        openaiRequestId: trace.openaiRequestId,
        provider: trace.provider,
        model: trace.model,
        httpStatus: trace.httpStatus,
        responseStatus: trace.responseStatus,
        structuredParseOk: trace.structuredParseOk,
        schemaValidationOk: trace.schemaValidationOk,
        secondaryValidationOk: trace.secondaryValidationOk,
        critiqueToOperationsOk: trace.critiqueToOperationsOk,
        usedFallback: trace.usedFallback,
        fallbackReason: trace.fallbackReason,
        failingStage: trace.failingStage,
        failingFunction: trace.failingFunction,
        exceptionName: trace.exceptionName,
        exceptionMessage: trace.exceptionMessage,
        stages: trace.stages,
        latencyMs: Date.now() - trace.startedAt,
      },
    },
  });
}
