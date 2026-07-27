import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  getSupabaseEnv,
  isSupabaseConfigured,
  type Database,
} from "@/lib/supabase/types";

/**
 * Routes that require a signed-in session (Sprint 14.2C).
 * Unauthenticated visitors are sent to /login.
 */
export const PROTECTED_PREFIXES = [
  "/dashboard",
  "/editor",
  "/projects",
  "/leads",
  "/profile",
] as const;

/**
 * Auth pages signed-in users must not see again until they log out.
 */
export const AUTH_ROUTES = ["/login", "/signup"] as const;

function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function isAuthRoute(pathname: string): boolean {
  return AUTH_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
}

/**
 * Next.js middleware auth gate.
 *
 * - Unauthenticated → protected routes redirect to /login
 * - Authenticated → /login and /signup redirect to /dashboard
 * Also refreshes the Supabase session cookie.
 */
export async function updateAuthSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  if (!isSupabaseConfigured()) {
    return response;
  }

  try {
    const { url, publishableKey } = getSupabaseEnv();

    const supabase = createServerClient<Database>(url, publishableKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    });

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { pathname } = request.nextUrl;

    if (!user && isProtectedPath(pathname)) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/login";
      redirectUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(redirectUrl);
    }

    if (user && isAuthRoute(pathname)) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/dashboard";
      redirectUrl.search = "";
      return NextResponse.redirect(redirectUrl);
    }
  } catch (error) {
    console.error("[auth middleware]", error);
  }

  return response;
}
