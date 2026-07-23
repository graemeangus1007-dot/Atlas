import type { WebsiteTemplate } from "@/lib/templates/types";

/** High-impact layout — dramatic hero, pill nav, gallery-first energy. */
export const boldTemplate: WebsiteTemplate = {
  id: "bold",
  label: "Bold",
  description: "High-impact hero, punchy cards, and gallery-forward energy.",
  thumbnailLabel: "Bold",
  heroLayout: "bold-overlay",
  navStyle: "pill",
  sectionOrder: ["hero", "gallery", "services", "features", "about", "contact"],
  cardStyle: "glass",
  buttonStyle: "pill",
  galleryLayout: "grid-3",
  footerLayout: "stacked",
  colorDefaults: {
    primaryColor: "#ff5a3c",
    secondaryColor: "#140a08",
    accentColor: "#ff6b4a",
    backgroundColor: "#0a0605",
  },
};
