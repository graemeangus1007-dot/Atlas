import type { WebsiteTemplate } from "@/lib/templates/types";

/** Editorial layout — refined nav, split hero, gallery emphasis. */
export const elegantTemplate: WebsiteTemplate = {
  id: "elegant",
  label: "Elegant",
  description: "Refined typography feel with a split hero and airy spacing.",
  thumbnailLabel: "Elegant",
  heroLayout: "split",
  navStyle: "underline",
  sectionOrder: ["hero", "features", "about", "gallery", "services", "contact"],
  cardStyle: "bordered",
  buttonStyle: "soft-rounded",
  galleryLayout: "masonry",
  footerLayout: "split",
  colorDefaults: {
    primaryColor: "#c4a574",
    secondaryColor: "#1a1612",
    accentColor: "#d4af7a",
    backgroundColor: "#12100e",
  },
};
