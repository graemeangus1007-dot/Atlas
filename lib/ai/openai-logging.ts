/**
 * Production-safe AI generation logging (Sprint 21.0A / 28.0B).
 * Never log prompt contents, API keys, or raw model payloads.
 */

import { captureMessage } from "@/lib/monitoring";

export type AiGenerationLogInput = {
  provider: string;
  model: string;
  requestId: string;
  durationMs: number;
  ok: boolean;
  code?: string;
  /** Token usage when the provider returns it. */
  promptTokens?: number | null;
  completionTokens?: number | null;
  totalTokens?: number | null;
};

export type AiCritiqueLogInput = AiGenerationLogInput & {
  openaiRequestId?: string | null;
  category?: string | null;
  responseStatus?: string | null;
  critiqueMode?: string | null;
  findingCount?: number | null;
  operationCount?: number | null;
  validationIssues?: Array<{ path: string; code: string }> | null;
};

/** Structured info log for a completed (or failed) generation attempt. */
export function logAiGeneration(input: AiGenerationLogInput): void {
  const payload = {
    event: "ai.generate",
    provider: input.provider,
    model: input.model,
    requestId: input.requestId,
    durationMs: input.durationMs,
    ok: input.ok,
    code: input.code ?? null,
    usage: {
      promptTokens: input.promptTokens ?? null,
      completionTokens: input.completionTokens ?? null,
      totalTokens: input.totalTokens ?? null,
    },
  };

  captureMessage({
    message: `ai.generate ${input.ok ? "ok" : "fail"}`,
    level: input.ok ? "info" : "warning",
    context: {
      tags: { route: "ai.generate", provider: input.provider },
      extra: payload,
    },
  });
}

/**
 * Critique-path diagnostics — never includes prompts, field values, or raw bodies.
 */
export function logAiCritique(input: AiCritiqueLogInput): void {
  const payload = {
    event: "ai.critique",
    provider: input.provider,
    model: input.model,
    requestId: input.requestId,
    openaiRequestId: input.openaiRequestId ?? null,
    durationMs: input.durationMs,
    ok: input.ok,
    code: input.code ?? null,
    category: input.category ?? null,
    responseStatus: input.responseStatus ?? null,
    critiqueMode: input.critiqueMode ?? null,
    findingCount: input.findingCount ?? null,
    operationCount: input.operationCount ?? null,
    validationIssues: input.validationIssues ?? null,
    usage: {
      promptTokens: input.promptTokens ?? null,
      completionTokens: input.completionTokens ?? null,
      totalTokens: input.totalTokens ?? null,
    },
  };

  captureMessage({
    message: `ai.critique ${input.ok ? "ok" : "fail"}`,
    level: input.ok ? "info" : "warning",
    context: {
      tags: { route: "ai.critique", provider: input.provider },
      extra: payload,
    },
  });
}

export function createAiRequestId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `ai-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export type AtlasBrainRoutingLogInput = {
  atlasRequestId: string;
  detectedIntent: string;
  selectedPath: string;
  confidence: number;
  matchedSignals: string[];
  pipelineVersion: string;
};

/**
 * Safe Brain routing diagnostics — never logs prompts or project content.
 */
export function logAtlasBrainRouting(input: AtlasBrainRoutingLogInput): void {
  const payload = {
    event: "atlas.brain.routing",
    atlasRequestId: input.atlasRequestId,
    detectedIntent: input.detectedIntent,
    selectedPath: input.selectedPath,
    confidence: input.confidence,
    matchedSignals: input.matchedSignals,
    pipelineVersion: input.pipelineVersion,
  };

  captureMessage({
    message: "atlas.brain.routing",
    level: "info",
    context: {
      tags: { route: "atlas.brain.routing" },
      extra: payload,
    },
  });
}
