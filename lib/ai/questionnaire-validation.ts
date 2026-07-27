import {
  AI_BRAND_TONES,
  type AiQuestionnaireAnswers,
  type AiQuestionnaireFieldErrors,
  type AiQuestionnaireStepId,
} from "@/components/ai/ai-types";

function required(value: string, label: string): string | undefined {
  if (!value.trim()) return `${label} is required.`;
  return undefined;
}

function isValidEmail(value: string): boolean {
  const v = value.trim();
  if (!v) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

function isHexColor(value: string): boolean {
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value.trim());
}

/** Validate a single wizard step. Returns field errors (empty = valid). */
export function validateAiQuestionnaireStep(
  step: AiQuestionnaireStepId,
  answers: AiQuestionnaireAnswers,
): AiQuestionnaireFieldErrors {
  const errors: AiQuestionnaireFieldErrors = {};

  switch (step) {
    case "business": {
      const name = required(answers.businessName, "Business name");
      if (name) errors.businessName = name;
      const industry = required(answers.industry, "Industry");
      if (industry) errors.industry = industry;
      const desc = required(
        answers.oneSentenceDescription,
        "One-sentence description",
      );
      if (desc) errors.oneSentenceDescription = desc;
      const years = required(answers.yearsInBusiness, "Years in business");
      if (years) errors.yearsInBusiness = years;
      break;
    }
    case "services": {
      const primary = required(answers.primaryServices, "Primary services");
      if (primary) errors.primaryServices = primary;
      const customer = required(answers.targetCustomer, "Target customer");
      if (customer) errors.targetCustomer = customer;
      const area = required(answers.serviceArea, "Service area");
      if (area) errors.serviceArea = area;
      break;
    }
    case "branding": {
      if (!answers.tone || !AI_BRAND_TONES.includes(answers.tone)) {
        errors.tone = "Choose a brand tone.";
      }
      if (!isHexColor(answers.primaryColor)) {
        errors.primaryColor = "Enter a valid hex color (e.g. #3db8a8).";
      }
      if (!isHexColor(answers.accentColor)) {
        errors.accentColor = "Enter a valid hex color (e.g. #0e1218).";
      }
      break;
    }
    case "contact": {
      const phone = required(answers.phone, "Phone");
      if (phone) errors.phone = phone;
      const emailEmpty = required(answers.email, "Email");
      if (emailEmpty) errors.email = emailEmpty;
      else if (!isValidEmail(answers.email)) {
        errors.email = "Enter a valid email address.";
      }
      const address = required(answers.address, "Address");
      if (address) errors.address = address;
      break;
    }
    case "review":
      break;
  }

  return errors;
}

export function isAiQuestionnaireStepValid(
  step: AiQuestionnaireStepId,
  answers: AiQuestionnaireAnswers,
): boolean {
  return Object.keys(validateAiQuestionnaireStep(step, answers)).length === 0;
}

/** All required steps valid (for Generate). */
export function isAiQuestionnaireComplete(
  answers: AiQuestionnaireAnswers,
): boolean {
  return (
    isAiQuestionnaireStepValid("business", answers) &&
    isAiQuestionnaireStepValid("services", answers) &&
    isAiQuestionnaireStepValid("branding", answers) &&
    isAiQuestionnaireStepValid("contact", answers)
  );
}

export function splitServiceLines(value: string): string[] {
  return value
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 12);
}
