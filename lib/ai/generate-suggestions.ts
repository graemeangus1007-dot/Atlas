import { generateAboutSuggestions } from "@/lib/ai/generate-about-suggestions";
import { generateHeadlineSuggestions } from "@/lib/ai/generate-headline-suggestions";
import { generateServiceSuggestions } from "@/lib/ai/generate-service-suggestions";
import { mockCtaSuggestions } from "@/data/ai-mock-suggestions";
import type {
  GenerateSuggestionsInput,
  GenerateSuggestionsResult,
} from "@/types/ai";

/**
 * Unified AI Copywriter entry point used by the editor panel.
 *
 * Routes each field to a dedicated generator. UI should only call this
 * function (or the field-specific generators) — never hardcode suggestions.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * FUTURE OPENAI INTEGRATION
 * Replace the mock implementations inside:
 *   - generateHeadlineSuggestions
 *   - generateAboutSuggestions
 *   - generateServiceSuggestions
 *   - (CTA branch below)
 * with OpenAI (or another LLM) calls. Keep `GenerateSuggestionsInput` /
 * `GenerateSuggestionsResult` unchanged so `AiAssistantPanel` stays the same.
 * ─────────────────────────────────────────────────────────────────────────
 */
export async function generateSuggestions(
  input: GenerateSuggestionsInput,
): Promise<GenerateSuggestionsResult> {
  switch (input.field) {
    case "heroHeadline":
      return generateHeadlineSuggestions({
        currentValue: input.currentValue,
        businessName: input.businessName,
        businessType: input.businessType,
        variant: "headline",
      });
    case "heroSubheadline":
      return generateHeadlineSuggestions({
        currentValue: input.currentValue,
        businessName: input.businessName,
        businessType: input.businessType,
        variant: "subheadline",
      });
    case "description":
      return generateAboutSuggestions({
        currentValue: input.currentValue,
        businessName: input.businessName,
        businessType: input.businessType,
      });
    case "serviceTitle":
      return generateServiceSuggestions({
        currentValue: input.currentValue,
        businessName: input.businessName,
        businessType: input.businessType,
        variant: "title",
        serviceIndex: input.serviceIndex,
      });
    case "serviceDescription":
      return generateServiceSuggestions({
        currentValue: input.currentValue,
        businessName: input.businessName,
        businessType: input.businessType,
        variant: "description",
        serviceIndex: input.serviceIndex,
      });
    case "primaryCta": {
      await new Promise((resolve) => {
        window.setTimeout(resolve, 220);
      });
      return { suggestions: mockCtaSuggestions() };
    }
    default: {
      const _exhaustive: never = input.field;
      return _exhaustive;
    }
  }
}
