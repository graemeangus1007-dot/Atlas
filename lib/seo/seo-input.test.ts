import { describe, expect, it, vi } from "vitest";
import {
  isTypingTarget,
  shouldRunEditorShortcut,
} from "@/lib/editor/is-typing-target";
import { defaultProjectContact } from "@/lib/contact";
import {
  defaultProjectSeo,
  patchSeo,
  sanitizeProjectSeo,
  sanitizeSeoText,
} from "@/lib/seo";
import type { BusinessProject } from "@/types/business-project";

function sampleProject(): BusinessProject {
  const contact = defaultProjectContact("Northforge Digital");
  return {
    businessName: "Northforge Digital",
    businessType: "Other",
    description: "Builds websites",
    goals: [],
    heroHeadline: "Hello",
    heroSubheadline: "World",
    primaryCta: "Contact us",
    services: [],
    contact,
    seo: defaultProjectSeo({
      businessName: "Northforge Digital",
      description: "Builds websites",
      contact,
    }),
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

function mockEl(
  tagName: string,
  extras: {
    isContentEditable?: boolean;
    closest?: (selector: string) => unknown;
  } = {},
): EventTarget {
  return {
    tagName,
    isContentEditable: extras.isContentEditable ?? false,
    closest: extras.closest ?? (() => null),
  } as unknown as EventTarget;
}

describe("SEO text fields — spaces while typing", () => {
  it("preserves trailing and mid-phrase spaces on live patch (controlled input)", () => {
    const project = sampleProject();
    const afterSpace = patchSeo(
      project,
      { siteTitle: "Northforge " },
      { trimEnds: false },
    );
    expect(afterSpace.siteTitle).toBe("Northforge ");

    const withPhrase = patchSeo(
      { ...project, seo: afterSpace },
      {
        siteTitle: "Northforge Digital",
        metaDescription: "Modern sites for local ",
      },
      { trimEnds: false },
    );
    expect(withPhrase.siteTitle).toBe("Northforge Digital");
    expect(withPhrase.metaDescription).toBe("Modern sites for local ");
  });

  it("still strips HTML while allowing spaces", () => {
    const live = sanitizeSeoText("Cafe <b>Brew</b> ", 120, { trimEnds: false });
    expect(live).toBe("Cafe Brew ");
    expect(live).not.toContain("<");
  });

  it("trims on finalize (blur / publish sanitize)", () => {
    const dirty = sanitizeProjectSeo(
      {
        ...defaultProjectSeo(sampleProject()),
        siteTitle: "  Hello World  ",
        metaDescription:
          "  A longer meta description that is ready for search.  ",
      },
      { trimEnds: true },
    );
    expect(dirty.siteTitle).toBe("Hello World");
    expect(dirty.metaDescription).toBe(
      "A longer meta description that is ready for search.",
    );
  });

  it("regression: default sanitize (trim) would block trailing Space keystrokes", () => {
    // Documents the original bug: trim-on-change ate trailing spaces.
    const trimmed = sanitizeSeoText("Northforge ", 120);
    expect(trimmed).toBe("Northforge");

    const live = sanitizeSeoText("Northforge ", 120, { trimEnds: false });
    expect(live).toBe("Northforge ");
  });
});

describe("editor shortcuts vs text inputs", () => {
  it("treats input/textarea/contenteditable as typing targets", () => {
    expect(isTypingTarget(mockEl("INPUT"))).toBe(true);
    expect(isTypingTarget(mockEl("TEXTAREA"))).toBe(true);
    expect(isTypingTarget(mockEl("DIV", { isContentEditable: true }))).toBe(
      true,
    );
    expect(isTypingTarget(mockEl("BUTTON"))).toBe(false);
  });

  it("does not run Space shortcut while an SEO input is focused", () => {
    const runShortcut = vi.fn();
    const preventDefault = vi.fn();
    const event = {
      key: " ",
      target: mockEl("INPUT"),
      preventDefault,
    };

    if (shouldRunEditorShortcut(event)) {
      preventDefault();
      runShortcut();
    }

    expect(runShortcut).not.toHaveBeenCalled();
    expect(preventDefault).not.toHaveBeenCalled();
  });

  it("still allows Space shortcut outside text inputs", () => {
    const runShortcut = vi.fn();
    const preventDefault = vi.fn();
    const event = {
      key: " ",
      target: mockEl("BUTTON"),
      preventDefault,
    };

    if (shouldRunEditorShortcut(event)) {
      preventDefault();
      runShortcut();
    }

    expect(runShortcut).toHaveBeenCalledTimes(1);
    expect(preventDefault).toHaveBeenCalledTimes(1);
  });
});

describe("autosave persists SEO values containing spaces", () => {
  it("keeps interior spaces through live sanitize → content.seo JSON → reload", () => {
    const project = sampleProject();
    const seo = patchSeo(
      project,
      {
        siteTitle: "Olive Branch Cafe",
        metaDescription:
          "Fresh coffee and pastries for the neighborhood every morning.",
        socialTitle: "Visit Olive Branch",
      },
      { trimEnds: false },
    );

    // Mirrors projects.content.seo persistence (JSON round-trip / autosave).
    const content = { seo };
    const serialized = JSON.stringify(content);
    expect(serialized).toContain("Olive Branch Cafe");
    expect(serialized).toContain("Fresh coffee and pastries");

    const restored = JSON.parse(serialized) as { seo: typeof seo };
    expect(restored.seo.siteTitle).toBe("Olive Branch Cafe");
    expect(restored.seo.metaDescription).toContain(" ");
    expect(restored.seo.socialTitle).toBe("Visit Olive Branch");
  });

  it("live preview strings update with spaced titles", () => {
    const seo = patchSeo(
      sampleProject(),
      {
        siteTitle: "Best Beans In Town",
        socialTitle: "Best Beans In Town",
        socialDescription: "Share this cafe with friends",
      },
      { trimEnds: false },
    );
    expect(seo.siteTitle.split(" ")).toHaveLength(4);
    expect(seo.socialDescription).toBe("Share this cafe with friends");
  });
});
