/** Editor chrome navigation (UI only — not part of BusinessProject). */

export const EDITOR_SIDEBAR_ITEMS = [
  { id: "pages", label: "Pages", icon: "📄" },
  { id: "content", label: "Content", icon: "✏️" },
  { id: "branding", label: "Brand Studio", icon: "🎨" },
  { id: "media", label: "Media", icon: "🖼" },
  { id: "seo", label: "SEO", icon: "🔍" },
  { id: "publish", label: "Publish", icon: "🚀" },
] as const;

export type EditorSidebarId = (typeof EDITOR_SIDEBAR_ITEMS)[number]["id"];

export const EDITOR_PANEL_HINTS: Record<EditorSidebarId, string> = {
  pages: "Page structure is coming soon. Edit homepage content on the canvas.",
  content:
    "Click text to edit. Use ✨ Improve with AI for headline, about, services, and CTA.",
  branding:
    "Use Brand Studio to customize colors, fonts, buttons, overlay, and width.",
  media: "Upload photos, then set a hero image or gallery photos.",
  seo: "Set search titles, social previews, robots, favicon, and Local Business details.",
  publish: "Use Publish in the top bar to deploy a mock live site.",
};
