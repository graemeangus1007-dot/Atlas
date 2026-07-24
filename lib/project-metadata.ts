import { BUSINESS_TYPES, type BusinessType } from "@/types/business";

export type ProjectMetadataFields = {
  name: string;
  businessName: string;
  businessType: string;
  description: string;
};

export type ProjectMetadataErrors = Partial<
  Record<keyof ProjectMetadataFields, string>
>;

export type ProjectMetadataValidation =
  | { ok: true; values: ProjectMetadataFields }
  | { ok: false; errors: ProjectMetadataErrors };

const NAME_MAX = 100;
const DESCRIPTION_MAX = 500;

function isBusinessType(value: string): value is BusinessType {
  return (BUSINESS_TYPES as readonly string[]).includes(value);
}

/**
 * Validate project metadata for the Edit Details modal.
 * Returns trimmed values on success.
 */
export function validateProjectMetadata(
  fields: ProjectMetadataFields,
): ProjectMetadataValidation {
  const errors: ProjectMetadataErrors = {};

  const name = fields.name.trim();
  if (!name) {
    errors.name = "Project name is required.";
  } else if (name.length > NAME_MAX) {
    errors.name = `Project name must be ${NAME_MAX} characters or fewer.`;
  }

  const businessName = fields.businessName.trim();
  if (!businessName) {
    errors.businessName = "Business name is required.";
  } else if (businessName.length > NAME_MAX) {
    errors.businessName = `Business name must be ${NAME_MAX} characters or fewer.`;
  }

  const businessType = fields.businessType.trim();
  if (!businessType) {
    errors.businessType = "Business type is required.";
  } else if (!isBusinessType(businessType)) {
    errors.businessType = "Select a valid business type.";
  }

  const description = fields.description.trim();
  if (description.length > DESCRIPTION_MAX) {
    errors.description = `Description must be ${DESCRIPTION_MAX} characters or fewer.`;
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    values: {
      name,
      businessName,
      businessType,
      description,
    },
  };
}
