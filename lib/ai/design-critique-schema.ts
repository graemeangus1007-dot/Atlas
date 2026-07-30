/**
 * Design Critique JSON Schema (Sprint 28.0A / 28.0D).
 *
 * Two layers:
 * 1. DESIGN_CRITIQUE_JSON_SCHEMA — Atlas documentation schema (may include
 *    length/array constraints enforced by validateDesignCritique).
 * 2. buildOpenAiDesignCritiqueSchema() — OpenAI strict Structured Outputs wire
 *    schema only (no unsupported keywords; every property required).
 */

import { PROPOSED_CHANGE_KINDS } from "@/lib/ai/design-critique-types";
import { toOpenAiStrictSchema } from "@/lib/ai/openai-structured-output";

/** Atlas-side string constraints (enforced in validateDesignCritique). */
const stringField = (maxLength: number, minLength = 1) =>
  ({
    type: "string",
    minLength,
    maxLength,
  }) as const;

/** Empty-allowed string for unused optional fields (strict schema requires all keys). */
const optionalString = (maxLength: number) =>
  ({
    type: "string",
    minLength: 0,
    maxLength,
  }) as const;

/** Wire-only string — no length keywords (OpenAI rejects minLength/maxLength). */
const wireString = { type: "string" } as const;

export const DESIGN_CRITIQUE_SCHEMA_NAME = "atlas_design_critique";

/**
 * Keywords that must never appear on the OpenAI wire schema.
 * Length/array bounds are enforced by Atlas post-response validation.
 */
export const OPENAI_UNSUPPORTED_SCHEMA_KEYWORDS = [
  "minLength",
  "maxLength",
  "minimum",
  "maximum",
  "multipleOf",
  "pattern",
  "format",
  "minItems",
  "maxItems",
  "uniqueItems",
  "minProperties",
  "maxProperties",
  "oneOf",
  "anyOf",
  "allOf",
  "$ref",
  "$defs",
  "definitions",
  "nullable",
] as const;

const proposedChangeSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "kind",
    "target",
    "value",
    "sectionType",
    "headingFont",
    "bodyFont",
    "buttonStyle",
    "siteWidth",
    "templateId",
    "theme",
    "primary",
    "secondary",
    "accent",
    "background",
    "fromColor",
    "toColor",
    "siteTitle",
    "metaDescription",
    "spacing",
    "serviceIcons",
    "motion",
    "visualHierarchy",
    "contactFormEnabled",
    "assetHint",
    "sectionSlot",
    "servicesJson",
  ],
  properties: {
    kind: {
      type: "string",
      enum: [...PROPOSED_CHANGE_KINDS],
    },
    target: optionalString(80),
    value: optionalString(2000),
    sectionType: optionalString(40),
    headingFont: optionalString(40),
    bodyFont: optionalString(40),
    buttonStyle: optionalString(40),
    siteWidth: optionalString(20),
    templateId: optionalString(40),
    theme: optionalString(20),
    primary: optionalString(40),
    secondary: optionalString(40),
    accent: optionalString(40),
    background: optionalString(40),
    fromColor: optionalString(40),
    toColor: optionalString(40),
    siteTitle: optionalString(120),
    metaDescription: optionalString(160),
    spacing: optionalString(20),
    serviceIcons: { type: "boolean" },
    motion: { type: "boolean" },
    visualHierarchy: { type: "boolean" },
    contactFormEnabled: { type: "boolean" },
    assetHint: optionalString(80),
    sectionSlot: optionalString(40),
    servicesJson: optionalString(4000),
  },
} as const;

/**
 * Atlas documentation schema (may include constraints stripped for OpenAI).
 * Note: `id` fields are Atlas-only — omitted from the wire schema so OpenAI
 * strict mode does not reject optional properties. validateDesignCritique
 * generates stable ids after parsing.
 */
export const DESIGN_CRITIQUE_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "summary",
    "currentStrengths",
    "coreProblems",
    "designDirection",
    "prioritizedImprovements",
    "expectedOutcome",
    "confidence",
  ],
  properties: {
    summary: stringField(800),
    currentStrengths: {
      type: "array",
      minItems: 1,
      maxItems: 3,
      items: {
        type: "object",
        additionalProperties: false,
        // id omitted — Atlas generates after parse (OpenAI strict requires all props).
        required: ["title", "evidence"],
        properties: {
          title: stringField(120),
          evidence: stringField(400),
        },
      },
    },
    coreProblems: {
      type: "array",
      minItems: 1,
      maxItems: 5,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "observation", "severity", "affectedAreas"],
        properties: {
          title: stringField(120),
          observation: stringField(600),
          severity: { type: "string", enum: ["missing", "weak"] },
          affectedAreas: {
            type: "array",
            minItems: 1,
            maxItems: 8,
            items: stringField(80),
          },
        },
      },
    },
    designDirection: {
      type: "object",
      additionalProperties: false,
      required: ["name", "rationale", "emotionalGoal", "visualPrinciples"],
      properties: {
        name: stringField(80),
        rationale: stringField(600),
        emotionalGoal: stringField(300),
        visualPrinciples: {
          type: "array",
          minItems: 2,
          maxItems: 6,
          items: stringField(160),
        },
      },
    },
    prioritizedImprovements: {
      type: "array",
      minItems: 1,
      maxItems: 5,
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "title",
          "observation",
          "rationale",
          "expectedBusinessOutcome",
          "impact",
          "affectedAreas",
          "proposedChanges",
        ],
        properties: {
          title: stringField(120),
          observation: stringField(600),
          rationale: stringField(800),
          expectedBusinessOutcome: stringField(400),
          impact: { type: "string", enum: ["high", "medium", "low"] },
          affectedAreas: {
            type: "array",
            minItems: 1,
            maxItems: 8,
            items: stringField(80),
          },
          proposedChanges: {
            type: "array",
            minItems: 0,
            maxItems: 8,
            items: proposedChangeSchema,
          },
        },
      },
    },
    expectedOutcome: stringField(600),
    confidence: { type: "number" },
  },
} as const;

/**
 * OpenAI-compatible wire schema for Responses API strict Structured Outputs.
 * - No unsupported keywords (minLength, minItems, oneOf, $ref, …)
 * - Every object: additionalProperties: false
 * - Every declared property listed in required
 * - No id fields (Atlas assigns after parse)
 */
export function buildOpenAiDesignCritiqueSchema(): Record<string, unknown> {
  const proposedChangeWire = {
    type: "object",
    additionalProperties: false,
    required: [...proposedChangeSchema.required],
    properties: {
      kind: {
        type: "string",
        enum: [...PROPOSED_CHANGE_KINDS],
      },
      target: wireString,
      value: wireString,
      sectionType: wireString,
      headingFont: wireString,
      bodyFont: wireString,
      buttonStyle: wireString,
      siteWidth: wireString,
      templateId: wireString,
      theme: wireString,
      primary: wireString,
      secondary: wireString,
      accent: wireString,
      background: wireString,
      fromColor: wireString,
      toColor: wireString,
      siteTitle: wireString,
      metaDescription: wireString,
      spacing: wireString,
      serviceIcons: { type: "boolean" },
      motion: { type: "boolean" },
      visualHierarchy: { type: "boolean" },
      contactFormEnabled: { type: "boolean" },
      assetHint: wireString,
      sectionSlot: wireString,
      servicesJson: wireString,
    },
  };

  const wire: Record<string, unknown> = {
    type: "object",
    additionalProperties: false,
    required: [
      "summary",
      "currentStrengths",
      "coreProblems",
      "designDirection",
      "prioritizedImprovements",
      "expectedOutcome",
      "confidence",
    ],
    properties: {
      summary: wireString,
      currentStrengths: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["title", "evidence"],
          properties: {
            title: wireString,
            evidence: wireString,
          },
        },
      },
      coreProblems: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["title", "observation", "severity", "affectedAreas"],
          properties: {
            title: wireString,
            observation: wireString,
            severity: { type: "string", enum: ["missing", "weak"] },
            affectedAreas: {
              type: "array",
              items: wireString,
            },
          },
        },
      },
      designDirection: {
        type: "object",
        additionalProperties: false,
        required: ["name", "rationale", "emotionalGoal", "visualPrinciples"],
        properties: {
          name: wireString,
          rationale: wireString,
          emotionalGoal: wireString,
          visualPrinciples: {
            type: "array",
            items: wireString,
          },
        },
      },
      prioritizedImprovements: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: [
            "title",
            "observation",
            "rationale",
            "expectedBusinessOutcome",
            "impact",
            "affectedAreas",
            "proposedChanges",
          ],
          properties: {
            title: wireString,
            observation: wireString,
            rationale: wireString,
            expectedBusinessOutcome: wireString,
            impact: { type: "string", enum: ["high", "medium", "low"] },
            affectedAreas: {
              type: "array",
              items: wireString,
            },
            proposedChanges: {
              type: "array",
              items: proposedChangeWire,
            },
          },
        },
      },
      expectedOutcome: wireString,
      confidence: { type: "number" },
    },
  };

  // Defense in depth: strip any unsupported keywords if they sneak in.
  return toOpenAiStrictSchema(wire);
}

/** Assert every object node sets additionalProperties: false. */
export function assertCritiqueSchemaStrictShape(
  schema: unknown = DESIGN_CRITIQUE_JSON_SCHEMA,
  path = "root",
): string[] {
  const issues: string[] = [];
  if (!schema || typeof schema !== "object" || Array.isArray(schema)) {
    return issues;
  }
  const obj = schema as Record<string, unknown>;
  if (obj.type === "object") {
    if (obj.additionalProperties !== false) {
      issues.push(`${path}: additionalProperties must be false`);
    }
    if (obj.properties && typeof obj.properties === "object") {
      const props = Object.keys(obj.properties as object);
      const required = Array.isArray(obj.required)
        ? (obj.required as string[])
        : [];
      for (const key of required) {
        if (!props.includes(key)) {
          issues.push(`${path}: required "${key}" missing from properties`);
        }
      }
      for (const key of props) {
        if (!required.includes(key)) {
          issues.push(
            `${path}: property "${key}" must be listed in required (OpenAI strict)`,
          );
        }
      }
    }
  }
  if (obj.properties && typeof obj.properties === "object") {
    for (const [key, value] of Object.entries(
      obj.properties as Record<string, unknown>,
    )) {
      issues.push(...assertCritiqueSchemaStrictShape(value, `${path}.${key}`));
    }
  }
  if (obj.items) {
    issues.push(...assertCritiqueSchemaStrictShape(obj.items, `${path}.items`));
  }
  return issues;
}

/** Collect unsupported keyword paths in a schema tree. */
export function findUnsupportedOpenAiSchemaKeywords(
  schema: unknown,
  path = "root",
): string[] {
  const issues: string[] = [];
  if (!schema || typeof schema !== "object") return issues;
  if (Array.isArray(schema)) {
    schema.forEach((item, i) => {
      issues.push(
        ...findUnsupportedOpenAiSchemaKeywords(item, `${path}[${i}]`),
      );
    });
    return issues;
  }
  const obj = schema as Record<string, unknown>;
  for (const key of OPENAI_UNSUPPORTED_SCHEMA_KEYWORDS) {
    if (key in obj) {
      issues.push(`${path}.${key}`);
    }
  }
  for (const [key, value] of Object.entries(obj)) {
    if (OPENAI_UNSUPPORTED_SCHEMA_KEYWORDS.includes(key as never)) continue;
    if (value && typeof value === "object") {
      issues.push(
        ...findUnsupportedOpenAiSchemaKeywords(value, `${path}.${key}`),
      );
    }
  }
  return issues;
}
