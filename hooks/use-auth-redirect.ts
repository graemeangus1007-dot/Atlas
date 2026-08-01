"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/auth-provider";
import { DEFAULT_SIGNED_IN_HREF } from "@/lib/product/new-site";

const AUTH_PATHS = ["/login", "/signup"];
const PROTECTED_PATHS = [
  "/dashboard",
  "/editor",
  "/projects",
  "/onboarding",
  "/leads",
  "/profile",
];

/**
 * Client-side auth redirects (complements Next.js middleware).
 * - Signed out on protected routes → /login?next=…
 * - Signed in on /login or /signup → Projects (or `next` when present)
 */
export function useAuthRedirect() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (isLoading) return;

    const onAuthPage = AUTH_PATHS.some(
      (path) => pathname === path || pathname.startsWith(`${path}/`),
    );
    const onProtected = PROTECTED_PATHS.some(
      (path) => pathname === path || pathname.startsWith(`${path}/`),
    );

    if (user && onAuthPage) {
      router.replace(DEFAULT_SIGNED_IN_HREF);
      return;
    }

    if (!user && onProtected) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [user, isLoading, pathname, router]);
}

/**
 * Convenience: true when a session user is present.
 */
export function useIsAuthenticated() {
  const { user, isLoading } = useAuth();
  return {
    isAuthenticated: Boolean(user),
    isLoading,
    user,
  };
}
