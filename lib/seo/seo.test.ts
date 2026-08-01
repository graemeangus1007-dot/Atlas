import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { defaultProjectContact } from "@/lib/contact";
import { buildStaticSite } from "@/lib/publishing/build-static-site";
import {
  buildLocalBusinessJsonLd,
  buildRobotsTxt,
  buildSitemapXml,
  defaultProjectSeo,
  joinSiteUrl,
  renderLocalBusinessJsonLdScript,
  renderSeoHeadTags,
  resolveProjectSeo,
  resolveSeoMetadata,
  resolveSeoSiteUrl,
  sanitizeProjectSeo,
  validateProjectSeo,
} from "@/lib/seo";
import type { BusinessProject } from "@/types/business-project";

function sampleProject(
  overrides: Partial<BusinessProject> = {},
): BusinessProject {
  return {
    businessName: "Northforge Digital",
    businessType: "Other",
    description:
      "Northforge Digital builds modern websites for local businesses that want more customers online.",
    goals: [],
    heroHeadline: "Hello",
    heroSubheadline: "World",
    primaryCta: "Contact us",
    services: [],
    contact: defaultProjectContact("Northforge Digital"),
    seo: {
      ...defaultProjectSeo({
        businessName: "Northforge Digital",
        description:
          "Northforge Digital builds modern websites for local businesses that want more customers online.",
        contact: defaultProjectContact("Northforge Digital"),
      }),
      siteTitle: "Northforge Digital | Websites",
      metaDescription:
        "Northforge Digital builds modern websites for local businesses that want more customers online every week.",
      socialTitle: "Northforge Digital",
      socialDescription: "Modern websites for local businesses.",
      robotsIndex: true,
      canonicalUrl: "",
      localBusiness: {
        name: "Northforge Digital",
        phone: "555-0100",
        email: "hello@northforge.example",
        streetAddress: "1 Harbor Way",
        addressLocality: "Portland",
        addressRegion: "OR",
        postalCode: "97201",
        addressCountry: "US",
        openingHours: [
          {
            day: "Monday",
            opens: "09:00",
            closes: "17:00",
          },
        ],
        logoAssetId: null,
      },
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
    ...overrides,
  };
}

describe("SEO metadata generation", () => {
  it("builds escaped head tags with OG and Twitter cards", () => {
    const project = sampleProject({
      seo: {
        ...resolveProjectSeo(sampleProject()),
        siteTitle: `Cafe <script>`,
        metaDescription: `Best "beans" & brew`,
        socialImageAssetId: null,
      },
    });
    const meta = resolveSeoMetadata(project, {
      activeCustomHostname: "www.northforge.example",
      socialImageUrl: null,
    });
    const html = renderSeoHeadTags(meta);
    expect(html).toContain("<title>Cafe &lt;script&gt;</title>");
    expect(html).toContain('content="Best &quot;beans&quot; &amp; brew"');
    expect(html).toContain('rel="canonical"');
    expect(html).toContain("https://www.northforge.example/");
    expect(html).toContain('property="og:title"');
    expect(html).toContain('name="twitter:card"');
    expect(html).not.toContain("<script>");
  });
});

describe("canonical switching", () => {
  it("prefers custom domain, then preview URL, then override", () => {
    expect(
      resolveSeoSiteUrl({
        activeCustomHostname: "Shop.Example.com",
        deploymentPreviewUrl: "https://preview.vercel.app",
      }),
    ).toBe("https://shop.example.com");

    expect(
      resolveSeoSiteUrl({
        deploymentPreviewUrl: "https://preview.vercel.app",
      }),
    ).toBe("https://preview.vercel.app");

    expect(
      resolveSeoSiteUrl({
        canonicalOverride: "https://brand.example/path",
        activeCustomHostname: "shop.example.com",
      }),
    ).toBe("https://brand.example/path");

    expect(joinSiteUrl("https://shop.example.com", "/sitemap.xml")).toBe(
      "https://shop.example.com/sitemap.xml",
    );
  });
});

describe("robots + sitemap generation", () => {
  it("allows indexing and links sitemap", () => {
    const robots = buildRobotsTxt({
      siteUrl: "https://shop.example.com",
      allowIndexing: true,
    });
    expect(robots).toContain("Allow: /");
    expect(robots).toContain("Sitemap: /sitemap.xml");
    expect(robots).toContain("Sitemap: https://shop.example.com/sitemap.xml");
  });

  it("disallows all when robots index is off", () => {
    const robots = buildRobotsTxt({
      siteUrl: "https://shop.example.com",
      allowIndexing: false,
    });
    expect(robots).toContain("Disallow: /");
    expect(robots).not.toContain("Sitemap:");
  });

  it("builds sitemap with escaped loc", () => {
    const xml = buildSitemapXml({
      siteUrl: "https://shop.example.com",
    });
    expect(xml).toContain("<loc>https://shop.example.com/</loc>");
    expect(xml).toContain("urlset");
  });
});

describe("JSON-LD LocalBusiness", () => {
  it("includes NAP and opening hours without HTML injection", () => {
    const project = sampleProject({
      seo: {
        ...resolveProjectSeo(sampleProject()),
        localBusiness: {
          ...resolveProjectSeo(sampleProject()).localBusiness,
          name: `Cafe </script><img src=x onerror=alert(1)>`,
          streetAddress: "1 Harbor Way",
          phone: "555-0100",
          openingHours: [
            { day: "Monday", opens: "09:00", closes: "17:00" },
          ],
        },
      },
    });
    const json = buildLocalBusinessJsonLd(project, {
      siteUrl: "https://shop.example.com",
    });
    expect(json["@type"]).toBe("LocalBusiness");
    expect(json.telephone).toBe("555-0100");
    expect(json.url).toBe("https://shop.example.com");
    const address = json.address as Record<string, unknown>;
    expect(address.streetAddress).toBe("1 Harbor Way");
    const hours = json.openingHoursSpecification as Array<
      Record<string, unknown>
    >;
    expect(hours[0]?.opens).toBe("09:00");

    const script = renderLocalBusinessJsonLdScript(project, {
      siteUrl: "https://shop.example.com",
    });
    expect(script).toContain("application/ld+json");
    expect(script).toContain("\\u003c");
    expect(script).not.toContain("</script><img");
  });
});

describe("validation warnings", () => {
  it("warns on long title, short description, missing social image, invalid canonical", () => {
    const seo = sanitizeProjectSeo({
      ...defaultProjectSeo(sampleProject()),
      siteTitle: "A".repeat(70),
      metaDescription: "Too short",
      socialImageAssetId: null,
      canonicalUrl: "javascript:alert(1)",
    });
    const warnings = validateProjectSeo(seo);
    expect(warnings.some((w) => w.code === "title_too_long")).toBe(true);
    expect(warnings.some((w) => w.code === "description_too_short")).toBe(true);
    expect(warnings.some((w) => w.code === "missing_social_image")).toBe(true);
    expect(warnings.some((w) => w.code === "invalid_canonical")).toBe(true);
  });

  it("warns on duplicate canonical when known list collides", () => {
    const seo = sanitizeProjectSeo({
      ...defaultProjectSeo(sampleProject()),
      siteTitle: "Ok title for search",
      metaDescription:
        "A meta description that is long enough to pass the minimum length check for SEO.",
      socialImageAssetId: "asset_1",
      canonicalUrl: "https://shop.example.com/",
    });
    const warnings = validateProjectSeo(seo, {
      knownCanonicals: [
        "https://shop.example.com",
        "https://shop.example.com/",
      ],
    });
    expect(warnings.some((w) => w.code === "duplicate_canonical")).toBe(true);
  });
});

describe("publish output", () => {
  it("emits robots.txt, sitemap.xml, SEO tags, and JSON-LD", () => {
    const artifact = buildStaticSite(sampleProject(), {
      activeCustomHostname: "www.northforge.example",
    });
    const paths = artifact.files.map((f) => f.path);
    expect(paths).toContain("robots.txt");
    expect(paths).toContain("sitemap.xml");
    expect(paths).toContain("index.html");

    const html = artifact.files.find((f) => f.path === "index.html")!.content;
    expect(html).toContain('rel="canonical"');
    expect(html).toContain("https://www.northforge.example/");
    expect(html).toContain('property="og:title"');
    expect(html).toContain('application/ld+json');
    expect(html).toContain("LocalBusiness");

    const robots = artifact.files.find((f) => f.path === "robots.txt")!.content;
    expect(robots).toContain("Sitemap: https://www.northforge.example/sitemap.xml");

    const sitemap = artifact.files.find((f) => f.path === "sitemap.xml")!.content;
    expect(sitemap).toContain("https://www.northforge.example/");
  });

  it("editor registers SEO under Site settings", () => {
    const editor = readFileSync(
      resolve(__dirname, "../../data/editor.ts"),
      "utf8",
    );
    expect(editor).toContain('id: "settings"');
    expect(editor).toContain("seo: \"settings\"");
    const settingsShell = readFileSync(
      resolve(__dirname, "../../components/editor/editor-site-settings-panel.tsx"),
      "utf8",
    );
    expect(settingsShell).toContain("SeoPanel");
    const panel = readFileSync(
      resolve(__dirname, "../../components/seo/seo-panel.tsx"),
      "utf8",
    );
    expect(panel).toContain("Google search result");
    expect(panel).toContain("Facebook / LinkedIn");
    expect(panel).toContain("X (Twitter)");
    expect(panel).toContain("Local Business");
  });
});
