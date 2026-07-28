/**
 * Sprint 22.0A — Atlas AI Design Assistant foundation tests.
 */

import { describe, expect, it } from "vitest";
import { applyEditOperations } from "@/lib/ai/apply-edit-operations";
import {
  EDIT_OPERATION_KINDS,
  REQUIRED_SECTION_IDS,
} from "@/lib/ai/edit-operations";
import {
  appendConversationMessage,
  createEmptyEditorConversation,
  serializeConversationForAgent,
} from "@/lib/ai/editor-conversation";
import {
  planEditOperations,
  runEditorAgent,
  tryRunEditorAgent,
} from "@/lib/ai/editor-agent";
import {
  canRedoEditorRevision,
  canUndoEditorRevision,
  createEmptyRevisionStack,
  pushEditorRevision,
  redoEditorRevision,
  undoEditorRevision,
} from "@/lib/ai/editor-revisions";
import { validateEditOperations } from "@/lib/ai/validate-edit-operations";
import { AiError } from "@/lib/ai/errors";
import { MOCK_BUSINESS_PROJECT } from "@/data/mock-project";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function sampleProject() {
  return {
    ...MOCK_BUSINESS_PROJECT,
    businessName: "Cedar Cafe",
    primaryColor: "#2563eb",
    accentColor: "#3b82f6",
    heroHeadline: "Old headline",
    description: "A neighborhood cafe.",
    publish: null,
  };
}

describe("edit operation validation", () => {
  it("accepts a valid operation list", () => {
    const ops = validateEditOperations([
      {
        operation: "replaceText",
        target: "hero.title",
        value: "Grow Faster With AI",
      },
      { operation: "changeTheme", primary: "#0f766e" },
      { operation: "insertSection", type: "testimonials" },
    ]);
    expect(ops).toHaveLength(3);
    expect(ops[0]?.operation).toBe("replaceText");
  });

  it("rejects unknown operations", () => {
    expect(() =>
      validateEditOperations([{ operation: "hackSite", value: "x" }]),
    ).toThrow(AiError);
    expect(() =>
      validateEditOperations([{ operation: "hackSite", value: "x" }]),
    ).toThrow(/Unknown edit operation/);
  });

  it("rejects invalid replaceText targets", () => {
    expect(() =>
      validateEditOperations([
        { operation: "replaceText", target: "secret.key", value: "nope" },
      ]),
    ).toThrow(/Invalid replaceText target/);
  });

  it("rejects deleting required core sections by type confusion", () => {
    expect(REQUIRED_SECTION_IDS).toContain("hero");
    expect(() =>
      validateEditOperations([{ operation: "removeSection", type: "hero" }]),
    ).toThrow(/Invalid removeSection type/);
  });

  it("rejects empty and non-array payloads", () => {
    expect(() => validateEditOperations([])).toThrow(/empty/);
    expect(() => validateEditOperations({})).toThrow(/array/);
  });

  it("exposes a closed operation vocabulary", () => {
    expect(EDIT_OPERATION_KINDS).toContain("replaceText");
    expect(EDIT_OPERATION_KINDS).toContain("changeTheme");
    expect(EDIT_OPERATION_KINDS).toContain("insertSection");
    expect(EDIT_OPERATION_KINDS).not.toContain("eval");
  });
});

describe("apply edit operations", () => {
  it("applies replaceText, theme, and insertSection", () => {
    const { project, changes } = applyEditOperations(sampleProject(), [
      {
        operation: "replaceText",
        target: "hero.title",
        value: "Grow Faster With AI",
      },
      { operation: "changeTheme", primary: "#0f766e" },
      { operation: "insertSection", type: "faq" },
      { operation: "setButtonStyle", value: "pill" },
    ]);
    expect(project.heroHeadline).toBe("Grow Faster With AI");
    expect(project.primaryColor).toBe("#0f766e");
    expect(project.buttonStyle).toBe("pill");
    expect(project.designSections?.enabled).toContain("faq");
    expect(project.designSections?.faq?.length).toBeGreaterThan(0);
    expect(changes.some((c) => /FAQ/i.test(c.label))).toBe(true);
  });

  it("refuses to leave required content when removing only optional sections", () => {
    const withFaq = applyEditOperations(sampleProject(), [
      { operation: "insertSection", type: "faq" },
    ]).project;
    const removed = applyEditOperations(withFaq, [
      { operation: "removeSection", type: "faq" },
    ]).project;
    expect(removed.designSections?.enabled ?? []).not.toContain("faq");
    expect(removed.heroHeadline).toBeTruthy();
    expect(removed.services.length).toBeGreaterThan(0);
  });

  it("replaces blue brand colors with green", () => {
    const { project } = applyEditOperations(sampleProject(), [
      { operation: "replaceColors", from: "blue", to: "#0f766e" },
    ]);
    expect(project.primaryColor).toBe("#0f766e");
    expect(project.accentColor).toBe("#0f766e");
  });
});

describe("editor agent", () => {
  it("plans and applies natural language edits", () => {
    const result = runEditorAgent({
      project: sampleProject(),
      request: "Make the hero more modern and add an FAQ.",
    });
    expect(result.ok).toBe(true);
    expect(result.applyStatus).toBe("applied");
    expect(result.operations.length).toBeGreaterThan(0);
    expect(result.project.designSections?.enabled).toContain("faq");
    expect(result.explanation.length).toBeGreaterThan(10);
    expect(result.changes.length).toBeGreaterThan(0);
  });

  it("uses conversation history so follow-ups refer to the site", () => {
    const first = runEditorAgent({
      project: sampleProject(),
      request: "Make this website modern.",
    });
    const second = runEditorAgent({
      project: first.project,
      request: "Make it darker.",
      history: [
        { role: "user", content: "Make this website modern." },
        { role: "assistant", content: first.explanation },
      ],
    });
    expect(second.project.theme).toBe("dark");
    expect(second.project.backgroundColor.toLowerCase()).toMatch(/#0|#1/);
  });

  it("rewrites for a dental office", () => {
    const result = runEditorAgent({
      project: sampleProject(),
      request: "Rewrite everything for a dental office.",
    });
    expect(result.project.heroHeadline.toLowerCase()).toMatch(/smile|dental/i);
    expect(result.project.services.some((s) => /dental|care|smile/i.test(s.title + s.description))).toBe(
      true,
    );
  });

  it("improves SEO via structured updateSeo ops", () => {
    const planned = planEditOperations({
      project: sampleProject(),
      request: "Improve SEO.",
    });
    expect(planned.operations.some((op) => op.operation === "updateSeo")).toBe(
      true,
    );
    const validated = validateEditOperations(planned.operations);
    const applied = applyEditOperations(sampleProject(), validated);
    expect(applied.project.seo?.siteTitle).toBeTruthy();
    expect(applied.project.seo?.metaDescription).toBeTruthy();
  });

  it("returns a failure object for empty requests", () => {
    const result = tryRunEditorAgent({
      project: sampleProject(),
      request: "   ",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("bad_request");
  });
});

describe("conversation history", () => {
  it("preserves turns and serializes for the agent", () => {
    let convo = createEmptyEditorConversation();
    convo = appendConversationMessage(convo, {
      role: "user",
      content: "Make this website modern.",
    });
    convo = appendConversationMessage(convo, {
      role: "assistant",
      content: "Updated the layout.",
    });
    expect(convo.messages).toHaveLength(2);
    const serialized = serializeConversationForAgent(convo);
    expect(serialized[0]?.role).toBe("user");
    expect(serialized[1]?.content).toMatch(/layout/i);
  });
});

describe("undo / redo revisions", () => {
  it("undo restores the previous project and redo reapplies", () => {
    const before = sampleProject();
    const after = {
      ...before,
      heroHeadline: "After AI",
      primaryColor: "#0f766e",
    };
    let stack = createEmptyRevisionStack();
    stack = pushEditorRevision(stack, {
      before,
      after,
      operations: [
        {
          operation: "replaceText",
          target: "hero.title",
          value: "After AI",
        },
      ],
      changes: [{ id: "1", label: "Hero rewritten", ok: true }],
      prompt: "Make the hero more modern.",
    });

    expect(canUndoEditorRevision(stack)).toBe(true);
    expect(canRedoEditorRevision(stack)).toBe(false);

    const undone = undoEditorRevision(stack);
    expect(undone).not.toBeNull();
    expect(undone!.project.heroHeadline).toBe(before.heroHeadline);
    expect(canRedoEditorRevision(undone!.stack)).toBe(true);

    const redone = redoEditorRevision(undone!.stack);
    expect(redone).not.toBeNull();
    expect(redone!.project.heroHeadline).toBe("After AI");
    expect(redone!.project.primaryColor).toBe("#0f766e");
  });

  it("pushing after undo drops the redo branch", () => {
    const a = sampleProject();
    const b = { ...a, heroHeadline: "B" };
    const c = { ...a, heroHeadline: "C" };
    let stack = createEmptyRevisionStack();
    stack = pushEditorRevision(stack, {
      before: a,
      after: b,
      operations: [],
      changes: [],
      prompt: "one",
    });
    stack = pushEditorRevision(stack, {
      before: b,
      after: c,
      operations: [],
      changes: [],
      prompt: "two",
    });
    const undone = undoEditorRevision(stack)!;
    const d = { ...a, heroHeadline: "D" };
    const branched = pushEditorRevision(undone.stack, {
      before: undone.project,
      after: d,
      operations: [],
      changes: [],
      prompt: "branch",
    });
    expect(branched.revisions).toHaveLength(2);
    expect(branched.revisions[1]?.after.heroHeadline).toBe("D");
    expect(canRedoEditorRevision(branched)).toBe(false);
  });
});

describe("Design Assistant API contract", () => {
  it("exposes POST /api/ai/edit with auth and structured response fields", () => {
    const src = readFileSync(
      resolve(__dirname, "../../app/api/ai/edit/route.ts"),
      "utf8",
    );
    expect(src).toContain("tryRunEditorAgent");
    expect(src).toContain("unauthorized");
    expect(src).toContain("checkDomainRateLimit");
    expect(src).toContain("operations");
    expect(src).not.toContain("eval(");
  });
});
