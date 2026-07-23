import type { WebsiteTemplate } from "@/lib/templates/types";

/** Quiet layout — spare nav, compact hero, flat cards. */
export const minimalTemplate: WebsiteTemplate = {
  id: "minimal",
  label: "Minimal",
  description: "Quiet and focused — fewer flourishes, more breathing room.",
  thumbnailLabel: "Minimal",
  heroLayout: "minimal",
  navStyle: "minimal",
  sectionOrder: ["hero", "about", "services", "contact", "features", "gallery"],
  cardStyle: "flat",
  buttonStyle: "square",
  galleryLayout: "wide",
  footerLayout: "minimal",
  colorDefaults: {
    primaryColor: "#8b95a5",
    secondaryColor: "#111318",
    accentColor: "#a8b2c1",
    backgroundColor: "#0b0d10",
  },
};
