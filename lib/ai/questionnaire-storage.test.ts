/**
 * @vitest-environment jsdom
 *
 * Questionnaire draft persistence — tab sync / stale overwrite / flush.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EMPTY_AI_QUESTIONNAIRE } from "@/components/ai/ai-types";
import {
  aiQuestionnaireStorageKey,
  clearAiQuestionnaire,
  clearAiQuestionnaireSnapshotCache,
  getAiQuestionnaireSnapshot,
  isAiQuestionnaireNewer,
  loadAiQuestionnaire,
  saveAiQuestionnaire,
  subscribeAiQuestionnaire,
} from "@/lib/ai/questionnaire-storage";

const PROJECT_A = "proj-a";
const PROJECT_B = "proj-b";

function answers(name: string) {
  return {
    ...EMPTY_AI_QUESTIONNAIRE,
    businessName: name,
    industry: "Coffee Shop",
    oneSentenceDescription: "Test cafe",
    yearsInBusiness: "1",
  };
}

beforeEach(() => {
  clearAiQuestionnaireSnapshotCache();
  clearAiQuestionnaire(PROJECT_A);
  clearAiQuestionnaire(PROJECT_B);
  localStorage.clear();
});

afterEach(() => {
  clearAiQuestionnaire(PROJECT_A);
  clearAiQuestionnaire(PROJECT_B);
  clearAiQuestionnaireSnapshotCache();
  vi.useRealTimers();
});

describe("questionnaire tab sync & last-write-wins", () => {
  it("switching tabs before debounce completes — flush write persists latest fields + step", () => {
    vi.useFakeTimers();
    // Initial empty — simulate in-progress debounce by writing only on flush.
    const pending = {
      projectId: PROJECT_A,
      stepIndex: 2,
      answers: answers("Debounced Name"),
    };

    // No write yet (debounce window). Then flush as visibilitychange would.
    const flushed = saveAiQuestionnaire(pending);
    expect(flushed.wrote).toBe(true);

    clearAiQuestionnaireSnapshotCache();
    const loaded = loadAiQuestionnaire(PROJECT_A);
    expect(loaded?.answers.businessName).toBe("Debounced Name");
    expect(loaded?.stepIndex).toBe(2);
  });

  it("second tab receives updates via storage subscription", () => {
    const key = aiQuestionnaireStorageKey(PROJECT_A);
    let notified = 0;
    const unsub = subscribeAiQuestionnaire(PROJECT_A, () => {
      notified += 1;
    });

    // Simulate another tab writing localStorage + firing the storage event.
    const progress = {
      version: 1 as const,
      projectId: PROJECT_A,
      stepIndex: 1,
      answers: answers("From Tab Two"),
      updatedAt: new Date().toISOString(),
      revision: 3,
    };
    localStorage.setItem(key, JSON.stringify(progress));
    clearAiQuestionnaireSnapshotCache();
    window.dispatchEvent(
      new StorageEvent("storage", {
        key,
        newValue: JSON.stringify(progress),
        storageArea: localStorage,
      }),
    );

    expect(notified).toBeGreaterThan(0);
    expect(getAiQuestionnaireSnapshot(PROJECT_A)?.answers.businessName).toBe(
      "From Tab Two",
    );
    unsub();
  });

  it("stale tab cannot overwrite newer data", () => {
    const fresh = saveAiQuestionnaire({
      projectId: PROJECT_A,
      stepIndex: 4,
      answers: answers("Fresh Tab"),
    });
    expect(fresh.progress.revision).toBe(1);

    const staleAttempt = saveAiQuestionnaire({
      projectId: PROJECT_A,
      stepIndex: 0,
      answers: answers("Old Tab"),
      baseRevision: 0,
      baseUpdatedAt: "1999-01-01T00:00:00.000Z",
    });

    expect(staleAttempt.rejectedStale).toBe(true);
    expect(loadAiQuestionnaire(PROJECT_A)?.answers.businessName).toBe(
      "Fresh Tab",
    );
    expect(
      isAiQuestionnaireNewer(fresh.progress, {
        revision: 0,
        updatedAt: "1999-01-01T00:00:00.000Z",
      }),
    ).toBe(true);
  });

  it("refresh restores the latest draft", () => {
    saveAiQuestionnaire({
      projectId: PROJECT_A,
      stepIndex: 3,
      answers: answers("Persisted"),
    });
    clearAiQuestionnaireSnapshotCache();
    const restored = loadAiQuestionnaire(PROJECT_A);
    expect(restored?.answers.businessName).toBe("Persisted");
    expect(restored?.stepIndex).toBe(3);
    expect(restored?.revision).toBeGreaterThan(0);
  });

  it("project drafts remain isolated", () => {
    saveAiQuestionnaire({
      projectId: PROJECT_A,
      stepIndex: 1,
      answers: answers("Alpha"),
    });
    saveAiQuestionnaire({
      projectId: PROJECT_B,
      stepIndex: 2,
      answers: answers("Beta"),
    });
    expect(loadAiQuestionnaire(PROJECT_A)?.answers.businessName).toBe("Alpha");
    expect(loadAiQuestionnaire(PROJECT_B)?.answers.businessName).toBe("Beta");
  });

  it("successful creation clears only the completed project’s draft", () => {
    saveAiQuestionnaire({
      projectId: PROJECT_A,
      stepIndex: 5,
      answers: answers("Completed"),
    });
    saveAiQuestionnaire({
      projectId: PROJECT_B,
      stepIndex: 1,
      answers: answers("Still Editing"),
    });
    clearAiQuestionnaire(PROJECT_A);
    expect(loadAiQuestionnaire(PROJECT_A)).toBeNull();
    expect(loadAiQuestionnaire(PROJECT_B)?.answers.businessName).toBe(
      "Still Editing",
    );
  });

  it("keeps referential stability across identical reads", () => {
    saveAiQuestionnaire({
      projectId: PROJECT_A,
      stepIndex: 0,
      answers: answers("Stable"),
    });
    const a = getAiQuestionnaireSnapshot(PROJECT_A);
    const b = getAiQuestionnaireSnapshot(PROJECT_A);
    expect(a).toBe(b);
  });
});
