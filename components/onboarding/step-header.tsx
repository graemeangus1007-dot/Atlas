import type { ReactNode } from "react";

type StepHeaderProps = {
  title: string;
  description: string;
  children?: ReactNode;
};

/**
 * Consistent heading block used at the top of every onboarding step.
 */
export default function StepHeader({
  title,
  description,
  children,
}: StepHeaderProps) {
  return (
    <div className="mb-8 sm:mb-10">
      <h1 className="font-[family-name:var(--font-atlas-display)] text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
        {title}
      </h1>
      <p className="mt-3 max-w-xl text-base leading-relaxed text-muted sm:text-lg">
        {description}
      </p>
      {children}
    </div>
  );
}
