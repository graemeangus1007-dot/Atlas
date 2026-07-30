/**
 * Safe AI runtime diagnostics for temporary debug routes (Sprint 28.0B).
 * Never expose secrets, prompts, or project content.
 *
 * TEMPORARY — remove /api/debug/ai-runtime* after production verification.
 */

import { getAiProviderId, getOpenAiModel } from "@/lib/ai/provider";

export const AI_RUNTIME_DEBUG_TEMPORARY = true;

export type AiRuntimeSnapshot = {
  aiProvider: "openai" | "mock";
  openaiKeyPresent: boolean;
  configuredModel: string;
  critiqueProviderEnabled: boolean;
  responsesApiEnabled: boolean;
  temporaryDebugRoutes: true;
};

export function getAiRuntimeSnapshot(
  env: NodeJS.ProcessEnv = process.env,
): AiRuntimeSnapshot {
  const aiProvider = getAiProviderId(env.AI_PROVIDER);
  const openaiKeyPresent = Boolean(env.OPENAI_API_KEY?.trim());
  return {
    aiProvider,
    openaiKeyPresent,
    configuredModel: getOpenAiModel(env),
    critiqueProviderEnabled: aiProvider === "openai" && openaiKeyPresent,
    responsesApiEnabled: aiProvider === "openai" && openaiKeyPresent,
    temporaryDebugRoutes: true,
  };
}
