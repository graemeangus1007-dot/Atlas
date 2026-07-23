import { type NextRequest } from "next/server";
import { updateAuthSession } from "@/lib/auth/middleware";

/**
 * @deprecated Prefer updateAuthSession from `@/lib/auth`.
 * Kept for any older imports of the Supabase middleware helper.
 */
export async function updateSession(request: NextRequest) {
  return updateAuthSession(request);
}
