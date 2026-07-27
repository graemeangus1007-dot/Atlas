import { escapeHtml } from "@/lib/publishing/escape";

/**
 * Free-plan "Built with Atlas" badge for published sites.
 * Omitted automatically when removeBranding entitlement is true.
 */
export function renderBuiltWithAtlasBadge(options?: {
  atlasOrigin?: string | null;
}): string {
  const origin = options?.atlasOrigin?.replace(/\/+$/, "") || "https://atlas.app";
  const href = escapeHtml(`${origin}/`);
  return `<aside class="atlas-built-with" aria-label="Built with Atlas">
  <a class="atlas-built-with-link" href="${href}" target="_blank" rel="noopener noreferrer">Built with Atlas</a>
</aside>`;
}

export const BUILT_WITH_ATLAS_CSS = `
.atlas-built-with {
  position: fixed;
  right: 1rem;
  bottom: 1rem;
  z-index: 50;
  pointer-events: none;
}
.atlas-built-with-link {
  pointer-events: auto;
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.45rem 0.75rem;
  border-radius: 999px;
  background: rgba(11, 15, 20, 0.88);
  color: #f5f7fa;
  font: 600 12px/1.2 system-ui, sans-serif;
  text-decoration: none;
  border: 1px solid rgba(255, 255, 255, 0.12);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.28);
}
.atlas-built-with-link:hover {
  border-color: rgba(61, 184, 168, 0.55);
  color: #fff;
}
`;
