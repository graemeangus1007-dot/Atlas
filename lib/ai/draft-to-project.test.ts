import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  AI_BRAND_TONES,
  EMPTY_AI_QUESTIONNAIRE,
  type AiQuestionnaireAnswers,
} from "@/components/ai/ai-types";
import {
  AI_CREATE_PROJECT_EDITOR_PATH,
  allToneDesigns,
  buildMockWebsiteDraft,
  designFromTone,
  mapDraftToBusinessProject,
  mapDraftToProjectSeo,
  mapIndustryToBusinessType,
  normalizeIdempotencyKey,
  validateGeneratedWebsiteDraft,
} from "@/lib/ai";
import { featureFlagsForPlan } from "@/lib/billing/plans";
import { evaluateUsage } from "@/lib/billing/entitlements";
import { buildStaticSite } from "@/lib/publishing/build-static-site";
import {
  businessProjectToColumns,
  rowToBusinessProject,
} from "@/lib/supabase/projects";
import type { ProjectRow } from "@/lib/supabase/types";
import { generateWebsiteContent } from "@/lib/website-generator";

function completeAnswers(
  overrides: Partial<AiQuestionnaireAnswers> = {},
): AiQuestionnaireAnswers {
  return {
    ...EMPTY_AI_QUESTIONNAIRE,
    businessName: "Cedar Cafe",
    industry: "Coffee Shop",
    oneSentenceDescription: "Neighborhood espresso and pastries.",
    yearsInBusiness: "8 years",
    primaryServices: "Espresso\nPastries\nCatering",
    secondaryServices: "Merch",
    targetCustomer: "Remote workers",
    serviceArea: "Downtown",
    tone: "friendly",
    primaryColor: "#3db8a8",
    accentColor: "#102018",
    phone: "(555) 111-2222",
    email: "hello@cedar.example",
    address: "12 Main St, Portland, OR 97201",
    website: "https://cedar.example",
    facebook: "cedarcafe",
    instagram: "@cedarcafe",
    ...overrides,
  };
}

function sampleDraft(overrides: Record<string, unknown> = {}) {
  return buildMockWebsiteDraft({
    projectId: "11111111-1111-4111-8111-111111111111",
    businessName: "Cedar Cafe",
    businessType: "Coffee Shop",
    description: "Neighborhood espresso and pastries.",
    questionnaire: {
      tone: "friendly",
      primaryServices: ["Espresso", "Pastries", "Catering"],
      targetCustomer: "Remote workers",
      serviceArea: "Downtown",
      phone: "(555) 111-2222",
      email: "hello@cedar.example",
      address: "12 Main St, Portland, OR 97201",
    },
    ...overrides,
  });
}

describe("tone → design mapping", () => {
  it("maps every branding tone deterministically", () => {
    const designs = allToneDesigns();
    expect(designs).toHaveLength(AI_BRAND_TONES.length);
    expect(designFromTone("professional").templateId).toBe("minimal");
    expect(designFromTone("friendly").templateId).toBe("modern");
    expect(designFromTone("luxury").templateId).toBe("elegant");
    expect(designFromTone("modern").templateId).toBe("modern");
    expect(designFromTone("bold").templateId).toBe("bold");
    expect(designFromTone("luxury").headingFont).toBe("playfair");
    expect(designFromTone("bold").buttonStyle).toBe("pill");
    expect(designFromTone("unknown").tone).toBe("professional");
  });
});

describe("AI draft → BusinessProject mapping", () => {
  it("maps draft fields into a complete editable project", () => {
    const draft = sampleDraft();
    const { project, meta } = mapDraftToBusinessProject({
      draft,
      questionnaire: completeAnswers(),
      idempotencyKey: "key-1",
      sourceProjectId: "source-project",
    });

    expect(project.businessName).toBe("Cedar Cafe");
    expect(project.businessType).toBe("Coffee Shop");
    expect(project.heroEyebrow).toBeTruthy();
    expect(project.heroHeadline.length).toBeGreaterThan(8);
    expect(project.heroSubheadline.length).toBeGreaterThan(10);
    expect(project.primaryCta.length).toBeGreaterThan(2);
    expect(project.secondaryCta).toBeTruthy();
    expect(project.aboutTitle).toContain("Cedar Cafe");
    expect(project.description).toContain("espresso");
    expect(project.services.length).toBeGreaterThanOrEqual(1);
    expect(project.contact.email).toBe("hello@cedar.example");
    expect(project.contact.phone).toBe("(555) 111-2222");
    expect(project.primaryColor).toBe("#3db8a8");
    expect(project.accentColor).toBe("#102018");
    expect(project.templateId).toBe("modern");
    expect(project.status).toBe("ready");
    expect(project.goals.length).toBeGreaterThan(0);
    expect(project.pages.length).toBeGreaterThan(0);
    expect(project.mediaLibrary).toEqual([]);
    expect(project.publish).toBeNull();
    expect(meta.socialLinks.website).toContain("cedar.example");
    expect(meta.sourceProjectId).toBe("source-project");
    expect(meta.tone).toBe("friendly");
  });

  it("maps industry aliases and generated SEO / LocalBusiness", () => {
    expect(mapIndustryToBusinessType("Neighborhood Cafe")).toBe("Coffee Shop");
    expect(mapIndustryToBusinessType("Yoga studio")).toBe("Gym");
    expect(mapIndustryToBusinessType("Mystery Biz")).toBe("Other");

    const draft = sampleDraft();
    const seo = mapDraftToProjectSeo(draft, {
      address: "12 Main St, Portland, OR 97201",
    });
    expect(seo.siteTitle).toContain("Cedar Cafe");
    expect(seo.metaDescription.length).toBeGreaterThan(10);
    expect(seo.localBusiness.name).toBe("Cedar Cafe");
    expect(seo.localBusiness.streetAddress).toBe("12 Main St");
    expect(seo.localBusiness.addressLocality).toBe("Portland");
    expect(seo.localBusiness.phone).toBe(draft.contact.phone);
    expect(seo.localBusiness.email).toBe(draft.contact.email);
  });

  it("applies each tone’s design defaults when colors are omitted", () => {
    for (const tone of AI_BRAND_TONES) {
      const draft = sampleDraft();
      const { project } = mapDraftToBusinessProject({
        draft,
        questionnaire: completeAnswers({
          tone,
          primaryColor: "",
          accentColor: "",
        }),
      });
      const expected = designFromTone(tone);
      expect(project.templateId).toBe(expected.templateId);
      expect(project.headingFont).toBe(expected.headingFont);
      expect(project.bodyFont).toBe(expected.bodyFont);
      expect(project.buttonStyle).toBe(expected.buttonStyle);
      expect(project.siteWidth).toBe(expected.siteWidth);
    }
  });
});

describe("draft validation & safety", () => {
  it("rejects malformed / incomplete drafts", () => {
    expect(() => validateGeneratedWebsiteDraft(null)).toThrow(/required/i);
    expect(() => validateGeneratedWebsiteDraft({})).toThrow();
    expect(() =>
      validateGeneratedWebsiteDraft({
        ...sampleDraft(),
        services: [],
      }),
    ).toThrow(/services/i);
    expect(() =>
      validateGeneratedWebsiteDraft({
        ...sampleDraft(),
        contact: { ...sampleDraft().contact, email: "not-an-email" },
      }),
    ).toThrow(/email/i);
    expect(() => normalizeIdempotencyKey("")).toThrow(/idempotency/i);
    expect(normalizeIdempotencyKey(" abc-123 ")).toBe("abc-123");
  });

  it("sanitizes HTML from draft text", () => {
    const dirty = {
      ...sampleDraft(),
      heroHeadline: "<script>alert(1)</script>Welcome",
      aboutBody: "Safe <b>text</b> only",
    };
    const cleaned = validateGeneratedWebsiteDraft(dirty);
    expect(cleaned.heroHeadline).not.toContain("<script>");
    expect(cleaned.aboutBody).not.toContain("<b>");
  });
});

describe("generated project reload + publish compatibility", () => {
  it("round-trips through content columns and reloads editable fields", () => {
    const { project } = mapDraftToBusinessProject({
      draft: sampleDraft(),
      questionnaire: completeAnswers(),
    });
    const columns = businessProjectToColumns(project);
    const row = {
      id: "22222222-2222-4222-8222-222222222222",
      owner_id: "owner",
      name: columns.name,
      business_name: columns.business_name,
      business_type: columns.business_type,
      description: columns.description,
      goals: columns.goals,
      content: columns.content,
      branding: columns.branding,
      template: columns.template,
      media: columns.media,
      status: columns.status,
      published_url: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } satisfies ProjectRow;

    const reloaded = rowToBusinessProject(row);
    expect(reloaded.heroHeadline).toBe(project.heroHeadline);
    expect(reloaded.secondaryCta).toBe(project.secondaryCta);
    expect(reloaded.aboutTitle).toBe(project.aboutTitle);
    expect(reloaded.seo?.siteTitle).toBe(project.seo?.siteTitle);
    expect(reloaded.contact.email).toBe(project.contact.email);

    const content = generateWebsiteContent(reloaded);
    expect(content.hero.eyebrow).toBeTruthy();
    expect(content.hero.headline).toBe(project.heroHeadline);
    expect(content.hero.secondaryCta).toBe(project.secondaryCta);
    expect(content.about.title).toBe(project.aboutTitle);
  });

  it("builds a publishable static site from the mapped project", () => {
    const { project } = mapDraftToBusinessProject({
      draft: sampleDraft(),
      questionnaire: completeAnswers({ tone: "bold" }),
    });
    const artifact = buildStaticSite(project, {
      atlasOrigin: "https://atlas.example.com",
      projectId: "22222222-2222-4222-8222-222222222222",
      showAtlasBranding: true,
    });
    const html = artifact.files.find((f) => f.path === "index.html")!.content;
    expect(html).toContain(project.businessName);
    expect(html).toContain(project.heroHeadline);
    expect(html).toContain(project.primaryCta);
  });
});

describe("plan-limit behavior for AI create", () => {
  it("blocks create when usage is at the plan project limit", () => {
    const professional = featureFlagsForPlan("professional");
    const atLimit = evaluateUsage(professional, {
      projectCount: professional.maxProjects!,
      domainCount: 0,
    });
    expect(atLimit.canCreateProject).toBe(false);

    const underLimit = evaluateUsage(professional, {
      projectCount: professional.maxProjects! - 1,
      domainCount: 0,
    });
    expect(underLimit.canCreateProject).toBe(true);
  });
});

describe("create-project API + navigation contracts", () => {
  it("requires auth, rejects client owner_id, enforces idempotency + plan limits", () => {
    const src = readFileSync(
      resolve(__dirname, "../../app/api/ai/create-project/route.ts"),
      "utf8",
    );
    expect(src).toContain("unauthorized");
    expect(src).toContain("owner_id cannot be set by the client");
    expect(src).toContain("idempotencyKey");
    expect(src).toContain("createProjectFromDraft");
    expect(src).toContain("@/lib/ai/create-project-from-draft");
    expect(src).toContain("checkDomainRateLimit");
    expect(src).toContain("getRequestId");
    expect(src).not.toContain("createServiceRoleClient");
    expect(src).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
  });

  it("creation service uses idempotency table and soft plan checks", () => {
    const src = readFileSync(
      resolve(__dirname, "./create-project-from-draft.ts"),
      "utf8",
    );
    expect(src).toContain("ai_draft_creations");
    expect(src).toContain("idempotency_key");
    expect(src).toContain("plan_limit_projects");
    expect(src).toContain("assertCanCreateProject");
    expect(src).toContain("ensureLeadFormForOwner");
    expect(src).toContain('eq("owner_id", user.id)');
    expect(AI_CREATE_PROJECT_EDITOR_PATH).toBe("/editor");
  });

  it("questionnaire navigates to editor after create and clears local draft", () => {
    const src = readFileSync(
      resolve(__dirname, "../../components/ai/ai-questionnaire.tsx"),
      "utf8",
    );
    const preview = readFileSync(
      resolve(__dirname, "../../components/ai/ai-draft-preview.tsx"),
      "utf8",
    );
    const button = readFileSync(
      resolve(__dirname, "../../components/ai/ai-create-website-button.tsx"),
      "utf8",
    );
    expect(src).toContain("/api/ai/create-project");
    expect(src).toContain("idempotencyKey");
    expect(src).toContain("clearAiQuestionnaire");
    expect(src).toContain("openProject");
    expect(src).toContain("router.push");
    expect(src).toContain("AI_CREATE_PROJECT_EDITOR_PATH");
    expect(src).toContain("replaceExisting: false");
    expect(preview).toContain("AiCreateWebsiteButton");
    expect(button).toContain("Create Website in Editor");
  });

  it("migration defines unique owner+key idempotency", () => {
    const src = readFileSync(
      resolve(
        __dirname,
        "../../supabase/migrations/20260806_ai_draft_creations.sql",
      ),
      "utf8",
    );
    expect(src).toContain("ai_draft_creations");
    expect(src).toContain("primary key (owner_id, idempotency_key)");
    expect(src).toContain("enable row level security");
  });
});
