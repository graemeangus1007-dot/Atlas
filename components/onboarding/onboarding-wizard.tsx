"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import BusinessDescriptionStep from "@/components/onboarding/business-description-step";
import BusinessNameStep from "@/components/onboarding/business-name-step";
import BusinessTypeStep from "@/components/onboarding/business-type-step";
import ChooseStyleStep from "@/components/onboarding/choose-style-step";
import ReviewStep from "@/components/onboarding/review-step";
import WebsiteGoalsStep from "@/components/onboarding/website-goals-step";
import {
  INITIAL_ONBOARDING_DATA,
  STEP_LABELS,
  TOTAL_ONBOARDING_STEPS,
  type BusinessType,
  type OnboardingData,
  type WebsiteGoal,
} from "@/components/onboarding/types";
import ProgressIndicator from "@/components/ui/progress-indicator";
import { useProject } from "@/context/project-context";
import { projectFromOnboarding } from "@/lib/project";
import type { TemplateId } from "@/lib/templates";
import "@/lib/templates";

/**
 * Multi-step onboarding wizard.
 * Local form state during the wizard; commits into BusinessProject Context on generate.
 */
export default function OnboardingWizard() {
  const router = useRouter();
  const { project, setProject, createProject, projectId } = useProject();
  const [currentStep, setCurrentStep] = useState(1);
  const [data, setData] = useState<OnboardingData>(INITIAL_ONBOARDING_DATA);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  function goNext() {
    setCurrentStep((step) => Math.min(step + 1, TOTAL_ONBOARDING_STEPS));
  }

  function goBack() {
    setCurrentStep((step) => Math.max(step - 1, 1));
  }

  async function handleGenerate() {
    setSubmitError(null);
    setIsSubmitting(true);

    const nextProject = projectFromOnboarding(
      {
        ...data,
        businessName: data.businessName.trim(),
        description: data.description.trim(),
      },
      project,
    );

    try {
      if (projectId) {
        setProject({ ...nextProject, status: "generating" });
      } else {
        await createProject(nextProject.businessName, {
          ...nextProject,
          status: "generating",
        });
      }
      router.push("/generating");
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Could not save your project.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  function updateField<K extends keyof OnboardingData>(
    key: K,
    value: OnboardingData[K],
  ) {
    setData((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <div className="relative flex min-h-full flex-1 flex-col">
      <div
        className="pointer-events-none absolute inset-0 -z-10"
        aria-hidden="true"
      >
        <div className="absolute left-1/2 top-0 h-[420px] w-[720px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(61,184,168,0.12)_0%,transparent_65%)] blur-2xl" />
      </div>

      <header className="border-b border-border/80 px-5 py-5 sm:px-8">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
          <div className="flex items-center justify-between">
            <Link
              href="/"
              className="rounded-md font-[family-name:var(--font-atlas-display)] text-lg font-semibold tracking-tight text-foreground transition-colors hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background active:text-accent-hover"
            >
              Atlas
            </Link>
            <span className="text-sm text-muted">Create your website</span>
          </div>
          <ProgressIndicator
            currentStep={currentStep}
            totalSteps={TOTAL_ONBOARDING_STEPS}
            label={`Step ${currentStep} of ${TOTAL_ONBOARDING_STEPS} — ${STEP_LABELS[currentStep - 1]}`}
          />
        </div>
      </header>

      <main className="flex flex-1 flex-col px-5 py-10 sm:px-8 sm:py-14">
        <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center">
          <div key={currentStep} className="animate-step-in">
            {currentStep === 1 ? (
              <BusinessNameStep
                value={data.businessName}
                onChange={(value) => updateField("businessName", value)}
                onNext={() => {
                  updateField("businessName", data.businessName.trim());
                  goNext();
                }}
              />
            ) : null}

            {currentStep === 2 ? (
              <BusinessTypeStep
                value={data.businessType}
                onChange={(value: BusinessType) =>
                  updateField("businessType", value)
                }
                onBack={goBack}
                onNext={goNext}
              />
            ) : null}

            {currentStep === 3 ? (
              <BusinessDescriptionStep
                value={data.description}
                onChange={(value) => updateField("description", value)}
                onBack={goBack}
                onNext={() => {
                  updateField("description", data.description.trim());
                  goNext();
                }}
              />
            ) : null}

            {currentStep === 4 ? (
              <WebsiteGoalsStep
                values={data.goals}
                onChange={(values: WebsiteGoal[]) =>
                  updateField("goals", values)
                }
                onBack={goBack}
                onNext={goNext}
              />
            ) : null}

            {currentStep === 5 ? (
              <ChooseStyleStep
                value={data.templateId}
                onChange={(value: TemplateId) =>
                  updateField("templateId", value)
                }
                onBack={goBack}
                onNext={goNext}
              />
            ) : null}

            {currentStep === 6 ? (
              <ReviewStep
                data={data}
                onBack={goBack}
                onGenerate={() => void handleGenerate()}
                isSubmitting={isSubmitting}
                error={submitError}
              />
            ) : null}
          </div>
        </div>
      </main>
    </div>
  );
}
