"use client";

import { useRouter } from "next/navigation";
import {
  useCallback,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import AiDraftPreview from "@/components/ai/ai-draft-preview";
import AiGenerateButton from "@/components/ai/ai-generate-button";
import AiProgress from "@/components/ai/ai-progress";
import AiStepBranding from "@/components/ai/ai-step-branding";
import AiStepBusiness from "@/components/ai/ai-step-business";
import AiStepContact from "@/components/ai/ai-step-contact";
import AiStepReview from "@/components/ai/ai-step-review";
import AiStepServices from "@/components/ai/ai-step-services";
import {
  AI_QUESTIONNAIRE_STEPS,
  EMPTY_AI_QUESTIONNAIRE,
  type AiQuestionnaireAnswers,
  type AiQuestionnaireFieldErrors,
  type AiQuestionnaireStepId,
} from "@/components/ai/ai-types";
import Button from "@/components/ui/button";
import { useProject } from "@/context/project-context";
import { AI_CREATE_PROJECT_EDITOR_PATH } from "@/lib/ai/create-project-constants";
import type { GeneratedWebsiteDraft } from "@/lib/ai/types";
import { questionnaireToGenerateInput } from "@/lib/ai/questionnaire-map";
import {
  AI_QUESTIONNAIRE_STORAGE_EVENT,
  clearAiQuestionnaire,
  loadAiQuestionnaire,
  saveAiQuestionnaire,
} from "@/lib/ai/questionnaire-storage";
import {
  isAiQuestionnaireComplete,
  validateAiQuestionnaireStep,
} from "@/lib/ai/questionnaire-validation";

type AiQuestionnaireProps = {
  projectId: string;
};

type LocalDraft = {
  stepIndex: number;
  answers: AiQuestionnaireAnswers;
};

function subscribeQuestionnaire(onStoreChange: () => void): () => void {
  const handler = () => onStoreChange();
  window.addEventListener(AI_QUESTIONNAIRE_STORAGE_EVENT, handler);
  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener(AI_QUESTIONNAIRE_STORAGE_EVENT, handler);
    window.removeEventListener("storage", handler);
  };
}

function newIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `ai-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Multi-step AI business questionnaire with autosave + generate + create.
 */
export default function AiQuestionnaire({ projectId }: AiQuestionnaireProps) {
  const router = useRouter();
  const { openProject, refreshProjects } = useProject();
  const persisted = useSyncExternalStore(
    subscribeQuestionnaire,
    () => loadAiQuestionnaire(projectId),
    () => null,
  );

  const [local, setLocal] = useState<LocalDraft | null>(null);
  const [errors, setErrors] = useState<AiQuestionnaireFieldErrors>({});
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [draft, setDraft] = useState<GeneratedWebsiteDraft | null>(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSuccess, setCreateSuccess] = useState(false);
  const idempotencyKeyRef = useRef<string | null>(null);
  const createInFlightRef = useRef(false);

  const stepIndex = local?.stepIndex ?? persisted?.stepIndex ?? 0;
  const answers = local?.answers ?? persisted?.answers ?? EMPTY_AI_QUESTIONNAIRE;
  const stepId = AI_QUESTIONNAIRE_STEPS[
    Math.min(stepIndex, AI_QUESTIONNAIRE_STEPS.length - 1)
  ] as AiQuestionnaireStepId;
  const isLast = stepId === "review";

  const persist = useCallback(
    (nextStep: number, nextAnswers: AiQuestionnaireAnswers) => {
      setLocal({ stepIndex: nextStep, answers: nextAnswers });
      saveAiQuestionnaire({
        projectId,
        stepIndex: nextStep,
        answers: nextAnswers,
      });
    },
    [projectId],
  );

  const onChange = useCallback(
    <K extends keyof AiQuestionnaireAnswers>(
      key: K,
      value: AiQuestionnaireAnswers[K],
    ) => {
      const next = { ...answers, [key]: value };
      setErrors((prev) => {
        if (!prev[key]) return prev;
        const copy = { ...prev };
        delete copy[key];
        return copy;
      });
      persist(stepIndex, next);
    },
    [answers, persist, stepIndex],
  );

  function goBack() {
    if (stepIndex <= 0) return;
    setErrors({});
    persist(stepIndex - 1, answers);
  }

  function goNext() {
    const fieldErrors = validateAiQuestionnaireStep(stepId, answers);
    setErrors(fieldErrors);
    if (Object.keys(fieldErrors).length > 0) return;
    if (stepIndex >= AI_QUESTIONNAIRE_STEPS.length - 1) return;
    persist(stepIndex + 1, answers);
  }

  async function handleGenerate() {
    if (!isAiQuestionnaireComplete(answers)) {
      setGenerateError("Complete all required fields before generating.");
      return;
    }

    setGenerating(true);
    setGenerateError(null);
    setDraft(null);
    setCreateError(null);
    setCreateSuccess(false);
    idempotencyKeyRef.current = null;

    try {
      const payload = questionnaireToGenerateInput(projectId, answers);
      const res = await fetch("/api/ai/generate", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await res.json()) as {
        draft?: GeneratedWebsiteDraft;
        error?: { message?: string };
      };
      if (!res.ok || !body.draft) {
        throw new Error(
          body.error?.message || "Could not generate website draft.",
        );
      }
      setDraft(body.draft);
      idempotencyKeyRef.current = newIdempotencyKey();
      persist(stepIndex, answers);
    } catch (err) {
      setGenerateError(
        err instanceof Error ? err.message : "Generation failed.",
      );
    } finally {
      setGenerating(false);
    }
  }

  async function handleCreateWebsite() {
    if (!draft || createInFlightRef.current || createSuccess) return;

    createInFlightRef.current = true;
    setCreating(true);
    setCreateError(null);

    const key = idempotencyKeyRef.current ?? newIdempotencyKey();
    idempotencyKeyRef.current = key;

    try {
      const res = await fetch("/api/ai/create-project", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          draft,
          questionnaire: answers,
          idempotencyKey: key,
          sourceProjectId: projectId,
          replaceExisting: false,
        }),
      });
      const body = (await res.json()) as {
        projectId?: string;
        editorPath?: string;
        error?: { message?: string };
      };
      if (!res.ok || !body.projectId) {
        throw new Error(
          body.error?.message || "Could not create website from draft.",
        );
      }

      setCreateSuccess(true);
      clearAiQuestionnaire(projectId);
      await refreshProjects();
      await openProject(body.projectId);
      router.push(body.editorPath || AI_CREATE_PROJECT_EDITOR_PATH);
    } catch (err) {
      setCreateError(
        err instanceof Error ? err.message : "Could not create website.",
      );
      createInFlightRef.current = false;
      setCreating(false);
    }
  }

  const canGenerate = useMemo(
    () => isAiQuestionnaireComplete(answers),
    [answers],
  );

  return (
    <div className="mx-auto w-full max-w-3xl space-y-8">
      <AiProgress stepIndex={stepIndex} />

      <div className="rounded-2xl border border-border bg-surface/40 p-5 sm:p-8">
        {stepId === "business" ? (
          <AiStepBusiness
            answers={answers}
            errors={errors}
            onChange={onChange}
          />
        ) : null}
        {stepId === "services" ? (
          <AiStepServices
            answers={answers}
            errors={errors}
            onChange={onChange}
          />
        ) : null}
        {stepId === "branding" ? (
          <AiStepBranding
            answers={answers}
            errors={errors}
            onChange={onChange}
          />
        ) : null}
        {stepId === "contact" ? (
          <AiStepContact
            answers={answers}
            errors={errors}
            onChange={onChange}
          />
        ) : null}
        {stepId === "review" ? <AiStepReview answers={answers} /> : null}

        <div className="mt-10 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          {stepIndex > 0 ? (
            <Button
              type="button"
              variant="secondary"
              onClick={goBack}
              className="w-full sm:w-auto"
            >
              Previous
            </Button>
          ) : (
            <span className="hidden sm:block" />
          )}

          {isLast ? (
            <AiGenerateButton
              loading={generating}
              disabled={!canGenerate || creating}
              onGenerate={() => void handleGenerate()}
            />
          ) : (
            <Button
              type="button"
              onClick={goNext}
              className="w-full px-8 sm:w-auto"
            >
              Next
            </Button>
          )}
        </div>

        {generateError ? (
          <p className="mt-4 text-sm text-red-300" role="alert">
            {generateError}
          </p>
        ) : null}

        {generating ? (
          <p className="mt-4 text-sm text-muted" aria-live="polite">
            Creating your website draft with Atlas AI…
          </p>
        ) : null}
      </div>

      {draft ? (
        <AiDraftPreview
          draft={draft}
          creating={creating}
          createError={createError}
          createSuccess={createSuccess}
          onCreate={() => void handleCreateWebsite()}
        />
      ) : null}
    </div>
  );
}
