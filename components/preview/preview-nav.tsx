"use client";

import { useState } from "react";
import { navHeaderClass, navLinkClass } from "@/lib/templates";
import type { NavStyle } from "@/lib/templates";

type PreviewNavProps = {
  businessName: string;
  navStyle?: NavStyle;
};

const NAV_LINKS = [
  { href: "#home", label: "Home" },
  { href: "#about", label: "About" },
  { href: "#services", label: "Services" },
  { href: "#contact", label: "Contact" },
] as const;

/**
 * Generated-site navigation — style variant from the active template.
 */
export default function PreviewNav({
  businessName,
  navStyle = "standard",
}: PreviewNavProps) {
  const [open, setOpen] = useState(false);
  const linkClass = navLinkClass(navStyle);

  return (
    <header
      className={`sticky top-0 z-40 backdrop-blur-xl ${navHeaderClass(navStyle)}`}
    >
      <nav
        className="site-shell flex h-16 items-center justify-between px-5 sm:px-8"
        aria-label="Website"
      >
        <a
          href="#home"
          className="site-heading site-link atlas-display-text truncate text-lg font-semibold tracking-tight text-[color:var(--site-primary)]"
        >
          {businessName}
        </a>

        <ul
          className={`hidden items-center md:flex ${
            navStyle === "pill" ? "gap-2" : "gap-7"
          }`}
        >
          {NAV_LINKS.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                className={`${linkClass} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--site-accent)]`}
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>

        <button
          type="button"
          className="site-button inline-flex h-10 w-10 items-center justify-center border border-border transition-colors hover:bg-[color:var(--site-accent-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--site-accent)] md:hidden"
          aria-expanded={open}
          aria-label="Toggle menu"
          onClick={() => setOpen((value) => !value)}
        >
          <span className="sr-only">Menu</span>
          <span aria-hidden="true">☰</span>
        </button>
      </nav>

      {open ? (
        <ul className="site-shell border-t border-border px-5 py-3 md:hidden">
          {NAV_LINKS.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                className="site-link block rounded-lg px-2 py-3 text-sm text-muted hover:bg-[color:var(--site-accent-soft)]"
                onClick={() => setOpen(false)}
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>
      ) : null}
    </header>
  );
}
