import { redirect } from "next/navigation";

/**
 * Legacy simulated generation route — Phase 1 redirects to New Site.
 */
export default function GeneratingPage() {
  redirect("/onboarding");
}
