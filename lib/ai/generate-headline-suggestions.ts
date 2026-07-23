import {
  mockHeadlineSuggestions,
  mockSubheadlineSuggestions,
} from "@/data/ai-mock-suggestions";
import type { GenerateSuggestionsResult } from "@/types/ai";

export type HeadlineSuggestionInput = {
  currentValue: string;
  businessName: string;
  businessType: string;
  variant?: "headline" | "subheadline";
};

/**
 * Mock headline / subheadline suggestions.
 *
 * Future OpenAI hook: replace the body with a chat completion that returns
 * exactly three strings, keeping this function's input/output contract stable.
 */
export async function generateHeadlineSuggestions(
  input: HeadlineSuggestionInput,
): Promise<GenerateSuggestionsResult> {
  await simulateLatency();

  if (input.variant === "subheadline") {
    return {
      suggestions: mockSubheadlineSuggestions(
        input.currentValue,
        input.businessName,
      ),
    };
  }

  return {
    suggestions: mockHeadlineSuggestions(
      input.currentValue,
      input.businessName,
    ),
  };
}

function simulateLatency(): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, 200);
  });
}
