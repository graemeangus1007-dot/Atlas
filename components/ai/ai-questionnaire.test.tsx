/**
 * @vitest-environment jsdom
 *
 * Production regression: React error #185 (maximum update depth) on /dashboard/ai.
 */
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import AiQuestionnaire from "@/components/ai/ai-questionnaire";
import {
  clearAiQuestionnaire,
  clearAiQuestionnaireSnapshotCache,
  getAiQuestionnaireSnapshot,
  saveAiQuestionnaire,
} from "@/lib/ai/questionnaire-storage";
import { EMPTY_AI_QUESTIONNAIRE } from "@/components/ai/ai-types";

const PROJECT_ID = "11111111-1111-4111-8111-111111111111";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
  }),
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: React.PropsWithChildren<{ href: string } & Record<string, unknown>>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/context/project-context", () => ({
  useProject: () => ({
    projectId: PROJECT_ID,
    openProject: vi.fn(),
    refreshProjects: vi.fn(),
  }),
}));

afterEach(() => {
  cleanup();
  clearAiQuestionnaire(PROJECT_ID);
  clearAiQuestionnaireSnapshotCache();
});

beforeEach(() => {
  clearAiQuestionnaireSnapshotCache();
  clearAiQuestionnaire(PROJECT_ID);
});

describe("AiQuestionnaire render stability (React #185)", () => {
  it("mounts with existing storage and stabilizes without exceeding update depth", async () => {
    saveAiQuestionnaire({
      projectId: PROJECT_ID,
      stepIndex: 0,
      answers: {
        ...EMPTY_AI_QUESTIONNAIRE,
        businessName: "Cedar Cafe",
        industry: "Coffee Shop",
        oneSentenceDescription: "Neighborhood espresso.",
        yearsInBusiness: "5 years",
      },
    });

    const firstSnap = getAiQuestionnaireSnapshot(PROJECT_ID);
    expect(firstSnap).not.toBeNull();

    let renderCount = 0;
    function Probe() {
      renderCount += 1;
      return <AiQuestionnaire projectId={PROJECT_ID} />;
    }

    expect(() => render(<Probe />)).not.toThrow();

    await waitFor(() => {
      expect(screen.getByDisplayValue("Cedar Cafe")).toBeTruthy();
    });

    // Allow a couple of commit passes; must not approach React's update-depth limit.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(renderCount).toBeLessThan(25);

    const secondSnap = getAiQuestionnaireSnapshot(PROJECT_ID);
    expect(secondSnap).toBe(firstSnap);
  });

  it("getSnapshot stays referentially stable across repeated reads during mount", () => {
    saveAiQuestionnaire({
      projectId: PROJECT_ID,
      stepIndex: 1,
      answers: { ...EMPTY_AI_QUESTIONNAIRE, businessName: "Stable Co" },
    });

    const a = getAiQuestionnaireSnapshot(PROJECT_ID);
    const b = getAiQuestionnaireSnapshot(PROJECT_ID);
    const c = getAiQuestionnaireSnapshot(PROJECT_ID);
    expect(a).toBe(b);
    expect(b).toBe(c);
  });
});
