import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  defaultProjectContact,
  resolveContactButtonText,
  resolveContactSuccessMessage,
} from "@/lib/contact";
import { generateWebsiteContent } from "@/lib/website-generator";
import { buildStaticSite } from "@/lib/publishing/build-static-site";
import type { BusinessProject, ProjectContact } from "@/types/business-project";

/** Mirror the editor's functional contact merge (website-editor onContactChange). */
function applyContactPatch(
  project: BusinessProject,
  patch: Partial<ProjectContact>,
): BusinessProject {
  return {
    ...project,
    contact: { ...project.contact, ...patch },
  };
}

function sampleProject(contact?: Partial<ProjectContact>): BusinessProject {
  return {
    businessName: "Northforge",
    businessType: "Other",
    description: "A sample business",
    goals: [],
    heroHeadline: "Hello",
    heroSubheadline: "World",
    primaryCta: "Contact us",
    services: [],
    contact: {
      ...defaultProjectContact("Northforge"),
      formId: "form_edit_1",
      ...contact,
    },
    templateId: "modern",
    pages: [],
    primaryColor: "#111111",
    secondaryColor: "#222222",
    accentColor: "#3db8a8",
    backgroundColor: "#0b0f14",
    headingFont: "inter",
    bodyFont: "inter",
    buttonStyle: "rounded",
    heroOverlay: 40,
    siteWidth: "wide",
    theme: "dark",
    logo: null,
    mediaLibrary: [],
    heroImageId: null,
    galleryImageIds: [],
    status: "ready",
    publish: null,
  };
}

describe("contact form buttonText / successMessage editing", () => {
  it("updates buttonText and successMessage while preserving siblings", () => {
    let project = sampleProject({
      buttonText: "Send message",
      successMessage: "Thanks!",
      showPhoneField: true,
      showCompanyField: true,
      formEnabled: true,
      formId: "form_1",
    });

    project = applyContactPatch(project, { buttonText: "Book a call" });
    expect(project.contact.buttonText).toBe("Book a call");
    expect(project.contact.successMessage).toBe("Thanks!");
    expect(project.contact.showPhoneField).toBe(true);
    expect(project.contact.showCompanyField).toBe(true);
    expect(project.contact.formId).toBe("form_1");

    project = applyContactPatch(project, {
      successMessage: "We will reply within a day.",
    });
    expect(project.contact.buttonText).toBe("Book a call");
    expect(project.contact.successMessage).toBe("We will reply within a day.");
    expect(project.contact.formId).toBe("form_1");
  });

  it("allows clearing and retyping without forcing the default fallback", () => {
    let project = sampleProject({ buttonText: "Send message" });
    project = applyContactPatch(project, { buttonText: "" });
    expect(project.contact.buttonText).toBe("");
    // Resolver still supplies publish fallback when blank.
    expect(resolveContactButtonText(project.contact)).toBe("Send message");

    project = applyContactPatch(project, { buttonText: "Go" });
    expect(project.contact.buttonText).toBe("Go");
    expect(resolveContactButtonText(project.contact)).toBe("Go");
  });

  it("reads legacy formButtonText / formSuccessMessage when reloading older projects", () => {
    const contact: ProjectContact = {
      ...defaultProjectContact("Legacy Co"),
      formButtonText: "Legacy CTA",
      formSuccessMessage: "Legacy thanks",
      buttonText: undefined,
      successMessage: undefined,
    };
    expect(resolveContactButtonText(contact)).toBe("Legacy CTA");
    expect(resolveContactSuccessMessage(contact)).toBe("Legacy thanks");
  });

  it("publishes the saved button text and success message into static HTML", () => {
    const prev = process.env.NEXT_PUBLIC_APP_URL;
    process.env.NEXT_PUBLIC_APP_URL = "https://atlas.example.com";
    try {
      const project = sampleProject({
        formId: "form_pub_9",
        buttonText: "Request a quote",
        successMessage: "Got it — talk soon!",
        formEnabled: true,
      });
      const content = generateWebsiteContent(project);
      expect(content.contact.form.buttonText).toBe("Request a quote");
      expect(content.contact.form.successMessage).toBe("Got it — talk soon!");

      const html = buildStaticSite(project).files.find(
        (f) => f.path === "index.html",
      )?.content;
      expect(html).toContain("Request a quote");
      expect(html).toContain("Got it — talk soon!");
    } finally {
      if (prev === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
      else process.env.NEXT_PUBLIC_APP_URL = prev;
    }
  });

  it("editor ensure path only patches formId (source contract)", () => {
    const source = readFileSync(
      resolve(__dirname, "../../components/editor/editor-contact.tsx"),
      "utf8",
    );
    expect(source).toContain("onChange({ formId: data.form.id })");
    expect(source).not.toContain("formSuccessMessage:");
    expect(source).toContain("onChange({ buttonText: e.target.value })");
    expect(source).toContain("onChange({ successMessage: e.target.value })");
    // Must not use || fallback in the controlled value (blocks editing).
    expect(source).not.toContain('formButtonText || "Send message"');
    expect(source).not.toContain("formSuccessMessage ||");
  });

  it("website editor merges contact patches from current state", () => {
    const source = readFileSync(
      resolve(__dirname, "../../components/editor/website-editor.tsx"),
      "utf8",
    );
    expect(source).toContain("updateProject((current) => ({");
    expect(source).toContain("contact: { ...current.contact, ...patch }");
  });
});
