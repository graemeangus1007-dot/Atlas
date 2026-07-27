"use client";

import Button from "@/components/ui/button";

type Props = {
  disabled?: boolean;
  loading?: boolean;
  onCreate: () => void;
};

/**
 * Primary CTA to materialize the AI draft as an editable Atlas project.
 */
export default function AiCreateWebsiteButton({
  disabled,
  loading,
  onCreate,
}: Props) {
  return (
    <Button
      type="button"
      onClick={onCreate}
      disabled={disabled || loading}
      className="w-full px-8 sm:w-auto"
      aria-busy={loading || undefined}
    >
      {loading ? "Creating website…" : "Create Website in Editor"}
    </Button>
  );
}
