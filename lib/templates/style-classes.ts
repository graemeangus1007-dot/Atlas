import type {
  CardStyle,
  GalleryLayout,
  HeroLayout,
  NavStyle,
} from "@/lib/templates/types";

/** Tailwind helpers derived from template configuration. */

export function cardStyleClass(style: CardStyle): string {
  switch (style) {
    case "elevated":
      return "border-border bg-surface/70 shadow-[0_18px_50px_-28px_rgba(0,0,0,0.75)]";
    case "flat":
      return "border-transparent bg-surface/35";
    case "bordered":
      return "border-2 border-[color:var(--site-primary)]/50 bg-transparent";
    case "glass":
      return "border-white/10 bg-surface/30 backdrop-blur-md";
    default:
      return "border-border bg-surface/60";
  }
}

export function galleryGridClass(layout: GalleryLayout): string {
  switch (layout) {
    case "grid-3":
      return "grid gap-4 sm:grid-cols-3";
    case "masonry":
      return "grid gap-4 sm:grid-cols-2 sm:auto-rows-[12rem]";
    case "wide":
      return "grid gap-3 sm:grid-cols-4";
    case "grid-2":
    default:
      return "grid gap-4 sm:grid-cols-2";
  }
}

export function heroSectionClass(layout: HeroLayout): string {
  switch (layout) {
    case "split":
      return "px-5 py-20 sm:px-8 sm:py-28";
    case "minimal":
      return "px-5 py-16 sm:px-8 sm:py-20";
    case "bold-overlay":
      return "px-5 py-28 sm:px-8 sm:py-36";
    case "centered":
    default:
      return "px-5 py-24 sm:px-8 sm:py-32";
  }
}

export function navHeaderClass(style: NavStyle): string {
  switch (style) {
    case "minimal":
      return "border-transparent bg-[color:var(--site-bg)]/70";
    case "underline":
      return "border-b border-[color:var(--site-primary)]/30 bg-[color:var(--site-bg)]/90";
    case "pill":
      return "border-b border-border bg-[color:var(--site-bg)]/90";
    case "standard":
    default:
      return "border-b border-border bg-[color:var(--site-bg)]/85";
  }
}

export function navLinkClass(style: NavStyle): string {
  switch (style) {
    case "underline":
      return "site-link text-sm text-muted underline-offset-8 hover:underline hover:decoration-[color:var(--site-accent)]";
    case "pill":
      return "site-link rounded-full border border-border px-3 py-1 text-sm text-muted hover:border-[color:var(--site-accent)]/50 hover:text-foreground";
    case "minimal":
      return "site-link text-sm text-muted/80 hover:text-foreground";
    case "standard":
    default:
      return "site-link text-sm text-muted";
  }
}
