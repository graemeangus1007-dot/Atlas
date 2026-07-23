import {
  mockServiceDescriptionSuggestions,
  mockServiceTitleSuggestions,
} from "@/data/ai-mock-suggestions";
import type { GenerateSuggestionsResult } from "@/types/ai";

export type ServiceSuggestionInput = {
  currentValue: string;
  businessName: string;
  businessType: string;
  variant: "title" | "description";
  serviceIndex?: number;
};

/**
 * Mock service title / description suggestions.
 *
 * Future OpenAI hook: request three service copy variants using business type
 * + current value; keep returning `GenerateSuggestionsResult`.
 */
export async function generateServiceSuggestions(
  input: ServiceSuggestionInput,
): Promise<GenerateSuggestionsResult> {
  await new Promise((resolve) => {
    window.setTimeout(resolve, 280);
  });

  if (input.variant === "description") {
    return {
      suggestions: mockServiceDescriptionSuggestions(
        input.currentValue,
        input.businessName,
      ),
    };
  }

  return {
    suggestions: mockServiceTitleSuggestions(
      input.currentValue,
      input.businessName,
    ),
  };
}
