import type { TextareaHTMLAttributes } from "react";

type TextAreaProps = Omit<
  TextareaHTMLAttributes<HTMLTextAreaElement>,
  "className" | "id"
> & {
  id: string;
  label: string;
  hint?: string;
  className?: string;
};

/**
 * Accessible multiline text field for product flows.
 */
export default function TextArea({
  id,
  label,
  hint,
  className = "",
  ...props
}: TextAreaProps) {
  return (
    <div className={`w-full ${className}`}>
      <label
        htmlFor={id}
        className="mb-3 block text-sm font-medium text-muted"
      >
        {label}
      </label>
      <textarea
        id={id}
        className="min-h-36 w-full resize-y rounded-2xl border border-border bg-surface px-5 py-4 text-base leading-relaxed text-foreground outline-none transition-all duration-200 placeholder:text-muted/60 focus:border-accent focus:ring-2 focus:ring-accent/25 sm:min-h-44 sm:text-lg"
        {...props}
      />
      {hint ? <p className="mt-2 text-sm text-muted">{hint}</p> : null}
    </div>
  );
}
