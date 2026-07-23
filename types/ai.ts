/** Atlas AI Copywriter domain types — ready for a future OpenAI-backed implementation. */

export type AiContentField =
  | "heroHeadline"
  | "heroSubheadline"
  | "description"
  | "primaryCta"
  | "serviceTitle"
  | "serviceDescription";

export type AiFieldTarget = {
  field: AiContentField;
  label: string;
  originalValue: string;
  /** Required when field is a service title/description. */
  serviceIndex?: number;
};

export type GenerateSuggestionsInput = {
  field: AiContentField;
  currentValue: string;
  businessName: string;
  businessType: string;
  serviceIndex?: number;
};

export type GenerateSuggestionsResult = {
  suggestions: [string, string, string];
};

/** One-step undo payload after applying an AI suggestion. */
export type AiHistoryEntry = {
  field: AiContentField;
  previousValue: string;
  serviceIndex?: number;
};
