import Link from "next/link";

const FOOTER_LINKS = [
  { href: "#privacy", label: "Privacy" },
  { href: "#terms", label: "Terms" },
  { href: "#contact", label: "Contact" },
] as const;

const FOOTER_LINK_CLASS =
  "rounded-md text-sm text-muted transition-colors duration-200 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background active:text-accent";

/**
 * Site footer — brand, copyright, and legal / contact links.
 * id="contact" is the scroll target for the nav Contact link.
 */
export default function Footer() {
  return (
    <footer
      id="contact"
      className="scroll-mt-20 border-t border-border px-5 py-10 sm:px-8"
    >
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 sm:flex-row">
        {/* Brand → home */}
        <div className="flex flex-col items-center gap-1 sm:items-start">
          <Link
            href="/"
            className="rounded-md font-[family-name:var(--font-atlas-display)] text-lg font-semibold tracking-tight text-foreground transition-colors hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background active:text-accent-hover"
          >
            Atlas
          </Link>
          <p className="text-sm text-muted">© 2026 Atlas</p>
        </div>

        {/* Legal / contact */}
        <ul className="flex flex-wrap items-center justify-center gap-6">
          {FOOTER_LINKS.map((link) => (
            <li key={link.href}>
              <a href={link.href} className={FOOTER_LINK_CLASS}>
                {link.label}
              </a>
            </li>
          ))}
        </ul>
      </div>

      {/* Lightweight contact placeholder content for the #contact target */}
      <div className="mx-auto mt-8 max-w-6xl border-t border-border pt-8 text-center sm:text-left">
        <h2 className="font-[family-name:var(--font-atlas-display)] text-lg font-semibold text-foreground">
          Contact
        </h2>
        <p className="mt-2 text-sm text-muted">
          Reach us at hello@atlas.app — a full contact form is coming soon.
        </p>
      </div>
    </footer>
  );
}
