/**
 * Per-project AI questionnaire persistence (localStorage).
 * Client-only — safe for resume after refresh.
 */

import {
  EMPTY_AI_QUESTIONNAIRE,
  type AiBrandTone,
  type AiQuestionnaireAnswers,
  type AiQuestionnaireProgress,
} from "@/components/ai/ai-types";

const STORAGE_PREFIX = "atlas.ai.questionnaire.v1:";
export const AI_QUESTIONNAIRE_STORAGE_EVENT = "atlas-ai-questionnaire";

function storageKey(projectId: string): string {
  return `${STORAGE_PREFIX}${projectId}`;
}

function isTone(value: unknown): value is AiBrandTone {
  return (
    value === "professional" ||
    value === "friendly" ||
    value === "luxury" ||
    value === "modern" ||
    value === "bold"
  );
}

function parseAnswers(raw: unknown): AiQuestionnaireAnswers {
  if (!raw || typeof raw !== "object") return { ...EMPTY_AI_QUESTIONNAIRE };
  const row = raw as Record<string, unknown>;
  return {
    businessName:
      typeof row.businessName === "string" ? row.businessName : "",
    industry: typeof row.industry === "string" ? row.industry : "",
    oneSentenceDescription:
      typeof row.oneSentenceDescription === "string"
        ? row.oneSentenceDescription
        : "",
    yearsInBusiness:
      typeof row.yearsInBusiness === "string" ? row.yearsInBusiness : "",
    primaryServices:
      typeof row.primaryServices === "string" ? row.primaryServices : "",
    secondaryServices:
      typeof row.secondaryServices === "string" ? row.secondaryServices : "",
    targetCustomer:
      typeof row.targetCustomer === "string" ? row.targetCustomer : "",
    serviceArea: typeof row.serviceArea === "string" ? row.serviceArea : "",
    tone: isTone(row.tone) ? row.tone : "",
    primaryColor:
      typeof row.primaryColor === "string" && row.primaryColor
        ? row.primaryColor
        : EMPTY_AI_QUESTIONNAIRE.primaryColor,
    accentColor:
      typeof row.accentColor === "string" && row.accentColor
        ? row.accentColor
        : EMPTY_AI_QUESTIONNAIRE.accentColor,
    logoPlaceholderNote:
      typeof row.logoPlaceholderNote === "string"
        ? row.logoPlaceholderNote
        : "",
    phone: typeof row.phone === "string" ? row.phone : "",
    email: typeof row.email === "string" ? row.email : "",
    address: typeof row.address === "string" ? row.address : "",
    website: typeof row.website === "string" ? row.website : "",
    facebook: typeof row.facebook === "string" ? row.facebook : "",
    instagram: typeof row.instagram === "string" ? row.instagram : "",
  };
}

export function loadAiQuestionnaire(
  projectId: string,
): AiQuestionnaireProgress | null {
  if (typeof window === "undefined") return null;
  const id = projectId.trim();
  if (!id) return null;
  try {
    const raw = window.localStorage.getItem(storageKey(id));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<AiQuestionnaireProgress>;
    if (parsed.version !== 1 || parsed.projectId !== id) return null;
    const stepIndex =
      typeof parsed.stepIndex === "number" && Number.isFinite(parsed.stepIndex)
        ? Math.max(0, Math.min(4, Math.floor(parsed.stepIndex)))
        : 0;
    return {
      version: 1,
      projectId: id,
      stepIndex,
      answers: parseAnswers(parsed.answers),
      updatedAt:
        typeof parsed.updatedAt === "string"
          ? parsed.updatedAt
          : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export function saveAiQuestionnaire(input: {
  projectId: string;
  stepIndex: number;
  answers: AiQuestionnaireAnswers;
}): AiQuestionnaireProgress {
  const progress: AiQuestionnaireProgress = {
    version: 1,
    projectId: input.projectId.trim(),
    stepIndex: Math.max(0, Math.min(4, input.stepIndex)),
    answers: { ...input.answers },
    updatedAt: new Date().toISOString(),
  };

  if (typeof window !== "undefined" && progress.projectId) {
    try {
      window.localStorage.setItem(
        storageKey(progress.projectId),
        JSON.stringify(progress),
      );
      window.dispatchEvent(
        new CustomEvent(AI_QUESTIONNAIRE_STORAGE_EVENT, {
          detail: { projectId: progress.projectId },
        }),
      );
    } catch {
      // Quota / private mode — wizard still works in-memory.
    }
  }

  return progress;
}

export function clearAiQuestionnaire(projectId: string): void {
  if (typeof window === "undefined") return;
  const id = projectId.trim();
  if (!id) return;
  try {
    window.localStorage.removeItem(storageKey(id));
    window.dispatchEvent(
      new CustomEvent(AI_QUESTIONNAIRE_STORAGE_EVENT, {
        detail: { projectId: id },
      }),
    );
  } catch {
    // ignore
  }
}
