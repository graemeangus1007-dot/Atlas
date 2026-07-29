/**
 * Strict JSON Schema for Design Critique Structured Outputs (Sprint 28.0A).
 * Runtime validation in design-critique.ts remains authoritative.
 */

import { PROPOSED_CHANGE_KINDS } from "@/lib/ai/design-critique-types";

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
    metaDescription: optionalString(320),
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
  required: [
    "id",
    "title",
    "observation",
    "rationale",
    "expectedBusinessOutcome",
    "impact",
    "affectedAreas",
    "proposedChanges",
  ],
  properties: {
    id: stringField(64),
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
 * JSON Schema for LLM design critique (strict Structured Outputs).
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
        required: ["id", "title", "evidence"],
        properties: {
          id: stringField(64),
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
        required: ["id", "title", "observation", "severity", "affectedAreas"],
        properties: {
          id: stringField(64),
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
    confidence: { type: "number", minimum: 0, maximum: 1 },
  },
} as const;
