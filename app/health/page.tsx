import { redirect } from "next/navigation";

/**
 * Public health page removed from product surface (Phase 1).
 */
export default function HealthPage() {
  redirect("/");
}
