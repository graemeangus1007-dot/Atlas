/**
 * Prompt builders for website draft generation (Sprint 20.0A).
 * Used by OpenAI later; mock provider does not call the network.
 */

import type { GenerateWebsiteInput } from "@/lib/ai/types";

export function buildWebsiteSystemPrompt(): string {
  return [
    "You are Atlas, an expert website copywriter for local and service businesses.",
    "Return ONLY valid JSON matching the Atlas website draft schema.",
    "Do not wrap the JSON in markdown fences.",
    "Keep copy concise, professional, and free of placeholder lorem ipsum.",
    "Include: businessName, businessType, description, heroEyebrow, heroHeadline,",
    "heroSubheadline, primaryCta, secondaryCta, aboutTitle, aboutBody, services (3 items),",
    "contact (title, description, phone, email, location, buttonText),",
    "and seo (siteTitle, metaDescription, socialTitle, socialDescription, robotsIndex).",
  ].join(" ");
}

export function buildWebsiteUserPrompt(input: GenerateWebsiteInput): string {
  const goals =
    input.goals && input.goals.length > 0
      ? input.goals.join(", ")
      : "attract customers, build trust, generate inquiries";

  return [
    `Business name: ${input.businessName.trim() || "Untitled business"}`,
    `Business type: ${input.businessType.trim() || "Local business"}`,
    `Description: ${input.description.trim() || "No description provided."}`,
    `Goals: ${goals}`,
    "Write a complete homepage draft for this business.",
  ].join("\n");
}
