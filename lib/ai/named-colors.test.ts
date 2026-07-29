/**
 * Regression: navy + gold theme intents must set distinct primary/accent colors.
 */

import { describe, expect, it } from "vitest";
import { applyEditOperations } from "@/lib/ai/apply-edit-operations";
import {
  planEditOperations,
  runEditorAgent,
} from "@/lib/ai/editor-agent";
import {
  canUndoEditorRevision,
  createEmptyRevisionStack,
  pushEditorRevision,
  undoEditorRevision,
} from "@/lib/ai/editor-revisions";
import {
  NAMED_COLORS,
  parseThemeColorIntent,
  resolveNamedColor,
  wantsPreserveWording,
} from "@/lib/ai/named-colors";
import { buildSiteDesignStyle } from "@/lib/design-theme";
import { MOCK_BUSINESS_PROJECT } from "@/data/mock-project";

const PROMPT =
  "Change the website to a dark navy theme with gold accents. Keep all wording exactly the same.";

function sampleProject() {
  return {
    ...MOCK_BUSINESS_PROJECT,
    businessName: "Cedar Cafe",
    heroHeadline: "Exact headline stays",
    heroSubheadline: "Exact subheadline stays",
    description: "Exact about body stays",
    primaryCta: "Exact CTA",
    primaryColor: "#3db8a8",
    accentColor: "#3db8a8",
    backgroundColor: "#07090d",
    publish: null,
  };
}

describe("named color mapping", () => {
  it("maps common named colors to hex", async () => {
    expect(resolveNamedColor("gold")).toBe(NAMED_COLORS.gold);
    expect(resolveNamedColor("navy")).toBe(NAMED_COLORS.navy);
    expect(resolveNamedColor("emerald")).toBe(NAMED_COLORS.emerald);
    expect(resolveNamedColor("burgundy")).toBe(NAMED_COLORS.burgundy);
    expect(resolveNamedColor("charcoal")).toBe(NAMED_COLORS.charcoal);
    expect(resolveNamedColor("cream")).toBe(NAMED_COLORS.cream);
    expect(resolveNamedColor("silver")).toBe(NAMED_COLORS.silver);
    expect(resolveNamedColor("teal")).toBe(NAMED_COLORS.teal);
    expect(resolveNamedColor("coral")).toBe(NAMED_COLORS.coral);
  });

  it("parses dark navy theme with gold accents into two distinct colors", async () => {
    const parsed = parseThemeColorIntent(PROMPT.toLowerCase());
    expect(parsed).not.toBeNull();
    expect(parsed!.primary).toBeTruthy();
    expect(parsed!.accent).toBe(NAMED_COLORS.gold);
    expect(parsed!.primary).not.toBe(parsed!.accent);
    expect(parsed!.background).toBe(NAMED_COLORS.darkNavy);
    expect(wantsPreserveWording(PROMPT.toLowerCase())).toBe(true);
  });
});

describe("navy + gold theme apply", () => {
  it("maps navy + gold to two distinct project colors", async () => {
    const before = sampleProject();
    const planned = planEditOperations({
      project: before,
      request: PROMPT,
    });
    const themeOp = planned.operations.find((op) => op.operation === "changeTheme");
    expect(themeOp?.operation).toBe("changeTheme");
    if (themeOp?.operation !== "changeTheme") return;
    expect(themeOp.primary).toBeTruthy();
    expect(themeOp.accent).toBe(NAMED_COLORS.gold);
    expect(themeOp.primary).not.toBe(themeOp.accent);

    const { project } = applyEditOperations(before, planned.operations);
    expect(project.primaryColor).toBe(themeOp.primary);
    expect(project.accentColor).toBe(NAMED_COLORS.gold);
    expect(project.primaryColor).not.toBe(project.accentColor);
    expect(project.backgroundColor).toBe(NAMED_COLORS.darkNavy);
  });

  it("accent color reaches the rendered site design tokens", async () => {
    const result = await runEditorAgent({
      project: sampleProject(),
      request: PROMPT,
    });
    expect(result.ok).toBe(true);
    expect(result.applyStatus).toBe("applied");
    expect(result.project.accentColor).toBe(NAMED_COLORS.gold);

    const style = buildSiteDesignStyle(result.project) as Record<string, string>;
    expect(style["--site-accent"]).toBe(NAMED_COLORS.gold);
    expect(style["--accent"]).toBe(NAMED_COLORS.gold);
    // Buttons / links read --site-accent; primary remains navy family.
    expect(style["--site-primary"]).not.toBe(NAMED_COLORS.gold);
    expect(style["--site-primary"]).toBe(result.project.primaryColor);
  });

  it("keeps all wording unchanged for this request", async () => {
    const before = sampleProject();
    const result = await runEditorAgent({
      project: before,
      request: PROMPT,
    });
    expect(result.operations.every((op) => op.operation !== "replaceText")).toBe(
      true,
    );
    expect(result.operations.every((op) => op.operation !== "rewriteServices")).toBe(
      true,
    );
    expect(result.project.heroHeadline).toBe(before.heroHeadline);
    expect(result.project.heroSubheadline).toBe(before.heroSubheadline);
    expect(result.project.description).toBe(before.description);
    expect(result.project.primaryCta).toBe(before.primaryCta);
    expect(result.project.services).toEqual(before.services);
  });

  it("undo restores both prior primary and accent colors", async () => {
    const before = sampleProject();
    const result = await runEditorAgent({
      project: before,
      request: PROMPT,
    });
    expect(result.project.accentColor).toBe(NAMED_COLORS.gold);
    expect(result.project.primaryColor).not.toBe(before.primaryColor);

    let stack = createEmptyRevisionStack();
    stack = pushEditorRevision(stack, {
      before,
      after: result.project,
      operations: result.operations,
      changes: result.changes,
      prompt: PROMPT,
    });
    expect(canUndoEditorRevision(stack)).toBe(true);
    const undone = undoEditorRevision(stack);
    expect(undone).not.toBeNull();
    expect(undone!.project.primaryColor).toBe(before.primaryColor);
    expect(undone!.project.accentColor).toBe(before.accentColor);
  });
});
