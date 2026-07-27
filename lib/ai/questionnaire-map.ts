/**
 * Map questionnaire answers → generate API input (Sprint 20.0B).
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
  const questionnaire: GenerateWebsiteQuestionnaire = {
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
  };

  return {
    projectId: projectId.trim(),
    businessName: answers.businessName.trim(),
    businessType: answers.industry.trim(),
    description: answers.oneSentenceDescription.trim(),
    goals: [
      answers.targetCustomer.trim(),
      answers.serviceArea.trim(),
    ].filter(Boolean),
    questionnaire,
  };
}
