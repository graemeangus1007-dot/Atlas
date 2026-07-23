import { boldTemplate } from "@/lib/templates/bold";
import { elegantTemplate } from "@/lib/templates/elegant";
import { minimalTemplate } from "@/lib/templates/minimal";
import { modernTemplate } from "@/lib/templates/modern";
import { registerTemplate } from "@/lib/templates/registry";

/** Register built-in Atlas layout templates. */
registerTemplate(modernTemplate);
registerTemplate(elegantTemplate);
registerTemplate(minimalTemplate);
registerTemplate(boldTemplate);

export {
  TemplateRegistry,
  getTemplate,
  listTemplates,
  registerTemplate,
} from "@/lib/templates/registry";
export { applyTemplateToProject } from "@/lib/templates/apply-template";
export type {
  TemplateId,
  TemplateSectionId,
  WebsiteTemplate,
  HeroLayout,
  NavStyle,
  CardStyle,
  GalleryLayout,
  FooterLayout,
} from "@/lib/templates/types";
export { TEMPLATE_IDS } from "@/lib/templates/types";
export {
  cardStyleClass,
  galleryGridClass,
  heroSectionClass,
  navHeaderClass,
  navLinkClass,
} from "@/lib/templates/style-classes";
