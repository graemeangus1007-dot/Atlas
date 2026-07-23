import { type NextRequest } from "next/server";
import { updateAuthSession } from "@/lib/auth/middleware";

/**
 * Sprint 14.2C — run auth session refresh + protected route redirects.
 */
export async function middleware(request: NextRequest) {
  return updateAuthSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all paths except static assets and image optimization.
     * Auth logic lives in lib/auth/middleware.ts.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
