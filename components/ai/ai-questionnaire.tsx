"use client";

import { useRouter } from "next/navigation";
import {
  startTransition,
  useCallback,
  useEffect,
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
import AiStepSections from "@/components/ai/ai-step-sections";
import AiStepServices from "@/components/ai/ai-step-services";
import {
  AI_QUESTIONNAIRE_STEPS,
  EMPTY_AI_QUESTIONNAIRE,
  type AiQuestionnaireAnswers,
  type AiQuestionnaireFieldErrors,
  type AiQuestionnaireProgress,
  type AiQuestionnaireStepId,
} from "@/components/ai/ai-types";
import Button from "@/components/ui/button";
import { useProject } from "@/context/project-context";
import { AI_CREATE_PROJECT_EDITOR_PATH } from "@/lib/ai/create-project-constants";
import type { GeneratedWebsiteDraft } from "@/lib/ai/types";
import { questionnaireToGenerateInput } from "@/lib/ai/questionnaire-map";
import {
  clearAiQuestionnaire,
  getAiQuestionnaireServerSnapshot,
  getAiQuestionnaireSnapshot,
  isAiQuestionnaireNewer,
  saveAiQuestionnaire,
  subscribeAiQuestionnaire,
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

export type AiQuestionnaireSaveStatus =
  | "idle"
  | "saving"
  | "saved"
  | "remote";

const AUTOSAVE_DEBOUNCE_MS = 300;

function newIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `ai-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function saveStatusLabel(status: AiQuestionnaireSaveStatus): string | null {
  if (status === "saving") return "Saving";
  if (status === "saved") return "Saved";
  if (status === "remote") return "Updated in another tab";
  return null;
}

/**
 * Multi-step AI business questionnaire with debounced autosave, tab sync, and generate + create.
 */
export default function AiQuestionnaire({ projectId }: AiQuestionnaireProps) {
  const router = useRouter();
  const { openProject, refreshProjects } = useProject();

  const subscribe = useCallback(
    (onStoreChange: () => void) =>
      subscribeAiQuestionnaire(projectId, onStoreChange),
    [projectId],
  );
  const getSnapshot = useCallback(
    () => getAiQuestionnaireSnapshot(projectId),
    [projectId],
  );

  const persisted = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getAiQuestionnaireServerSnapshot,
  );

  const [local, setLocal] = useState<LocalDraft | null>(null);
  const [saveStatus, setSaveStatus] =
    useState<AiQuestionnaireSaveStatus>("idle");
  const [errors, setErrors] = useState<AiQuestionnaireFieldErrors>({});
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [draft, setDraft] = useState<GeneratedWebsiteDraft | null>(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSuccess, setCreateSuccess] = useState(false);
  const idempotencyKeyRef = useRef<string | null>(null);
  const createInFlightRef = useRef(false);

  /** Last revision/updatedAt this tab successfully loaded or saved. */
  const baseRef = useRef<{
    revision: number;
    updatedAt: string;
    seeded: boolean;
  }>({ revision: 0, updatedAt: "", seeded: false });
  const pendingRef = useRef<LocalDraft | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedStatusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearDebounceTimer = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
  }, []);

  const writePending = useCallback(
    (next: LocalDraft, options?: { force?: boolean }): AiQuestionnaireProgress => {
      setSaveStatus("saving");
      const base = baseRef.current.seeded ? baseRef.current : null;
      const result = saveAiQuestionnaire({
        projectId,
        stepIndex: next.stepIndex,
        answers: next.answers,
        baseRevision: base?.revision ?? null,
        baseUpdatedAt: base?.updatedAt ?? null,
        force: options?.force,
      });

      if (result.rejectedStale) {
        baseRef.current = {
          revision: result.progress.revision,
          updatedAt: result.progress.updatedAt,
          seeded: true,
        };
        pendingRef.current = null;
        startTransition(() => {
          setLocal(null);
          setSaveStatus("remote");
        });
        return result.progress;
      }

      if (result.wrote) {
        baseRef.current = {
          revision: result.progress.revision,
          updatedAt: result.progress.updatedAt,
          seeded: true,
        };
        pendingRef.current = null;
        startTransition(() => {
          setLocal(null);
          setSaveStatus("saved");
        });
        if (savedStatusTimerRef.current) {
          clearTimeout(savedStatusTimerRef.current);
        }
        savedStatusTimerRef.current = setTimeout(() => {
          setSaveStatus((prev) => (prev === "saved" ? "idle" : prev));
        }, 1600);
      } else {
        pendingRef.current = null;
        startTransition(() => {
          setLocal(null);
          setSaveStatus("saved");
        });
      }

      return result.progress;
    },
    [projectId],
  );

  const flushPending = useCallback(() => {
    clearDebounceTimer();
    const pending = pendingRef.current;
    if (!pending) return;
    writePending(pending);
  }, [clearDebounceTimer, writePending]);

  const schedulePersist = useCallback(
    (nextStep: number, nextAnswers: AiQuestionnaireAnswers) => {
      const next: LocalDraft = { stepIndex: nextStep, answers: nextAnswers };
      pendingRef.current = next;
      setLocal(next);
      setSaveStatus("saving");
      clearDebounceTimer();
      debounceTimerRef.current = setTimeout(() => {
        debounceTimerRef.current = null;
        const pending = pendingRef.current;
        if (pending) writePending(pending);
      }, AUTOSAVE_DEBOUNCE_MS);
    },
    [clearDebounceTimer, writePending],
  );

  // Seed base + adopt newer snapshots from other tabs (no render-time ref reads).
  useEffect(() => {
    if (!persisted) return;

    if (!baseRef.current.seeded) {
      baseRef.current = {
        revision: persisted.revision,
        updatedAt: persisted.updatedAt,
        seeded: true,
      };
      return;
    }

    if (!isAiQuestionnaireNewer(persisted, baseRef.current)) {
      return;
    }

    if (pendingRef.current) {
      clearDebounceTimer();
      writePending(pendingRef.current);
      return;
    }

    baseRef.current = {
      revision: persisted.revision,
      updatedAt: persisted.updatedAt,
      seeded: true,
    };
    startTransition(() => {
      setLocal(null);
      setSaveStatus("remote");
    });
  }, [persisted, clearDebounceTimer, writePending]);

  // Flush before tab hide / blur / navigation away.
  useEffect(() => {
    const onHidden = () => {
      if (document.visibilityState === "hidden") flushPending();
    };
    const onPageHide = () => flushPending();
    const onBlur = () => flushPending();

    document.addEventListener("visibilitychange", onHidden);
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("blur", onBlur);
    return () => {
      document.removeEventListener("visibilitychange", onHidden);
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("blur", onBlur);
      flushPending();
      clearDebounceTimer();
      if (savedStatusTimerRef.current) {
        clearTimeout(savedStatusTimerRef.current);
      }
    };
  }, [flushPending, clearDebounceTimer]);

  const stepIndex = local?.stepIndex ?? persisted?.stepIndex ?? 0;
  const answers = local?.answers ?? persisted?.answers ?? EMPTY_AI_QUESTIONNAIRE;
  const stepId = AI_QUESTIONNAIRE_STEPS[
    Math.min(stepIndex, AI_QUESTIONNAIRE_STEPS.length - 1)
  ] as AiQuestionnaireStepId;
  const isLast = stepId === "review";

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
      schedulePersist(stepIndex, next);
    },
    [answers, schedulePersist, stepIndex],
  );

  function goBack() {
    if (stepIndex <= 0) return;
    setErrors({});
    schedulePersist(stepIndex - 1, answers);
  }

  function goNext() {
    const fieldErrors = validateAiQuestionnaireStep(stepId, answers);
    setErrors(fieldErrors);
    if (Object.keys(fieldErrors).length > 0) return;
    if (stepIndex >= AI_QUESTIONNAIRE_STEPS.length - 1) return;
    schedulePersist(stepIndex + 1, answers);
  }

  async function handleGenerate() {
    if (!isAiQuestionnaireComplete(answers)) {
      setGenerateError("Complete all required fields before generating.");
      return;
    }

    flushPending();
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
      writePending({ stepIndex, answers }, { force: true });
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
      // Only clear this project's questionnaire after successful creation.
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

  const statusLabel = saveStatusLabel(saveStatus);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-8">
      <div className="flex items-start justify-between gap-3">
        <AiProgress stepIndex={stepIndex} />
        {statusLabel ? (
          <p
            className="shrink-0 pt-1 text-xs text-muted"
            data-testid="ai-questionnaire-save-status"
            aria-live="polite"
          >
            {statusLabel}
          </p>
        ) : null}
      </div>

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
        {stepId === "sections" ? (
          <AiStepSections
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
          projectId={projectId}
          questionnaire={questionnaireToGenerateInput(projectId, answers)
            .questionnaire}
          creating={creating}
          createError={createError}
          createSuccess={createSuccess}
          onCreate={() => void handleCreateWebsite()}
          onDraftChange={setDraft}
        />
      ) : null}
    </div>
  );
}
