/** Mock workspace data for the Atlas dashboard (no backend yet). */

export const MOCK_BUSINESS = {
  name: "Riverview Bakery",
  type: "Coffee Shop",
  initials: "RB",
} as const;

export const MOCK_STATS = [
  {
    id: "status",
    label: "Website Status",
    value: "Draft",
    hint: "Not published yet",
  },
  {
    id: "pages",
    label: "Pages",
    value: "4",
    hint: "Home, About, Menu, Contact",
  },
  {
    id: "seo",
    label: "SEO Score",
    value: "82%",
    hint: "Good — a few quick wins left",
  },
  {
    id: "visitors",
    label: "Visitors",
    value: "0",
    hint: "Publish to start tracking",
  },
] as const;

export const MOCK_ACTIVITY = [
  {
    id: "1",
    title: "Created website project",
    time: "Just now",
  },
  {
    id: "2",
    title: "Completed onboarding",
    time: "2 min ago",
  },
  {
    id: "3",
    title: "Homepage generated",
    time: "1 min ago",
  },
] as const;

export const MOCK_SUGGESTIONS = [
  {
    id: "headline",
    title: "Improve homepage headline",
    description:
      "Make your hero message clearer so visitors understand what you offer in seconds.",
  },
  {
    id: "photos",
    title: "Add business photos",
    description:
      "Upload real photos of your space and products to build trust and visual appeal.",
  },
  {
    id: "domain",
    title: "Connect a custom domain",
    description:
      "Replace the temporary Atlas URL with your own domain before you publish.",
  },
] as const;

export const SIDEBAR_LINKS = [
  { href: "/dashboard", label: "Dashboard", icon: "🏠", active: true },
  { href: "#website", label: "Website", icon: "🌐", active: false },
  { href: "#pages", label: "Pages", icon: "📄", active: false },
  { href: "#branding", label: "Branding", icon: "🎨", active: false },
  { href: "#media", label: "Media", icon: "🖼", active: false },
  { href: "#ai", label: "AI Assistant", icon: "🤖", active: false },
  { href: "#settings", label: "Settings", icon: "⚙", active: false },
] as const;
