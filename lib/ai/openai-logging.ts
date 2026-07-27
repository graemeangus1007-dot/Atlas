/**
 * Production-safe AI generation logging (Sprint 21.0A).
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

export function createAiRequestId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `ai-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
