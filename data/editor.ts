/** Editor chrome navigation (UI only — not part of BusinessProject). */

/**
 * Atlas v1 primary tools rail.
 * Media is a secondary workflow inside Design — not a top-level item.
 * Publish lives in the top bar only.
 */
export const EDITOR_SIDEBAR_ITEMS = [
  { id: "content", label: "Content", icon: "✏️" },
  { id: "design", label: "Design", icon: "🎨" },
  { id: "settings", label: "Site settings", icon: "⚙️" },
] as const;

export type EditorSidebarId = (typeof EDITOR_SIDEBAR_ITEMS)[number]["id"];

/** @deprecated Legacy panel ids — mapped to v1 ids when restoring UI state. */
export const LEGACY_EDITOR_PANEL_IDS: Record<string, EditorSidebarId> = {
  branding: "design",
  media: "design",
  seo: "settings",
  publish: "settings",
  site: "settings",
};

export function normalizeEditorPanelId(id: string | null | undefined): EditorSidebarId {
  if (!id) return "content";
  if (EDITOR_SIDEBAR_ITEMS.some((item) => item.id === id)) {
    return id as EditorSidebarId;
  }
  return LEGACY_EDITOR_PANEL_IDS[id] ?? "content";
}

export const EDITOR_PANEL_HINTS: Record<EditorSidebarId, string> = {
  content: "Click any text to edit directly, or tell Atlas what you want to change.",
  design: "Colors, type, and photos. Atlas remains the primary way to redesign the site.",
  settings: "SEO, domain, and versions. Publish from the top bar when you’re ready.",
};

/** User-facing copy that must never appear in the editor chrome. */
export const EDITOR_BANNED_UI_PHRASES = [
  "Improve with AI",
  "AI Copywriter",
  "AI Website",
  "Brand Studio",
  "Use Atlas AI in the right sidebar",
] as const;
