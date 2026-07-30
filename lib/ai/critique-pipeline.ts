/**
 * Atlas AI Critique Pipeline — single authoritative entry (Sprint 28.1).
 *
 * Atlas Brain → runAtlasCritiquePipeline → OpenAI Responses → validate →
 * critiqueToOperations → Action Memory → Apply All
 *
 * No alternate critique providers, schemas, or prompt builders.
 */

import { createHash } from "node:crypto";
import {
  buildDesignCritiqueDeveloperPrompt,
  buildDesignCritiqueSystemPrompt,
  buildDesignCritiqueUserPrompt,
} from "@/lib/ai/design-critique-prompts";
import {
  runDesignCritique,
} from "@/lib/ai/design-critique";
import {
  buildOpenAiDesignCritiqueSchema,
  DESIGN_CRITIQUE_SCHEMA_NAME,
} from "@/lib/ai/design-critique-schema";
import type {
  DesignCritiqueContext,
  DesignCritiqueFailure,
  DesignCritiqueInput,
  DesignCritiqueMode,
  DesignCritiqueResult,
} from "@/lib/ai/design-critique-types";
import { creativeDirectorFingerprint } from "@/lib/ai/creative-director";
import { formatCritiqueFallbackCard } from "@/lib/ai/critique-fallback-presentation";
import {
  critiqueToOperations,
  critiqueToRecommendations,
} from "@/lib/ai/critique-to-operations";
import {
  extractStructuredJsonFromResponse,
} from "@/lib/ai/openai-structured-output";
import {
  validateDesignCritiqueWithIssues,
} from "@/lib/ai/design-critique-validation";
import { getAiProviderId, getOpenAiModel } from "@/lib/ai/provider";
import { logAiCritique } from "@/lib/ai/openai-logging";
import { captureMessage } from "@/lib/monitoring";
import type { BusinessProject } from "@/types/business-project";
import type OpenAI from "openai";

export { critiqueToOperations, critiqueToRecommendations };

/** Bump when pipeline orchestration changes. */
export const CRITIQUE_PIPELINE_VERSION = "28.1.0";
/** Bump when buildOpenAiDesignCritiqueSchema() shape changes. */
export const CRITIQUE_SCHEMA_VERSION = "28.1.0";
/** Bump when design-critique prompts change. */
export const CRITIQUE_PROMPT_VERSION = "28.1.0";

export const CRITIQUE_CACHE_TTL_MS = 30_000;

export type CritiquePipelineVersions = {
  pipelineVersion: string;
  schemaVersion: string;
  promptVersion: string;
};

export type CritiquePipelineDiagnostics = CritiquePipelineVersions & {
  provider: "openai" | "mock";
  model: string;
  cacheHit: boolean;
  cacheKey: string;
  atlasRequestId: string;
  openaiRequestId: string | null;
  schemaName: string;
};

export type AtlasCritiquePipelineResult =
  | (DesignCritiqueResult & {
      pipeline: CritiquePipelineDiagnostics;
    })
  | (DesignCritiqueFailure & {
      pipeline: CritiquePipelineDiagnostics;
    });

type CacheEntry = {
  key: string;
  fingerprint: string;
  conversationHash: string;
  promptHash: string;
  mode: DesignCritiqueMode;
  result: DesignCritiqueResult;
  at: number;
};

const cache = new Map<string, CacheEntry>();
/** Latest successful critique per project fingerprint (for Complete-my-website reuse). */
const latestByFingerprint = new Map<string, CacheEntry>();

export function getCritiquePipelineVersions(): CritiquePipelineVersions {
  return {
    pipelineVersion: CRITIQUE_PIPELINE_VERSION,
    schemaVersion: CRITIQUE_SCHEMA_VERSION,
    promptVersion: CRITIQUE_PROMPT_VERSION,
  };
}

/** Single prompt builder — all critique requests use this. */
export function buildDesignCritiquePrompt(input: {
  request: string;
  mode: DesignCritiqueMode;
  context: DesignCritiqueContext;
  compact?: boolean;
}): {
  system: string;
  developer: string;
  user: string;
  combinedSystem: string;
} {
  const system = buildDesignCritiqueSystemPrompt();
  const developer = buildDesignCritiqueDeveloperPrompt(input.mode, {
    compact: Boolean(input.compact),
  });
  const user = buildDesignCritiqueUserPrompt({
    request: input.request,
    mode: input.mode,
    context: input.context,
  });
  return {
    system,
    developer,
    user,
    combinedSystem: `${system}\n\n${developer}`,
  };
}

/** Single fallback formatter — no other critique fallback copy. */
export function formatCritiqueFallback(input: {
  category: Parameters<typeof formatCritiqueFallbackCard>[0]["category"];
  requestId?: string | null;
  audience?: "customer" | "owner";
  failingStage?: string | null;
}): string {
  return formatCritiqueFallbackCard(input);
}

/**
 * Single response parser: Responses API → structured JSON → Atlas validation.
 * Never skips validation.
 */
export function parseDesignCritiqueResponse(
  response: OpenAI.Responses.Response,
): ReturnType<typeof validateDesignCritiqueWithIssues> & {
  status: string;
  incompleteReason: string | null;
  openaiRequestId: string | null;
} {
  const extracted = extractStructuredJsonFromResponse(response);
  const openaiRequestId =
    typeof response.id === "string" ? response.id : null;
  if (extracted.json == null) {
    return {
      ok: false,
      issues: [{ path: "response", code: extracted.status }],
      status: extracted.status,
      incompleteReason: extracted.incompleteReason,
      openaiRequestId,
    };
  }
  const validated = validateDesignCritiqueWithIssues(extracted.json);
  return {
    ...validated,
    status: extracted.status,
    incompleteReason: extracted.incompleteReason,
    openaiRequestId,
  };
}

/** Re-export the only wire schema builder. */
export { buildOpenAiDesignCritiqueSchema };

function normalizePrompt(request: string): string {
  return request.trim().toLowerCase().replace(/\s+/g, " ");
}

function hashText(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 24);
}

function conversationHash(
  history: Array<{ role: string; content: string }> | undefined,
): string {
  const slim = (history ?? [])
    .slice(-8)
    .map((m) => `${m.role}:${normalizePrompt(m.content).slice(0, 200)}`)
    .join("|");
  return hashText(slim || "empty");
}

export function buildCritiqueCacheKey(input: {
  fingerprint: string;
  conversationHash: string;
  request: string;
  mode: DesignCritiqueMode;
}): string {
  return [
    CRITIQUE_PIPELINE_VERSION,
    CRITIQUE_SCHEMA_VERSION,
    CRITIQUE_PROMPT_VERSION,
    input.fingerprint,
    input.conversationHash,
    hashText(normalizePrompt(input.request)),
    input.mode,
  ].join(":");
}

function pruneCache(now = Date.now()): void {
  for (const [key, entry] of cache) {
    if (now - entry.at > CRITIQUE_CACHE_TTL_MS) {
      cache.delete(key);
    }
  }
  for (const [fp, entry] of latestByFingerprint) {
    if (now - entry.at > CRITIQUE_CACHE_TTL_MS) {
      latestByFingerprint.delete(fp);
    }
  }
}

/** Invalidate critique cache (call after apply / undo / redo / project edits). */
export function invalidateCritiquePipelineCache(
  fingerprint?: string | null,
): void {
  if (!fingerprint) {
    cache.clear();
    latestByFingerprint.clear();
    return;
  }
  for (const [key, entry] of cache) {
    if (entry.fingerprint === fingerprint) cache.delete(key);
  }
  latestByFingerprint.delete(fingerprint);
}

export function invalidateCritiquePipelineCacheForProject(
  project: BusinessProject,
): void {
  invalidateCritiquePipelineCache(creativeDirectorFingerprint(project));
}

function isCompleteWebsiteStyleRequest(request: string): boolean {
  return /\b(complete\s+my\s+website|make\s+it\s+launch[- ]ready|finish\s+(the|my)\s+(site|website)|launch[- ]ready)\b/i.test(
    request,
  );
}

/**
 * Authoritative critique entry — Brain and all product surfaces must call this.
 */
export async function runAtlasCritiquePipeline(
  input: DesignCritiqueInput & {
    atlasRequestId?: string | null;
    audience?: "customer" | "owner";
    /** When true, reuse latest fingerprint cache even if prompt differs (CMW). */
    allowFingerprintReuse?: boolean;
  },
): Promise<AtlasCritiquePipelineResult> {
  const provider = getAiProviderId();
  const model = provider === "openai" ? getOpenAiModel() : "mock-critique";
  const versions = getCritiquePipelineVersions();
  const fingerprint = creativeDirectorFingerprint(input.project);
  const convHash = conversationHash(input.history as Array<{
    role: string;
    content: string;
  }>);
  const cacheKey = buildCritiqueCacheKey({
    fingerprint,
    conversationHash: convHash,
    request: input.request,
    mode: input.mode,
  });
  const atlasRequestId = input.atlasRequestId?.trim() || cacheKey.slice(0, 36);

  pruneCache();
  const now = Date.now();
  const exact = cache.get(cacheKey);
  if (exact && now - exact.at <= CRITIQUE_CACHE_TTL_MS) {
    logPipeline({
      ...versions,
      provider,
      model,
      cacheHit: true,
      cacheKey,
      atlasRequestId,
      openaiRequestId: exact.result.diagnostics.openaiRequestId ?? null,
      schemaName: DESIGN_CRITIQUE_SCHEMA_NAME,
      ok: true,
    });
    return {
      ...exact.result,
      diagnostics: {
        ...exact.result.diagnostics,
        requestId: atlasRequestId,
      },
      pipeline: {
        ...versions,
        provider,
        model,
        cacheHit: true,
        cacheKey,
        atlasRequestId,
        openaiRequestId: exact.result.diagnostics.openaiRequestId ?? null,
        schemaName: DESIGN_CRITIQUE_SCHEMA_NAME,
      },
    };
  }

  const allowReuse =
    input.allowFingerprintReuse ?? isCompleteWebsiteStyleRequest(input.request);
  if (allowReuse) {
    const latest = latestByFingerprint.get(fingerprint);
    if (latest && now - latest.at <= CRITIQUE_CACHE_TTL_MS) {
      logPipeline({
        ...versions,
        provider,
        model,
        cacheHit: true,
        cacheKey: latest.key,
        atlasRequestId,
        openaiRequestId: latest.result.diagnostics.openaiRequestId ?? null,
        schemaName: DESIGN_CRITIQUE_SCHEMA_NAME,
        ok: true,
        reuse: "fingerprint",
      });
      return {
        ...latest.result,
        diagnostics: {
          ...latest.result.diagnostics,
          requestId: atlasRequestId,
        },
        pipeline: {
          ...versions,
          provider,
          model,
          cacheHit: true,
          cacheKey: latest.key,
          atlasRequestId,
          openaiRequestId: latest.result.diagnostics.openaiRequestId ?? null,
          schemaName: DESIGN_CRITIQUE_SCHEMA_NAME,
        },
      };
    }
  }

  // Ensure wire schema is the only schema object used in this pipeline process.
  void buildOpenAiDesignCritiqueSchema();

  const result = await runDesignCritique({
    ...input,
    atlasRequestId,
  });

  const openaiRequestId =
    result.ok
      ? result.diagnostics.openaiRequestId ?? null
      : result.diagnostics?.openaiRequestId ?? null;

  logPipeline({
    ...versions,
    provider: result.ok
      ? result.diagnostics.provider
      : provider,
    model: result.ok ? result.diagnostics.model : model,
    cacheHit: false,
    cacheKey,
    atlasRequestId,
    openaiRequestId,
    schemaName: DESIGN_CRITIQUE_SCHEMA_NAME,
    ok: result.ok,
    usedFallback: result.ok ? result.usedFallback : false,
    fallbackReason: result.ok ? result.fallbackReason ?? null : null,
  });

  logAiCritique({
    provider: result.ok ? result.diagnostics.provider : provider,
    model: result.ok ? result.diagnostics.model : model,
    requestId: atlasRequestId,
    openaiRequestId,
    durationMs: result.ok ? result.diagnostics.latencyMs : 0,
    ok: result.ok,
    category: result.ok ? result.fallbackReason ?? null : result.code,
    critiqueMode: input.mode,
    findingCount: result.ok ? result.diagnostics.findingCount : null,
    operationCount: result.ok ? result.diagnostics.operationCount : null,
  });

  if (result.ok && !result.usedFallback) {
    const entry: CacheEntry = {
      key: cacheKey,
      fingerprint,
      conversationHash: convHash,
      promptHash: hashText(normalizePrompt(input.request)),
      mode: input.mode,
      result,
      at: now,
    };
    cache.set(cacheKey, entry);
    latestByFingerprint.set(fingerprint, entry);
  }

  return {
    ...result,
    pipeline: {
      ...versions,
      provider: result.ok ? result.diagnostics.provider : provider,
      model: result.ok ? result.diagnostics.model : model,
      cacheHit: false,
      cacheKey,
      atlasRequestId,
      openaiRequestId,
      schemaName: DESIGN_CRITIQUE_SCHEMA_NAME,
    },
  };
}

function logPipeline(extra: Record<string, unknown>): void {
  captureMessage({
    message: `ai.critique.pipeline.v${CRITIQUE_PIPELINE_VERSION} ${
      extra.cacheHit ? "cache_hit" : extra.ok ? "ok" : "fail"
    }`,
    level: extra.ok || extra.cacheHit ? "info" : "warning",
    context: {
      tags: {
        route: "ai.critique.pipeline",
        pipelineVersion: CRITIQUE_PIPELINE_VERSION,
      },
      extra: {
        event: "ai.critique.pipeline",
        ...extra,
      },
    },
  });
}

/** Test-only: clear cache between cases. */
export function resetCritiquePipelineCacheForTests(): void {
  cache.clear();
  latestByFingerprint.clear();
}
