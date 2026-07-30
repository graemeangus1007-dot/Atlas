/**
 * Strict JSON Schema for Design Critique Structured Outputs (Sprint 28.0A / 28.0B).
 * Runtime validation in design-critique.ts remains authoritative.
 *
 * OpenAI wire format is produced via toOpenAiStrictSchema() which strips
 * unsupported keywords (minLength/maxLength/minItems/…).
 */

import { PROPOSED_CHANGE_KINDS } from "@/lib/ai/design-critique-types";

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

export const DESIGN_CRITIQUE_SCHEMA_NAME = "atlas_design_critique";

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

const improvementSchema = {
  type: "object",
  additionalProperties: false,
  // IDs are optional — Atlas generates stable ids when the model omits them.
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
    id: optionalString(64),
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
} as const;

/**
 * JSON Schema for LLM design critique (Atlas authoritative copy).
 * Pass through toOpenAiStrictSchema() before sending to OpenAI.
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
      maxItems: 5,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "evidence"],
        properties: {
          id: optionalString(64),
          title: stringField(120),
          evidence: stringField(400),
        },
      },
    },
    coreProblems: {
      type: "array",
      minItems: 1,
      maxItems: 7,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "observation", "severity", "affectedAreas"],
        properties: {
          id: optionalString(64),
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
      maxItems: 7,
      items: improvementSchema,
    },
    expectedOutcome: stringField(600),
    confidence: { type: "number" },
  },
} as const;

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
    if (Array.isArray(obj.required) && obj.properties) {
      const props = Object.keys(obj.properties as object);
      for (const key of obj.required as string[]) {
        if (!props.includes(key)) {
          issues.push(`${path}: required "${key}" missing from properties`);
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
