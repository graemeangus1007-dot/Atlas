/**
 * Map questionnaire answers → generate API input (Sprint 20.0B).
 * Explicit questionnaire fields are always sent (top-level + nested) so the
 * API/mock never fall back to the context project's placeholder name.
 */

import type { AiQuestionnaireAnswers } from "@/components/ai/ai-types";
import { splitServiceLines } from "@/lib/ai/questionnaire-validation";
import type {
  GenerateWebsiteInput,
  GenerateWebsiteQuestionnaire,
} from "@/lib/ai/types";

export function questionnaireToGenerateInput(
  projectId: string,
  answers: AiQuestionnaireAnswers,
): GenerateWebsiteInput {
  const businessName = answers.businessName.trim();
  const businessType = answers.industry.trim();
  const description = answers.oneSentenceDescription.trim();

  const questionnaire: GenerateWebsiteQuestionnaire = {
    businessName: businessName || undefined,
    businessType: businessType || undefined,
    description: description || undefined,
    yearsInBusiness: answers.yearsInBusiness.trim() || undefined,
    primaryServices: splitServiceLines(answers.primaryServices),
    secondaryServices: splitServiceLines(answers.secondaryServices),
    targetCustomer: answers.targetCustomer.trim() || undefined,
    serviceArea: answers.serviceArea.trim() || undefined,
    tone: answers.tone || undefined,
    primaryColor: answers.primaryColor.trim() || undefined,
    accentColor: answers.accentColor.trim() || undefined,
    phone: answers.phone.trim() || undefined,
    email: answers.email.trim() || undefined,
    address: answers.address.trim() || undefined,
    website: answers.website.trim() || undefined,
    facebook: answers.facebook.trim() || undefined,
    instagram: answers.instagram.trim() || undefined,
    optionalSections: { ...answers.optionalSections },
  };

  return {
    projectId: projectId.trim(),
    businessName,
    businessType,
    description,
    goals: [
      answers.targetCustomer.trim(),
      answers.serviceArea.trim(),
    ].filter(Boolean),
    questionnaire,
  };
}
