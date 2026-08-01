import { redirect } from "next/navigation";

/**
 * System health removed from product nav (Phase 1).
 * Ops can still use /api/system/health.
 */
export default function SystemPage() {
  redirect("/projects");
}
