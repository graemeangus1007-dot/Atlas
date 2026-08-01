import { Suspense } from "react";
import WebsiteEditor from "@/components/editor/website-editor";

/**
 * /editor — inline website editing experience.
 */
export default function EditorPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen flex-1 items-center justify-center bg-background text-sm text-muted">
          Opening editor…
        </div>
      }
    >
      <WebsiteEditor />
    </Suspense>
  );
}
