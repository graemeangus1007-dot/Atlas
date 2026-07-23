import { mockAboutSuggestions } from "@/data/ai-mock-suggestions";
import type { GenerateSuggestionsResult } from "@/types/ai";

export type AboutSuggestionInput = {
  currentValue: string;
  businessName: string;
  businessType: string;
};

/**
 * Mock about-section suggestions.
 *
 * Future OpenAI hook: swap the mock factory for a model call that returns
 * three about paragraphs for the same input shape.
 */
export async function generateAboutSuggestions(
  input: AboutSuggestionInput,
): Promise<GenerateSuggestionsResult> {
  await new Promise((resolve) => {
    window.setTimeout(resolve, 280);
  });

  return {
    suggestions: mockAboutSuggestions(input.currentValue, input.businessName),
  };
}
