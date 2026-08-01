import { redirect } from "next/navigation";

/**
 * Legacy AI Website route — Phase 1 consolidates creation into /onboarding.
 */
export default function AiWebsitePage() {
  redirect("/onboarding");
}
