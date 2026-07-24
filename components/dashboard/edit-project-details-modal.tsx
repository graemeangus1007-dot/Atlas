"use client";

import {
  useEffect,
  useId,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import Button from "@/components/ui/button";
import {
  validateProjectMetadata,
  type ProjectMetadataErrors,
  type ProjectMetadataFields,
} from "@/lib/project-metadata";
import { BUSINESS_TYPES } from "@/types/business";
import type { ProjectListItem } from "@/lib/supabase/types";

type EditProjectDetailsModalProps = {
  project: ProjectListItem | null;
  open: boolean;
  onClose: () => void;
  onSave: (details: ProjectMetadataFields) => Promise<void>;
};

const EMPTY_FIELDS: ProjectMetadataFields = {
  name: "",
  businessName: "",
  businessType: "",
  description: "",
};

/**
 * Edit project metadata (name, business info). Presentation only —
 * persistence is handled by the caller via the projects data layer.
 */
export default function EditProjectDetailsModal({
  project,
  open,
  onClose,
  onSave,
}: EditProjectDetailsModalProps) {
  const titleId = useId();
  const [fields, setFields] = useState<ProjectMetadataFields>(EMPTY_FIELDS);
  const [errors, setErrors] = useState<ProjectMetadataErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!open || !project) return;
    setFields({
      name: project.name,
      businessName: project.businessName,
      businessType: project.businessType || "",
      description: project.description || "",
    });
    setErrors({});
    setSubmitError(null);
    setIsSaving(false);
  }, [open, project]);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !isSaving) {
        onClose();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, isSaving, onClose]);

  if (!open || !project) return null;

  function updateField<K extends keyof ProjectMetadataFields>(
    key: K,
    value: ProjectMetadataFields[K],
  ) {
    setFields((current) => ({ ...current, [key]: value }));
    setErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
    setSubmitError(null);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const validation = validateProjectMetadata(fields);
    if (!validation.ok) {
      setErrors(validation.errors);
      return;
    }

    setIsSaving(true);
    setSubmitError(null);
    try {
      await onSave(validation.values);
      // Parent closes the modal on success; keep Saving... until unmount.
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Could not save project details.",
      );
      setIsSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isSaving) {
          onClose();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-lg rounded-2xl border border-border bg-background p-5 shadow-2xl sm:p-6"
      >
        <div className="mb-5">
          <h2
            id={titleId}
            className="font-[family-name:var(--font-atlas-display)] text-xl font-semibold tracking-tight text-foreground"
          >
            Edit Details
          </h2>
          <p className="mt-1 text-sm text-muted">
            Update project and business information. Website content and design
            stay unchanged.
          </p>
        </div>

        <form onSubmit={(event) => void handleSubmit(event)} className="space-y-4">
          <Field
            label="Project Name"
            htmlFor="project-name"
            error={errors.name}
            disabled={isSaving}
          >
            <input
              id="project-name"
              value={fields.name}
              maxLength={100}
              disabled={isSaving}
              onChange={(event) => updateField("name", event.target.value)}
              className={inputClass(Boolean(errors.name))}
              autoComplete="off"
            />
          </Field>

          <Field
            label="Business Name"
            htmlFor="business-name"
            error={errors.businessName}
            disabled={isSaving}
          >
            <input
              id="business-name"
              value={fields.businessName}
              maxLength={100}
              disabled={isSaving}
              onChange={(event) =>
                updateField("businessName", event.target.value)
              }
              className={inputClass(Boolean(errors.businessName))}
              autoComplete="organization"
            />
          </Field>

          <Field
            label="Business Type"
            htmlFor="business-type"
            error={errors.businessType}
            disabled={isSaving}
          >
            <select
              id="business-type"
              value={fields.businessType}
              disabled={isSaving}
              onChange={(event) =>
                updateField("businessType", event.target.value)
              }
              className={inputClass(Boolean(errors.businessType))}
            >
              <option value="">Select a type</option>
              {BUSINESS_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </Field>

          <Field
            label="Short Description"
            htmlFor="description"
            error={errors.description}
            disabled={isSaving}
            optional
          >
            <textarea
              id="description"
              value={fields.description}
              maxLength={500}
              rows={4}
              disabled={isSaving}
              onChange={(event) =>
                updateField("description", event.target.value)
              }
              className={`${inputClass(Boolean(errors.description))} resize-y`}
            />
            <p className="mt-1 text-xs text-muted">
              {fields.description.length}/500
            </p>
          </Field>

          {submitError ? (
            <p className="text-sm text-red-400" role="alert">
              {submitError}
            </p>
          ) : null}

          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="secondary"
              className="px-4 py-2 text-sm"
              disabled={isSaving}
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="px-4 py-2 text-sm"
              disabled={isSaving}
            >
              {isSaving ? "Saving..." : "Save"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function inputClass(hasError: boolean): string {
  return [
    "mt-1.5 w-full rounded-xl border bg-background px-3 py-2.5 text-sm text-foreground outline-none transition-colors",
    "focus:border-accent focus:ring-2 focus:ring-accent/20",
    "disabled:cursor-not-allowed disabled:opacity-60",
    hasError ? "border-red-400/70" : "border-border",
  ].join(" ");
}

function Field({
  label,
  htmlFor,
  error,
  disabled,
  optional,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  disabled?: boolean;
  optional?: boolean;
  children: ReactNode;
}) {
  return (
    <div aria-disabled={disabled || undefined}>
      <label
        htmlFor={htmlFor}
        className="text-xs font-medium uppercase tracking-wide text-muted"
      >
        {label}
        {optional ? (
          <span className="ml-1 normal-case tracking-normal text-muted/70">
            (optional)
          </span>
        ) : null}
      </label>
      {children}
      {error ? (
        <p className="mt-1 text-xs text-red-400" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
