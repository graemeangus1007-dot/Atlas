/**
 * Sprint 28.0D — OpenAI critique wire schema contract tests.
 */

import { describe, expect, it } from "vitest";
import {
  assertCritiqueSchemaStrictShape,
  buildOpenAiDesignCritiqueSchema,
  DESIGN_CRITIQUE_JSON_SCHEMA,
  DESIGN_CRITIQUE_SCHEMA_NAME,
  findUnsupportedOpenAiSchemaKeywords,
  OPENAI_UNSUPPORTED_SCHEMA_KEYWORDS,
} from "@/lib/ai/design-critique-schema";
import {
  buildDesignCritiqueContext,
  validateDesignCritique,
} from "@/lib/ai/design-critique";
import { buildOpenAiDesignCritiqueParams } from "@/lib/ai/design-critique-provider";
import { PROPOSED_CHANGE_KINDS } from "@/lib/ai/design-critique-types";
import { MOCK_BUSINESS_PROJECT } from "@/data/mock-project";

function walkObjects(
  schema: unknown,
  visit: (obj: Record<string, unknown>, path: string) => void,
  path = "root",
): void {
  if (!schema || typeof schema !== "object") return;
  if (Array.isArray(schema)) {
    schema.forEach((item, i) => walkObjects(item, visit, `${path}[${i}]`));
    return;
  }
  const obj = schema as Record<string, unknown>;
  if (obj.type === "object") visit(obj, path);
  if (obj.properties && typeof obj.properties === "object") {
    for (const [key, value] of Object.entries(
      obj.properties as Record<string, unknown>,
    )) {
      walkObjects(value, visit, `${path}.${key}`);
    }
  }
  if (obj.items) walkObjects(obj.items, visit, `${path}.items`);
}

describe("buildOpenAiDesignCritiqueSchema contract", () => {
  it("uses additionalProperties:false and requires every declared property", () => {
    const wire = buildOpenAiDesignCritiqueSchema();
    expect(assertCritiqueSchemaStrictShape(wire)).toEqual([]);
    expect(findUnsupportedOpenAiSchemaKeywords(wire)).toEqual([]);

    walkObjects(wire, (obj, path) => {
      expect(obj.additionalProperties, path).toBe(false);
      const props = Object.keys((obj.properties as object) ?? {});
      const required = obj.required as string[];
      expect(required, path).toEqual(expect.arrayContaining(props));
      expect(props.sort(), path).toEqual([...required].sort());
    });
  });

  it("strips all unsupported OpenAI keywords from the wire schema", () => {
    const wire = buildOpenAiDesignCritiqueSchema();
    const json = JSON.stringify(wire);
    for (const key of OPENAI_UNSUPPORTED_SCHEMA_KEYWORDS) {
      expect(json).not.toMatch(new RegExp(`"${key}"`));
    }
    // Atlas documentation schema may still carry length constraints.
    expect(JSON.stringify(DESIGN_CRITIQUE_JSON_SCHEMA)).toMatch(/minLength/);
  });

  it("omits id fields so Atlas can generate ids after parsing", () => {
    const wire = buildOpenAiDesignCritiqueSchema();
    const json = JSON.stringify(wire);
    expect(json).not.toMatch(/"id"/);

    const validated = validateDesignCritique({
      summary: "Clear offer with a weak first impression.",
      currentStrengths: [
        { title: "Clarity", evidence: "Headline states the offer." },
      ],
      coreProblems: [
        {
          title: "Missing hero image",
          observation: "Placeholder hero.",
          severity: "missing",
          affectedAreas: ["hero"],
        },
      ],
      designDirection: {
        name: "Premium",
        rationale: "Stronger imagery.",
        emotionalGoal: "Trust",
        visualPrinciples: ["Imagery first", "One CTA"],
      },
      prioritizedImprovements: [
        {
          title: "Add hero photo",
          observation: "No hero photo",
          rationale: "Emotion",
          expectedBusinessOutcome: "Trust",
          impact: "high",
          affectedAreas: ["hero"],
          proposedChanges: [],
        },
      ],
      expectedOutcome: "Better first impression.",
      confidence: 0.8,
    });
    expect(validated.currentStrengths[0]?.id).toMatch(/^strength-/);
    expect(validated.coreProblems[0]?.id).toMatch(/^problem-/);
    expect(validated.prioritizedImprovements[0]?.id).toMatch(/^improve-/);
  });

  it("keeps enum values aligned with TypeScript proposed-change kinds", () => {
    const wire = buildOpenAiDesignCritiqueSchema();
    let kindEnum: string[] | null = null;
    walkObjects(wire, (obj) => {
      const props = obj.properties as Record<string, { enum?: string[] }> | undefined;
      if (props?.kind?.enum) kindEnum = props.kind.enum;
    });
    expect(kindEnum).toEqual([...PROPOSED_CHANGE_KINDS]);
  });

  it("passes the wire schema unchanged into responses.create params", () => {
    const wire = buildOpenAiDesignCritiqueSchema();
    const params = buildOpenAiDesignCritiqueParams({
      model: "gpt-5.2",
      temperature: 0.35,
      maxOutputTokens: 2000,
      request: "Review this homepage",
      mode: "critique",
      context: buildDesignCritiqueContext(MOCK_BUSINESS_PROJECT),
    });
    expect(params.text?.format).toMatchObject({
      type: "json_schema",
      name: DESIGN_CRITIQUE_SCHEMA_NAME,
      strict: true,
    });
    expect(
      (params.text?.format as { schema?: unknown })?.schema,
    ).toEqual(wire);
  });
});
