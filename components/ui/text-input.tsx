import type { InputHTMLAttributes } from "react";

type TextInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "className" | "id"
> & {
  id: string;
  label: string;
  hint?: string;
  className?: string;
};

/**
 * Large, accessible text field for product flows (onboarding, settings).
 * Label is visually associated via htmlFor; optional hint sits below.
 */
export default function TextInput({
  id,
  label,
  hint,
  className = "",
  ...props
}: TextInputProps) {
  return (
    <div className={`w-full ${className}`}>
      <label
        htmlFor={id}
        className="mb-3 block text-sm font-medium text-muted"
      >
        {label}
      </label>
      <input
        id={id}
        className="w-full rounded-2xl border border-border bg-surface px-5 py-4 text-lg text-foreground outline-none transition-all duration-200 placeholder:text-muted/60 focus:border-accent focus:ring-2 focus:ring-accent/25"
        {...props}
      />
      {hint ? <p className="mt-2 text-sm text-muted">{hint}</p> : null}
    </div>
  );
}
