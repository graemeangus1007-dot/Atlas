"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Button from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { NEW_SITE_HREF, NEW_SITE_LABEL } from "@/lib/product/new-site";

const MARKETING_LINKS = [
  { href: "#features", label: "Features" },
  { href: "#pricing", label: "Pricing" },
  { href: "#about", label: "About" },
  { href: "#contact", label: "Contact" },
] as const;

const NAV_LINK_CLASS =
  "rounded-md text-sm text-muted transition-colors duration-200 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background";

/**
 * Sticky marketing / app navigation — auth-aware links.
 */
export default function Navbar() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const { user, signOutUser, isLoading } = useAuth();

  async function handleLogout() {
    setSigningOut(true);
    try {
      await signOutUser();
      setIsOpen(false);
      router.replace("/");
      router.refresh();
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/75 backdrop-blur-xl">
      <nav
        className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8"
        aria-label="Primary"
      >
        <Link
          href="/"
          className="rounded-md font-[family-name:var(--font-atlas-display)] text-xl font-semibold tracking-tight text-foreground transition-colors hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          Atlas
        </Link>

        <ul className="hidden items-center gap-8 md:flex">
          {user ? (
            <>
              <li>
                <Link href="/projects" className={NAV_LINK_CLASS}>
                  Projects
                </Link>
              </li>
              <li>
                <Link href="/profile" className={NAV_LINK_CLASS}>
                  Profile
                </Link>
              </li>
            </>
          ) : (
            MARKETING_LINKS.map((link) => (
              <li key={link.href}>
                <a href={link.href} className={NAV_LINK_CLASS}>
                  {link.label}
                </a>
              </li>
            ))
          )}
        </ul>

        <div className="hidden items-center gap-3 md:flex">
          {isLoading ? null : user ? (
            <>
              <Button href={NEW_SITE_HREF} className="px-5 py-2.5">
                {NEW_SITE_LABEL}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="px-4 py-2.5"
                disabled={signingOut}
                onClick={() => void handleLogout()}
              >
                {signingOut ? "Logging out…" : "Logout"}
              </Button>
            </>
          ) : (
            <>
              <Button href="/login" variant="ghost" className="px-4 py-2.5">
                Login
              </Button>
              <Button href={NEW_SITE_HREF} className="px-5 py-2.5">
                {NEW_SITE_LABEL}
              </Button>
            </>
          )}
        </div>

        <button
          type="button"
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border text-foreground transition-colors hover:bg-white/[0.03] md:hidden"
          aria-expanded={isOpen}
          aria-controls="mobile-nav"
          onClick={() => setIsOpen((open) => !open)}
        >
          <span className="sr-only">{isOpen ? "Close menu" : "Open menu"}</span>
          <span className="flex flex-col gap-1.5" aria-hidden="true">
            <span
              className={`block h-0.5 w-5 origin-center bg-current transition-transform duration-200 ${
                isOpen ? "translate-y-2 rotate-45" : ""
              }`}
            />
            <span
              className={`block h-0.5 w-5 bg-current transition-opacity duration-200 ${
                isOpen ? "opacity-0" : ""
              }`}
            />
            <span
              className={`block h-0.5 w-5 origin-center bg-current transition-transform duration-200 ${
                isOpen ? "-translate-y-2 -rotate-45" : ""
              }`}
            />
          </span>
        </button>
      </nav>

      <div
        id="mobile-nav"
        className={`border-b border-border bg-surface/95 backdrop-blur-xl md:hidden ${
          isOpen ? "block" : "hidden"
        }`}
      >
        <ul className="mx-auto flex max-w-6xl flex-col gap-1 px-5 py-4 sm:px-8">
          {user ? (
            <>
              {[
                { href: "/projects", label: "Projects" },
                { href: "/profile", label: "Profile" },
              ].map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="block rounded-xl px-3 py-3 text-sm text-muted transition-colors hover:bg-accent-soft hover:text-foreground"
                    onClick={() => setIsOpen(false)}
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
              <li className="pt-2">
                <Button
                  href={NEW_SITE_HREF}
                  className="w-full"
                  onClick={() => setIsOpen(false)}
                >
                  {NEW_SITE_LABEL}
                </Button>
              </li>
              <li className="pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full"
                  disabled={signingOut}
                  onClick={() => void handleLogout()}
                >
                  {signingOut ? "Logging out…" : "Logout"}
                </Button>
              </li>
            </>
          ) : (
            <>
              {MARKETING_LINKS.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    className="block rounded-xl px-3 py-3 text-sm text-muted transition-colors hover:bg-accent-soft hover:text-foreground"
                    onClick={() => setIsOpen(false)}
                  >
                    {link.label}
                  </a>
                </li>
              ))}
              <li>
                <Link
                  href="/login"
                  className="block rounded-xl px-3 py-3 text-sm text-muted transition-colors hover:bg-accent-soft hover:text-foreground"
                  onClick={() => setIsOpen(false)}
                >
                  Login
                </Link>
              </li>
              <li className="pt-2">
                <Button
                  href={NEW_SITE_HREF}
                  className="w-full"
                  onClick={() => setIsOpen(false)}
                >
                  {NEW_SITE_LABEL}
                </Button>
              </li>
            </>
          )}
        </ul>
      </div>
    </header>
  );
}
