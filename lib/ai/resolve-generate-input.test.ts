import { describe, expect, it } from "vitest";
import {
  coalesceNonEmpty,
  resolveGenerateIdentity,
} from "@/lib/ai/resolve-generate-input";

describe("resolveGenerateIdentity precedence", () => {
  it("never lets project Atlas Digital replace questionnaire Northforge Digital", () => {
    const identity = resolveGenerateIdentity(
      {
        businessName: "Northforge Digital",
        businessType: "Agency",
        description: "Modern websites for local brands.",
        questionnaire: {
          businessName: "Northforge Digital",
          businessType: "Agency",
          description: "Modern websites for local brands.",
        },
      },
      {
        business_name: "Atlas Digital",
        business_type: "Other",
        description: "Placeholder project copy",
      },
    );

    expect(identity.businessName).toBe("Northforge Digital");
    expect(identity.businessType).toBe("Agency");
    expect(identity.description).toBe("Modern websites for local brands.");
  });

  it("uses nested questionnaire identity when top-level fields are blank", () => {
    const identity = resolveGenerateIdentity(
      {
        businessName: "  ",
        businessType: "",
        description: undefined,
        questionnaire: {
          businessName: "Northforge Digital",
          businessType: "Web Design",
          description: "Custom digital experiences.",
        },
      },
      {
        business_name: "Atlas Digital",
        business_type: "Other",
        description: "Should not win",
      },
    );

    expect(identity.businessName).toBe("Northforge Digital");
    expect(identity.businessType).toBe("Web Design");
    expect(identity.description).toBe("Custom digital experiences.");
  });

  it("falls back to project only when questionnaire left fields blank", () => {
    const identity = resolveGenerateIdentity(
      { questionnaire: { tone: "modern" } },
      {
        business_name: "Atlas Digital",
        business_type: "Other",
        description: "From project row",
      },
    );
    expect(identity.businessName).toBe("Atlas Digital");
    expect(identity.description).toBe("From project row");
  });

  it("coalesceNonEmpty skips blanks", () => {
    expect(coalesceNonEmpty("", "  ", "Northforge Digital")).toBe(
      "Northforge Digital",
    );
    expect(coalesceNonEmpty(undefined, null, "")).toBe("");
  });
});
