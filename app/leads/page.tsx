import { Suspense } from "react";
import LeadsPage from "@/components/leads/leads-page";

export default function LeadsRoutePage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-6xl px-4 py-8 text-sm text-muted sm:px-6">
          Loading leads…
        </div>
      }
    >
      <LeadsPage />
    </Suspense>
  );
}
