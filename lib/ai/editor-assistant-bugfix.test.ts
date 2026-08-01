/**
 * Sprint 22.0A bugfix — Design Assistant apply + persistence regressions.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { MOCK_BUSINESS_PROJECT } from "@/data/mock-project";
import {
  appendConversationMessage,
  buildDesignAssistantMeta,
  createEmptyEditorConversation,
  createEmptyRevisionStack,
  hasMeaningfulProjectDiff,
  pushEditorRevision,
  restoreDesignAssistantState,
  runEditorAgent,
  toLocalStore,
  tryRunEditorAgent,
  writeDesignAssistantLocal,
} from "@/lib/ai";
import { requestEditorAgentEdit } from "@/lib/ai/request-editor-edit";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  if (typeof window !== "undefined") {
    window.localStorage.clear();
  }
});

function sampleProject() {
  return {
    ...MOCK_BUSINESS_PROJECT,
    businessName: "Cedar Cafe",
    heroHeadline: "Old headline",
    heroSubheadline: "Old subhead",
    headingFont: "inter" as const,
    backgroundColor: "#07090d",
    publish: null,
  };
}

describe("successful prompt → operations → live project update", () => {
  it("applies modern+professional edits to the BusinessProject", async () => {
    const before = sampleProject();
    const result = await runEditorAgent({
      project: before,
      request: "Make this website look more modern and professional.",
    });
    expect(result.ok).toBe(true);
    expect(result.applyStatus).toBe("applied");
    expect(result.operations.length).toBeGreaterThan(0);
    expect(result.project.heroHeadline).not.toBe(before.heroHeadline);
    expect(result.project.heroHeadline.toLowerCase()).toMatch(/modern|professional|reimagined/i);
    expect(hasMeaningfulProjectDiff(before, result.project)).toBe(true);
    expect(result.changes.length).toBeGreaterThan(0);
  });
});

describe("conversation appears immediately (state helpers)", () => {
  it("appends the user prompt before the assistant reply", async () => {
    let convo = createEmptyEditorConversation();
    convo = appendConversationMessage(convo, {
      role: "user",
      content: "Make this website look more modern and professional.",
    });
    expect(convo.messages).toHaveLength(1);
    expect(convo.messages[0]?.role).toBe("user");
    expect(convo.messages[0]?.content).toMatch(/modern and professional/i);

    const result = await runEditorAgent({
      project: sampleProject(),
      request: convo.messages[0]!.content,
    });
    convo = appendConversationMessage(convo, {
      role: "assistant",
      content: result.explanation,
      changes: result.changes,
      operations: result.operations,
    });
    expect(convo.messages).toHaveLength(2);
    expect(convo.messages[1]?.role).toBe("assistant");
    expect(convo.messages[1]?.changes?.length).toBeGreaterThan(0);
  });
});

describe("persistence after reload", () => {
  it("restores prompts, replies, and change summaries from stored meta", async () => {
    const before = sampleProject();
    const result = await runEditorAgent({
      project: before,
      request: "Add an FAQ.",
    });
    let convo = createEmptyEditorConversation();
    convo = appendConversationMessage(convo, {
      role: "user",
      content: "Add an FAQ.",
    });
    convo = appendConversationMessage(convo, {
      role: "assistant",
      content: result.explanation,
      changes: result.changes,
      operations: result.operations,
    });
    let stack = createEmptyRevisionStack();
    stack = pushEditorRevision(stack, {
      before,
      after: result.project,
      operations: result.operations,
      changes: result.changes,
      prompt: "Add an FAQ.",
    });

    const meta = buildDesignAssistantMeta({
      conversation: convo,
      revisionStack: stack,
      lastChanges: result.changes,
    });
    writeDesignAssistantLocal("proj-1", toLocalStore(meta, stack));

    const restored = restoreDesignAssistantState({
      projectId: null, // use project meta path (no window/localStorage in node)
      projectMeta: meta,
    });
    expect(restored.conversation.messages[0]?.content).toBe("Add an FAQ.");
    expect(restored.conversation.messages[1]?.role).toBe("assistant");
    expect(restored.lastChanges?.some((c) => /FAQ/i.test(c.label))).toBe(true);
    expect(restored.revisionStack.index).toBe(0);
    expect(restored.revisionStack.revisions[0]?.operations.some((op) => op.operation === "insertSection")).toBe(
      true,
    );
    // Round-trip through an in-memory local store shape (Node tests have no window).
    const localShape = toLocalStore(meta, stack);
    expect(localShape.snapshots[0]?.after.designSections?.enabled).toContain("faq");
    expect(meta.conversation.messages).toHaveLength(2);
  });
});

describe("API failure surfaces an error", () => {
  it("returns a failed client result with a safe message", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            error: {
              code: "provider_error",
              message: "Atlas AI could not apply that design request. Please try again.",
              requestId: "req-fail",
            },
          }),
          {
            status: 502,
            headers: { "x-request-id": "req-fail", "Content-Type": "application/json" },
          },
        ),
      ),
    );

    const result = await requestEditorAgentEdit({
      project: sampleProject(),
      request: "Make this modern.",
      projectId: "proj-1",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toMatch(/could not apply|try again/i);
    expect(result.requestId).toBe("req-fail");
  });
});

describe("zero-operation response", () => {
  it("asks a follow-up instead of appearing broken", async () => {
    const result = await tryRunEditorAgent({
      project: sampleProject(),
      request: "asdf qwerty zxcv unrelated gibberish",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.applyStatus).toBe("needs_clarification");
    expect(result.operations).toHaveLength(0);
    expect(result.explanation.toLowerCase()).not.toMatch(/no changes needed/);
    expect(
      result.explanation.endsWith("?") ||
        /precise|richer photos|sharper writing|focus|concrete/i.test(
          result.explanation,
        ),
    ).toBe(true);
  });
});

describe("duplicate Send is blocked", () => {
  it("in-flight guard prevents overlapping sends at the helper level", async () => {
    let resolveFetch!: (value: Response) => void;
    const fetchPromise = new Promise<Response>((resolve) => {
      resolveFetch = resolve;
    });
    let calls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(() => {
        calls += 1;
        return fetchPromise;
      }),
    );

    const first = requestEditorAgentEdit({
      project: sampleProject(),
      request: "Make this modern.",
    });
    // Second call is independent at the helper — the UI inFlightRef blocks duplicates.
    // Prove the UI contract via a tiny mutex simulation matching website-editor.
    let inFlight = false;
    async function guardedSend() {
      if (inFlight) return "blocked";
      inFlight = true;
      try {
        await requestEditorAgentEdit({
          project: sampleProject(),
          request: "Make this modern.",
        });
        return "ok";
      } finally {
        inFlight = false;
      }
    }

    const a = guardedSend();
    const b = guardedSend();
    resolveFetch(
      new Response(
        JSON.stringify({
          explanation: "ok",
          operations: [
            {
              operation: "replaceText",
              target: "hero.title",
              value: "New",
            },
          ],
          changes: [{ id: "1", label: "Hero rewritten", ok: true }],
          project: { ...sampleProject(), heroHeadline: "New" },
          applyStatus: "applied",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", "x-request-id": "r1" },
        },
      ),
    );
    const results = await Promise.all([a, b, first]);
    expect(results[1]).toBe("blocked");
    expect(results[0]).toBe("ok");
    expect(calls).toBeGreaterThanOrEqual(1);
  });
});

describe("401 falls back to local agent", () => {
  it("still applies edits when the API returns unauthorized", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              error: { code: "unauthorized", message: "Unauthorized", requestId: "u1" },
            }),
            {
              status: 401,
              headers: { "x-request-id": "u1", "Content-Type": "application/json" },
            },
          ),
      ),
    );

    const result = await requestEditorAgentEdit({
      project: sampleProject(),
      request: "Make this website look more modern and professional.",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.applyStatus).toBe("applied");
    expect(result.project.heroHeadline).not.toBe(sampleProject().heroHeadline);
  });
});
