/**
 * Designer voice — response template consistency (Atlas v1 polish).
 */

import { describe, expect, it } from "vitest";
import {
  ATLAS_BANNED_PHRASES,
  ATLAS_DESIGNER_CLARIFICATION_OPTIONS,
  ATLAS_VOICE,
  atlasAppliedSummary,
  atlasProgressLabel,
  buildClarificationQuestion,
  findBannedPhrase,
} from "@/lib/ai/atlas-designer-voice";
import { decideAtlasBrain } from "@/lib/ai/atlas-brain-routing";
import { extractNaturalLanguageEditPlan } from "@/lib/ai/nl-edit-planner";
import { MOCK_BUSINESS_PROJECT } from "@/data/mock-project";

function sampleProject() {
  return {
    ...MOCK_BUSINESS_PROJECT,
    businessName: "Cedar Cafe",
  };
}

describe("atlas designer voice templates", () => {
  it("clarification options use designer language, not Better visuals chips", () => {
    expect([...ATLAS_DESIGNER_CLARIFICATION_OPTIONS]).toEqual([
      "Richer photos",
      "Sharper writing",
      "Stronger calls to action",
      "Something else",
    ]);
    const q = buildClarificationQuestion();
    expect(findBannedPhrase(q)).toBeNull();
    expect(q).toMatch(/precise/i);
    expect(q).toMatch(/Richer photos/);
  });

  it("vague Brain clarification omits banned assistant phrases", () => {
    const decision = decideAtlasBrain({
      project: sampleProject(),
      request: "Not sure",
    });
    expect(decision.needsClarification).toBe(true);
    const text = [
      decision.clarificationQuestion,
      decision.explanation,
      ...(decision.followUpSuggestions ?? []),
    ].join("\n");
    expect(findBannedPhrase(text)).toBeNull();
    expect(text).not.toMatch(/Did you mean/i);
    expect(text).not.toMatch(/I can help with that/i);
    expect(text).toMatch(/Richer photos|precise/i);
  });

  it("clear color+contrast request leads with committed designer intent", () => {
    const plan = extractNaturalLanguageEditPlan({
      project: sampleProject(),
      request: "Turn the colors to green and gold. Make the buttons easier to read.",
    });
    expect(plan.intent).toBe("edit");
    expect(plan.explanation).toMatch(/^I’ll /);
    expect(plan.explanation).toMatch(/green|gold|palette|contrast/i);
    expect(findBannedPhrase(plan.explanation)).toBeNull();
  });

  it("progress labels describe design work, not engine steps", () => {
    expect(atlasProgressLabel("make the palette green")).toMatch(/palette/i);
    expect(atlasProgressLabel("review my website")).toMatch(/homepage|layout/i);
    expect(atlasProgressLabel("")).toBe(ATLAS_VOICE.progressDefault);
    for (const label of [
      atlasProgressLabel("colors"),
      atlasProgressLabel("buttons"),
      atlasProgressLabel("fonts"),
    ]) {
      expect(label).not.toMatch(/Applying operations|Running planner|Thinking/i);
    }
  });

  it("applied summary is brief and designer-facing", () => {
    expect(atlasAppliedSummary({ count: 2, areas: ["Colors", "Buttons"] })).toMatch(
      /Colors|Buttons/i,
    );
    expect(atlasAppliedSummary({ count: 1, areas: ["Hero"] })).toMatch(/hero/i);
    expect(ATLAS_VOICE.appliedTitle).toBe("Done");
    expect(ATLAS_VOICE.welcome("Cedar Cafe")).toMatch(/Cedar Cafe/);
    expect(findBannedPhrase(ATLAS_VOICE.welcome("Cedar Cafe"))).toBeNull();
  });

  it("documents banned phrases for regressions", () => {
    expect(ATLAS_BANNED_PHRASES.length).toBeGreaterThan(5);
    expect(ATLAS_BANNED_PHRASES).toContain("I can help with that");
    expect(findBannedPhrase("I can help with that right away.")).toBe(
      "I can help with that",
    );
  });
});
