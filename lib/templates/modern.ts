import type { WebsiteTemplate } from "@/lib/templates/types";

/** Clean SaaS-style layout — balanced sections, soft cards. */
export const modernTemplate: WebsiteTemplate = {
  id: "modern",
  label: "Modern",
  description: "Clean, balanced layout with a centered hero and soft cards.",
  thumbnailLabel: "Modern",
  heroLayout: "centered",
  navStyle: "standard",
  sectionOrder: ["hero", "about", "services", "features", "gallery", "contact"],
  cardStyle: "elevated",
  buttonStyle: "rounded",
  galleryLayout: "grid-2",
  footerLayout: "centered",
  colorDefaults: {
    primaryColor: "#3db8a8",
    secondaryColor: "#0e1218",
    accentColor: "#3db8a8",
    backgroundColor: "#07090d",
  },
};
