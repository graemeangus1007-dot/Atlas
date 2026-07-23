"use client";

import EditableText from "@/components/editor/editable-text";

type EditableGalleryTitleProps = {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  "aria-label"?: string;
};

/**
 * Reusable click-to-edit gallery title.
 * Enter or blur saves; Escape cancels (via EditableText).
 */
export default function EditableGalleryTitle({
  value,
  onChange,
  className = "",
  "aria-label": ariaLabel = "Gallery image title",
}: EditableGalleryTitleProps) {
  return (
    <EditableText
      as="p"
      value={value}
      onChange={onChange}
      aria-label={ariaLabel}
      placeholder="Add a title"
      className={`text-sm font-medium text-foreground ${className}`}
      inputClassName="text-sm font-medium"
    />
  );
}
