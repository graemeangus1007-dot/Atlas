"use client";

import Button from "@/components/ui/button";

type Props = {
  disabled?: boolean;
  loading?: boolean;
  onGenerate: () => void;
};

/**
 * Primary CTA to start website draft generation.
 */
export default function AiGenerateButton({
  disabled,
  loading,
  onGenerate,
}: Props) {
  return (
    <Button
      type="button"
      onClick={onGenerate}
      disabled={disabled || loading}
      className="w-full px-8 sm:w-auto"
      aria-busy={loading || undefined}
    >
      {loading ? "Generating website…" : "Generate Website"}
    </Button>
  );
}
