import { describe, expect, it } from "vitest";
import { summarizeWebsiteChanges } from "@/components/editor/atlas-change-summary";

describe("summarizeWebsiteChanges", () => {
  it("deduplicates repeated labels and groups areas", () => {
    const summary = summarizeWebsiteChanges([
      { id: "a", label: "Buttons updated", ok: true },
      { id: "b", label: "Buttons updated", ok: true },
      { id: "c", label: "Whitespace adjusted", ok: true },
      { id: "d", label: "Colors updated", ok: true },
    ]);
    expect(summary.count).toBe(3);
    expect(summary.areas).toEqual(["Buttons", "Spacing", "Colors"]);
  });
});
