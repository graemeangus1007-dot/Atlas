/**
 * Strict JSON Schema for OpenAI Structured Outputs (Responses API).
 * Mirrors validateGeneratedWebsiteDraft() rules where practical;
 * runtime validation remains authoritative.
 */

import {
  AI_DRAFT_LIMITS,
  AI_DRAFT_MAX_SERVICES,
  AI_DRAFT_MIN_SERVICES,
} from "@/lib/ai/draft-limits";
import { AI_OPTIONAL_SECTION_IDS } from "@/lib/ai/optional-sections";

const stringField = (maxLength: number) =>
  ({
    type: "string",
    minLength: 1,
    maxLength,
  }) as const;

/**
 * Schema name passed to OpenAI `text.format.name`.
 */
export const WEBSITE_DRAFT_SCHEMA_NAME = "atlas_website_draft";

/**
 * JSON Schema for generated website drafts (strict Structured Outputs).
 * Omits derived fields (brand, layoutPreset, mediaPlaceholders, contrastWarnings)
 * that validateGeneratedWebsiteDraft() fills in.
 */
export const WEBSITE_DRAFT_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "businessName",
    "businessType",
    "description",
    "heroEyebrow",
    "heroHeadline",
    "heroSubheadline",
    "primaryCta",
    "secondaryCta",
    "aboutTitle",
    "aboutBody",
    "services",
    "contact",
    "seo",
    "enabledSections",
  ],
  properties: {
    businessName: stringField(AI_DRAFT_LIMITS.businessName),
    businessType: stringField(AI_DRAFT_LIMITS.businessType),
    description: stringField(AI_DRAFT_LIMITS.description),
    heroEyebrow: stringField(AI_DRAFT_LIMITS.heroEyebrow),
    heroHeadline: stringField(AI_DRAFT_LIMITS.heroHeadline),
    heroSubheadline: stringField(AI_DRAFT_LIMITS.heroSubheadline),
    primaryCta: stringField(AI_DRAFT_LIMITS.primaryCta),
    secondaryCta: stringField(AI_DRAFT_LIMITS.secondaryCta),
    aboutTitle: stringField(AI_DRAFT_LIMITS.aboutTitle),
    aboutBody: stringField(AI_DRAFT_LIMITS.aboutBody),
    services: {
      type: "array",
      minItems: AI_DRAFT_MIN_SERVICES,
      maxItems: AI_DRAFT_MAX_SERVICES,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "description"],
        properties: {
          title: stringField(AI_DRAFT_LIMITS.serviceTitle),
          description: stringField(AI_DRAFT_LIMITS.serviceDescription),
        },
      },
    },
    contact: {
      type: "object",
      additionalProperties: false,
      required: [
        "title",
        "description",
        "phone",
        "email",
        "location",
        "buttonText",
      ],
      properties: {
        title: stringField(AI_DRAFT_LIMITS.contactTitle),
        description: stringField(AI_DRAFT_LIMITS.contactDescription),
        phone: stringField(AI_DRAFT_LIMITS.contactPhone),
        email: stringField(AI_DRAFT_LIMITS.contactEmail),
        location: stringField(AI_DRAFT_LIMITS.contactLocation),
        buttonText: stringField(AI_DRAFT_LIMITS.contactButtonText),
      },
    },
    seo: {
      type: "object",
      additionalProperties: false,
      required: [
        "siteTitle",
        "metaDescription",
        "socialTitle",
        "socialDescription",
        "robotsIndex",
      ],
      properties: {
        siteTitle: stringField(AI_DRAFT_LIMITS.seoTitle),
        metaDescription: stringField(AI_DRAFT_LIMITS.seoDescription),
        socialTitle: stringField(AI_DRAFT_LIMITS.socialTitle),
        socialDescription: stringField(AI_DRAFT_LIMITS.socialDescription),
        robotsIndex: { type: "boolean" },
      },
    },
    enabledSections: {
      type: "array",
      items: {
        type: "string",
        enum: [...AI_OPTIONAL_SECTION_IDS],
      },
    },
  },
} as const;
