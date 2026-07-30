import {
  BODY_FONTS,
  HEADING_FONTS,
  type BodyFontId,
  type HeadingFontId,
} from "@/data/design-options";
import { buildSiteDesignStyle } from "@/lib/design-theme";
import type { BusinessProject } from "@/types/business-project";
import type { CSSProperties } from "react";

const FONT_FAMILY_BY_ID: Record<HeadingFontId | BodyFontId, string> = {
  inter: "Inter",
  poppins: "Poppins",
  manrope: "Manrope",
  playfair: "Playfair Display",
  lora: "Lora",
};

function cssVarsFromStyle(style: CSSProperties): string {
  const lines: string[] = [];
  for (const [key, value] of Object.entries(style)) {
    if (!key.startsWith("--")) continue;
    if (typeof value !== "string" && typeof value !== "number") continue;
    lines.push(`  ${key}: ${String(value)};`);
  }
  lines.sort((a, b) => a.localeCompare(b));
  return lines.join("\n");
}

function googleFontsHref(
  headingFont: HeadingFontId,
  bodyFont: BodyFontId,
): string {
  const families = new Set<string>([
    FONT_FAMILY_BY_ID[headingFont] ?? "Inter",
    FONT_FAMILY_BY_ID[bodyFont] ?? "Inter",
  ]);
  const params = [...families]
    .sort((a, b) => a.localeCompare(b))
    .map((family) => `family=${encodeURIComponent(family)}:wght@400;500;600;700`)
    .join("&");
  return `https://fonts.googleapis.com/css2?${params}&display=swap`;
}

function fontStack(id: HeadingFontId | BodyFontId): string {
  const family = FONT_FAMILY_BY_ID[id] ?? "Inter";
  return `"${family}", system-ui, -apple-system, Segoe UI, sans-serif`;
}

/**
 * Self-contained responsive CSS for a published Atlas site.
 * Mirrors `.site-canvas` design tokens from the live preview.
 */
export function buildStaticSiteCss(project: BusinessProject): string {
  const style = buildSiteDesignStyle(project);
  const vars = cssVarsFromStyle(style);
  const headingId = project.headingFont;
  const bodyId = project.bodyFont;
  const headingStack = fontStack(headingId);
  const bodyStack = fontStack(bodyId);
  // Resolve catalog defaults so unknown ids still get a stable stack.
  void HEADING_FONTS;
  void BODY_FONTS;

  return `/* Atlas static site — generated from Brand Studio tokens. Do not edit by hand. */
:root {
${vars}
  --font-inter: ${fontStack("inter")};
  --font-poppins: ${fontStack("poppins")};
  --font-manrope: ${fontStack("manrope")};
  --font-playfair: ${fontStack("playfair")};
  --font-lora: ${fontStack("lora")};
  --site-heading-font-stack: ${headingStack};
  --site-body-font-stack: ${bodyStack};
}

*,
*::before,
*::after {
  box-sizing: border-box;
}

html {
  scroll-behavior: smooth;
}

body {
  margin: 0;
  min-height: 100vh;
  background: var(--site-bg);
  color: var(--site-fg);
  font-family: var(--site-body-font, var(--site-body-font-stack));
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
}

img {
  display: block;
  max-width: 100%;
}

a {
  color: inherit;
  text-decoration: none;
}

ul, ol, dl {
  margin: 0;
  padding: 0;
  list-style: none;
}

h1, h2, h3, p {
  margin: 0;
}

.site-canvas {
  background: var(--site-bg);
  color: var(--site-fg);
  font-family: var(--site-body-font, var(--site-body-font-stack));
  min-height: 100vh;
}

.site-heading {
  font-family: var(--site-heading-font, var(--site-heading-font-stack));
}

.site-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--site-button-radius, 0.75rem);
  border: 1px solid transparent;
  font: inherit;
  font-weight: 600;
  cursor: pointer;
  transition: filter 160ms ease, background-color 160ms ease, border-color 160ms ease;
}

.site-button:focus-visible,
.site-link:focus-visible,
.site-nav-toggle:focus-visible {
  outline: 2px solid var(--site-accent);
  outline-offset: 2px;
}

.site-button-primary {
  background: var(--site-accent);
  color: var(--site-bg);
  padding: 0.875rem 2rem;
}

.site-button-primary:hover {
  filter: brightness(1.1);
}

.site-button-secondary {
  background: transparent;
  color: var(--site-fg);
  border-color: var(--site-border);
  padding: 0.875rem 2rem;
}

.site-button-secondary:hover {
  border-color: color-mix(in srgb, var(--site-accent) 50%, var(--site-border));
}

.site-shell {
  width: 100%;
  max-width: var(--site-content-max, 72rem);
  margin-inline: auto;
}

.site-link {
  transition: color 160ms ease;
}

.site-link:hover {
  color: var(--site-accent);
}

.site-hero-overlay {
  background-color: var(--site-bg);
  opacity: var(--site-hero-overlay, 0.5);
}

.site-card {
  background: color-mix(in srgb, var(--site-surface) 88%, var(--site-primary) 12%);
  border-color: var(--site-border);
}

.site-card-elevated {
  border: 1px solid var(--site-border);
  background: color-mix(in srgb, var(--site-surface) 70%, transparent);
  box-shadow: 0 18px 50px -28px rgba(0, 0, 0, 0.75);
}

.site-card-flat {
  border: 1px solid transparent;
  background: color-mix(in srgb, var(--site-surface) 35%, transparent);
}

.site-card-bordered {
  border: 2px solid color-mix(in srgb, var(--site-primary) 50%, transparent);
  background: transparent;
}

.site-card-glass {
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: color-mix(in srgb, var(--site-surface) 30%, transparent);
  backdrop-filter: blur(12px);
}

.site-header {
  position: sticky;
  top: 0;
  z-index: 40;
  backdrop-filter: blur(16px);
}

.site-header-standard {
  border-bottom: 1px solid var(--site-border);
  background: color-mix(in srgb, var(--site-bg) 85%, transparent);
}

.site-header-minimal {
  border-bottom: 1px solid transparent;
  background: color-mix(in srgb, var(--site-bg) 70%, transparent);
}

.site-header-underline {
  border-bottom: 1px solid color-mix(in srgb, var(--site-primary) 30%, transparent);
  background: color-mix(in srgb, var(--site-bg) 90%, transparent);
}

.site-header-pill {
  border-bottom: 1px solid var(--site-border);
  background: color-mix(in srgb, var(--site-bg) 90%, transparent);
}

.site-nav {
  display: flex;
  height: 4rem;
  align-items: center;
  justify-content: space-between;
  padding-inline: 1.25rem;
}

.site-brand {
  font-size: 1.125rem;
  font-weight: 600;
  letter-spacing: -0.02em;
  color: var(--site-primary);
  max-width: 60%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.site-nav-desktop {
  display: none;
  align-items: center;
  gap: 1.75rem;
}

.site-nav-desktop.pill {
  gap: 0.5rem;
}

.site-nav-link {
  font-size: 0.875rem;
  color: var(--site-muted);
}

.site-nav-link-underline:hover {
  text-decoration: underline;
  text-underline-offset: 8px;
  text-decoration-color: var(--site-accent);
}

.site-nav-link-pill {
  border: 1px solid var(--site-border);
  border-radius: 9999px;
  padding: 0.25rem 0.75rem;
}

.site-nav-toggle {
  display: inline-flex;
  height: 2.5rem;
  width: 2.5rem;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--site-border);
  border-radius: var(--site-button-radius);
  background: transparent;
  color: var(--site-fg);
}

.site-nav-details {
  position: relative;
}

.site-nav-mobile {
  display: none;
  position: absolute;
  right: 0;
  top: calc(100% + 0.5rem);
  z-index: 50;
  min-width: 12rem;
  border: 1px solid var(--site-border);
  border-radius: 0.75rem;
  background: var(--site-bg);
  padding: 0.5rem;
  box-shadow: 0 18px 40px -24px rgba(0, 0, 0, 0.7);
}

.site-nav-mobile a {
  display: block;
  border-radius: 0.5rem;
  padding: 0.75rem 0.5rem;
  font-size: 0.875rem;
  color: var(--site-muted);
}

.site-nav-mobile a:hover {
  background: var(--site-accent-soft);
  color: var(--site-fg);
}

.site-nav-details[open] .site-nav-mobile {
  display: block;
}

.site-nav-details summary {
  list-style: none;
}

.site-nav-details summary::-webkit-details-marker {
  display: none;
}

.site-section {
  scroll-margin-top: 5rem;
  padding: 5rem 1.25rem;
}

.site-section-bordered {
  border-bottom: 1px solid var(--site-border);
}

.site-eyebrow {
  font-size: 0.875rem;
  font-weight: 500;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--site-accent);
}

.site-heading-block {
  max-width: 42rem;
}

.site-heading-block.center {
  margin-inline: auto;
  text-align: center;
}

.site-heading-block h2 {
  margin-top: 0.75rem;
  font-size: clamp(1.75rem, 4vw, 2.25rem);
  font-weight: 600;
  letter-spacing: -0.02em;
}

.site-heading-block p {
  margin-top: 1rem;
  color: var(--site-muted);
}

.site-hero {
  position: relative;
  isolation: isolate;
  overflow: hidden;
  border-bottom: 1px solid var(--site-border);
  padding: 6rem 1.25rem;
}

.site-hero-centered,
.site-hero-bold-overlay {
  padding-block: 6rem;
}

.site-hero-minimal {
  padding-block: 4rem;
}

.site-hero-split {
  padding-block: 5rem;
}

.site-hero-media {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.site-hero-media img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.site-hero-wash {
  position: absolute;
  inset: 0;
  background: radial-gradient(circle at top, var(--site-accent-soft), transparent 55%);
}

.site-hero-content {
  position: relative;
  z-index: 1;
}

.site-hero-content.center {
  text-align: center;
}

.site-hero-content h1 {
  margin-top: 1rem;
  font-size: clamp(2rem, 6vw, 3.75rem);
  font-weight: 600;
  letter-spacing: -0.03em;
}

.site-hero-bold-overlay .site-hero-content h1 {
  font-size: clamp(2.5rem, 7vw, 4.5rem);
}

.site-hero-minimal .site-hero-content h1 {
  font-size: clamp(1.75rem, 5vw, 3rem);
}

.site-hero-content .lede {
  margin-top: 1.25rem;
  font-size: 1.05rem;
  color: var(--site-muted);
  max-width: 42rem;
}

.site-hero-content.center .lede {
  margin-inline: auto;
}

.site-hero-actions {
  margin-top: 2.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.site-hero-actions.center {
  align-items: stretch;
}

.site-hero-split-grid {
  display: grid;
  gap: 2.5rem;
  align-items: center;
}

.site-hero-split-image {
  position: relative;
  aspect-ratio: 4 / 3;
  overflow: hidden;
  border-radius: 1.5rem;
  border: 1px solid var(--site-border);
}

.site-hero-split-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.site-hero-split-image .site-hero-overlay {
  position: absolute;
  inset: 0;
  opacity: 0.3;
}

.site-about-grid {
  display: grid;
  gap: 2.5rem;
}

.site-about-card,
.site-contact-panel {
  border-radius: 1.5rem;
  padding: 1.5rem;
}

.site-about-card p {
  color: var(--site-muted);
  font-size: 1.05rem;
  line-height: 1.7;
}

.site-about-signoff {
  margin-top: 1.5rem;
  font-size: 0.875rem;
  color: color-mix(in srgb, var(--site-fg) 80%, transparent);
}

.site-card-grid {
  margin-top: 3rem;
  display: grid;
  gap: 1.25rem;
}

.site-card-grid li {
  border-radius: 1rem;
  padding: 1.5rem;
  transition: transform 200ms ease, border-color 200ms ease;
}

.site-card-grid li:hover {
  transform: translateY(-2px);
  border-color: color-mix(in srgb, var(--site-accent) 40%, var(--site-border));
}

.site-card-grid h3 {
  font-size: 1.25rem;
  font-weight: 600;
}

.site-card-grid p {
  margin-top: 0.75rem;
  font-size: 0.875rem;
  color: var(--site-muted);
  line-height: 1.6;
}

.site-feature-bar {
  display: block;
  width: 2.5rem;
  height: 0.375rem;
  margin-bottom: 1rem;
  border-radius: 9999px;
  background: var(--site-accent);
}

.site-gallery {
  margin-top: 3rem;
  display: grid;
  gap: 1rem;
}

.site-gallery-grid-2 {
  grid-template-columns: 1fr;
}

.site-gallery-grid-3 {
  grid-template-columns: 1fr;
}

.site-gallery-wide {
  grid-template-columns: 1fr;
}

.site-gallery-masonry {
  grid-template-columns: 1fr;
}

.site-gallery-item {
  display: flex;
  flex-direction: column;
}

.site-gallery-frame {
  position: relative;
  min-height: 10rem;
  overflow: hidden;
  border-radius: 1.5rem;
  border: 1px solid var(--site-border);
  aspect-ratio: 4 / 3;
}

.site-gallery-wide .site-gallery-frame {
  aspect-ratio: 3 / 4;
}

.site-gallery-frame img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 500ms ease;
}

.site-gallery-item:hover img {
  transform: scale(1.03);
}

.site-gallery-frame::after {
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(to top, rgba(0, 0, 0, 0.35), transparent 55%);
  pointer-events: none;
}

.site-gallery-caption {
  margin-top: 0.75rem;
  padding-inline: 0.25rem;
}

.site-gallery-caption strong {
  display: block;
  font-size: 0.875rem;
  font-weight: 500;
}

.site-gallery-caption span {
  display: block;
  margin-top: 0.25rem;
  font-size: 0.75rem;
  color: var(--site-muted);
  line-height: 1.5;
}

.site-contact-panel {
  border: 1px solid var(--site-border);
  background: color-mix(in srgb, var(--site-surface) 70%, transparent);
  padding: 2.5rem 1.5rem;
}

.site-contact-details {
  margin-top: 2.5rem;
  display: grid;
  gap: 1rem;
}

.site-contact-details.cols-3 {
  grid-template-columns: 1fr;
}

.site-contact-tile {
  border-radius: 1rem;
  padding: 1.25rem;
  text-align: center;
  min-height: 7.5rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.site-contact-tile dt,
.site-contact-row dt {
  font-size: 0.75rem;
  font-weight: 500;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--site-muted);
}

.site-contact-tile dd,
.site-contact-row dd {
  margin: 0.5rem 0 0;
  font-size: 0.875rem;
  font-weight: 500;
  overflow-wrap: anywhere;
}

.site-contact-stack {
  margin-top: 2rem;
  max-width: 36rem;
}

.site-contact-stack.center {
  margin-inline: auto;
}

.site-contact-row {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  border-bottom: 1px solid var(--site-border);
  padding-block: 0.75rem;
}

.site-contact-row:last-child {
  border-bottom: 0;
}

.site-contact-split {
  display: grid;
  gap: 2.5rem;
}

.site-contact-form {
  margin-top: 2rem;
  display: grid;
  gap: 0.85rem;
  max-width: 36rem;
}

.site-form-field {
  display: grid;
  gap: 0.35rem;
  font-size: 0.8rem;
  color: var(--site-muted);
}

.site-form-field input,
.site-form-field textarea {
  width: 100%;
  border: 1px solid var(--site-border);
  border-radius: 0.75rem;
  background: color-mix(in srgb, var(--site-surface) 80%, transparent);
  color: var(--site-foreground);
  padding: 0.65rem 0.85rem;
  font: inherit;
  font-size: 0.9rem;
}

.site-form-field input:focus,
.site-form-field textarea:focus {
  outline: 2px solid color-mix(in srgb, var(--site-accent) 55%, transparent);
  outline-offset: 1px;
}

.site-form-honeypot {
  position: absolute;
  left: -10000px;
  top: auto;
  width: 1px;
  height: 1px;
  overflow: hidden;
}

.site-form-submit {
  justify-self: start;
  border: 0;
  border-radius: 0.85rem;
  background: var(--site-accent);
  color: var(--site-background);
  font: inherit;
  font-size: 0.9rem;
  font-weight: 600;
  padding: 0.7rem 1.15rem;
  cursor: pointer;
}

.site-form-submit:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.site-form-status {
  margin: 0;
  font-size: 0.85rem;
}

.site-form-status.is-success {
  color: var(--site-accent);
}

.site-form-status.is-error {
  color: #f87171;
}

@media (min-width: 640px) {
  .site-nav {
    padding-inline: 2rem;
  }

  .site-section {
    padding: 6rem 2rem;
  }

  .site-hero {
    padding-inline: 2rem;
  }

  .site-hero-actions {
    flex-direction: row;
    align-items: center;
  }

  .site-hero-actions.center {
    justify-content: center;
  }

  .site-card-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .site-gallery-grid-2,
  .site-gallery-masonry {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .site-gallery-grid-3 {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .site-gallery-wide {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }

  .site-gallery-frame {
    min-height: 12rem;
  }

  .site-contact-panel {
    padding: 3.5rem 2.5rem;
  }

  .site-contact-details.cols-3 {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .site-contact-row {
    flex-direction: row;
    align-items: baseline;
    justify-content: space-between;
  }

  .site-about-card,
  .site-contact-panel {
    padding: 2rem;
  }
}

@media (min-width: 768px) {
  .site-nav-desktop {
    display: flex;
  }

  .site-nav-details {
    display: none;
  }
}

@media (min-width: 1024px) {
  .site-hero-split-grid {
    grid-template-columns: 1fr 1fr;
  }

  .site-about-grid {
    grid-template-columns: 0.9fr 1.1fr;
    align-items: center;
  }

  .site-card-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .site-contact-split {
    grid-template-columns: 1fr 1.1fr;
    align-items: start;
  }
}

/* Motion (Sprint 28.3) — driven by data-motion on .site-canvas */
.site-canvas[data-motion="on"][data-hover-effects="on"] .site-motion-card,
.site-canvas[data-motion="on"][data-hover-effects="on"] .site-card-grid li {
  transition:
    transform 280ms ease,
    border-color 280ms ease,
    box-shadow 280ms ease,
    opacity 400ms ease;
}

.site-canvas[data-motion="on"][data-hover-effects="on"] .site-motion-card:hover,
.site-canvas[data-motion="on"][data-hover-effects="on"] .site-card-grid li:hover {
  transform: translateY(-4px);
}

.site-canvas[data-motion="on"][data-hover-effects="on"] .site-button:hover {
  transform: translateY(-1px);
  filter: brightness(1.06);
}

@keyframes site-section-reveal {
  from {
    opacity: 0;
    transform: translateY(16px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.site-canvas[data-motion="on"][data-section-reveal="on"] .site-section,
.site-canvas[data-motion="on"][data-section-reveal="on"] [id="about"],
.site-canvas[data-motion="on"][data-section-reveal="on"] [id="services"],
.site-canvas[data-motion="on"][data-section-reveal="on"] [id="features"],
.site-canvas[data-motion="on"][data-section-reveal="on"] [id="gallery"],
.site-canvas[data-motion="on"][data-section-reveal="on"] [id="contact"],
.site-canvas[data-motion="on"][data-section-reveal="on"] [id="testimonials"],
.site-canvas[data-motion="on"][data-section-reveal="on"] [id="faq"] {
  animation: site-section-reveal 0.55s ease both;
}

@media (prefers-reduced-motion: reduce) {
  html {
    scroll-behavior: auto;
  }

  .site-canvas[data-motion="on"][data-section-reveal="on"] .site-section,
  .site-canvas[data-motion="on"][data-section-reveal="on"] [id="about"],
  .site-canvas[data-motion="on"][data-section-reveal="on"] [id="services"],
  .site-canvas[data-motion="on"][data-section-reveal="on"] [id="features"],
  .site-canvas[data-motion="on"][data-section-reveal="on"] [id="gallery"],
  .site-canvas[data-motion="on"][data-section-reveal="on"] [id="contact"],
  .site-canvas[data-motion="on"][data-section-reveal="on"] [id="testimonials"],
  .site-canvas[data-motion="on"][data-section-reveal="on"] [id="faq"],
  .site-canvas[data-motion="on"][data-hover-effects="on"] .site-motion-card,
  .site-canvas[data-motion="on"][data-hover-effects="on"] .site-button,
  .site-canvas[data-motion="on"][data-hover-effects="on"] .site-card-grid li {
    animation: none !important;
    transition: none !important;
    transform: none !important;
  }
}
`;
}

export function buildGoogleFontsUrl(project: BusinessProject): string {
  return googleFontsHref(project.headingFont, project.bodyFont);
}
