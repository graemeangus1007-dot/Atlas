import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  EMPTY_AI_QUESTIONNAIRE,
  type AiQuestionnaireAnswers,
} from "@/components/ai/ai-types";
import { buildMockWebsiteDraft } from "@/lib/ai/mock-provider";
import { questionnaireToGenerateInput } from "@/lib/ai/questionnaire-map";
import {
  mapDraftToBusinessProject,
  resolveGenerateIdentity,
} from "@/lib/ai";
import {
  clearAiQuestionnaire,
  clearAiQuestionnaireSnapshotCache,
  getAiQuestionnaireSnapshot,
  loadAiQuestionnaire,
  saveAiQuestionnaire,
} from "@/lib/ai/questionnaire-storage";
import {
  isAiQuestionnaireComplete,
  splitServiceLines,
  validateAiQuestionnaireStep,
} from "@/lib/ai/questionnaire-validation";

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
    address: "12 Main St",
    website: "https://cedar.example",
    facebook: "cedarcafe",
    instagram: "@cedarcafe",
    ...overrides,
  };
}

describe("AI questionnaire validation", () => {
  it("requires business fields", () => {
    const errors = validateAiQuestionnaireStep(
      "business",
      EMPTY_AI_QUESTIONNAIRE,
    );
    expect(errors.businessName).toBeTruthy();
    expect(errors.industry).toBeTruthy();
    expect(errors.oneSentenceDescription).toBeTruthy();
    expect(errors.yearsInBusiness).toBeTruthy();
  });

  it("accepts a complete questionnaire", () => {
    expect(isAiQuestionnaireComplete(completeAnswers())).toBe(true);
  });

  it("rejects invalid email and colors", () => {
    const contact = validateAiQuestionnaireStep(
      "contact",
      completeAnswers({ email: "not-an-email" }),
    );
    expect(contact.email).toMatch(/valid email/i);

    const branding = validateAiQuestionnaireStep(
      "branding",
      completeAnswers({ primaryColor: "teal", tone: "" }),
    );
    expect(branding.primaryColor).toBeTruthy();
    expect(branding.tone).toBeTruthy();
  });

  it("splits service lines", () => {
    expect(splitServiceLines("A\nB, C")).toEqual(["A", "B", "C"]);
  });
});

describe("AI questionnaire autosave & resume", () => {
  afterEach(() => {
    clearAiQuestionnaire("proj-1");
    clearAiQuestionnaireSnapshotCache();
    vi.unstubAllGlobals();
  });

  function stubStorage() {
    const store = new Map<string, string>();
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => {
          store.set(k, v);
        },
        removeItem: (k: string) => {
          store.delete(k);
        },
      },
      dispatchEvent: () => true,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    });
    return store;
  }

  it("saves and resumes progress per project", () => {
    stubStorage();

    const answers = completeAnswers();
    saveAiQuestionnaire({
      projectId: "proj-1",
      stepIndex: 2,
      answers,
    });

    const loaded = loadAiQuestionnaire("proj-1");
    expect(loaded).not.toBeNull();
    expect(loaded?.stepIndex).toBe(2);
    expect(loaded?.answers.businessName).toBe("Cedar Cafe");
    expect(loaded?.answers.tone).toBe("friendly");

    expect(loadAiQuestionnaire("other-project")).toBeNull();
  });

  it("returns a referentially stable snapshot when storage is unchanged", () => {
    stubStorage();
    saveAiQuestionnaire({
      projectId: "proj-1",
      stepIndex: 1,
      answers: completeAnswers(),
    });

    const first = getAiQuestionnaireSnapshot("proj-1");
    const second = getAiQuestionnaireSnapshot("proj-1");
    expect(first).not.toBeNull();
    expect(second).toBe(first);

    // Identical save must not churn the snapshot (no write / no event loop).
    const saved = saveAiQuestionnaire({
      projectId: "proj-1",
      stepIndex: 1,
      answers: completeAnswers(),
    });
    expect(saved).toBe(first);
    expect(getAiQuestionnaireSnapshot("proj-1")).toBe(first);
  });
});

describe("questionnaire → generate mapping & mock draft", () => {
  it("maps answers into generate input", () => {
    const input = questionnaireToGenerateInput("proj-1", completeAnswers());
    expect(input.projectId).toBe("proj-1");
    expect(input.businessName).toBe("Cedar Cafe");
    expect(input.businessType).toBe("Coffee Shop");
    expect(input.questionnaire?.businessName).toBe("Cedar Cafe");
    expect(input.questionnaire?.primaryServices).toEqual([
      "Espresso",
      "Pastries",
      "Catering",
    ]);
    expect(input.questionnaire?.phone).toBe("(555) 111-2222");
  });

  it("mock generation uses questionnaire services and contact", () => {
    const input = questionnaireToGenerateInput("proj-1", completeAnswers());
    const draft = buildMockWebsiteDraft(input);
    expect(draft.services[0]?.title).toBe("Espresso");
    expect(draft.contact.phone).toBe("(555) 111-2222");
    expect(draft.contact.email).toBe("hello@cedar.example");
    expect(draft.heroSubheadline).toMatch(/Remote workers/);
    expect(draft.primaryCta).toBe("Say hello");
  });

  it("preserves Northforge Digital over context project Atlas Digital", () => {
    const answers = completeAnswers({
      businessName: "Northforge Digital",
      industry: "Web Design Agency",
      oneSentenceDescription:
        "We build modern websites for local businesses.",
      primaryServices: "Websites\nBranding\nSEO",
      phone: "(555) 999-0001",
      email: "hello@northforge.example",
      address: "100 Harbor Ave, Portland, OR",
      website: "https://northforge.example",
      facebook: "northforgedigital",
      instagram: "@northforge",
      primaryColor: "#1a6b5c",
      accentColor: "#0b1f1a",
    });

    const input = questionnaireToGenerateInput("atlas-project", answers);
    // Simulate API merge where context project has a different name.
    const identity = resolveGenerateIdentity(
      {
        businessName: input.businessName,
        businessType: input.businessType,
        description: input.description,
        questionnaire: input.questionnaire,
      },
      {
        business_name: "Atlas Digital",
        business_type: "Other",
        description: "Old project description",
      },
    );
    expect(identity.businessName).toBe("Northforge Digital");
    expect(identity.businessName).not.toBe("Atlas Digital");

    const draft = buildMockWebsiteDraft({
      ...input,
      businessName: identity.businessName,
      businessType: identity.businessType,
      description: identity.description,
    });
    expect(draft.businessName).toBe("Northforge Digital");
    expect(draft.heroHeadline).toContain("Northforge Digital");
    expect(draft.heroHeadline).not.toContain("Atlas Digital");
    expect(draft.aboutTitle).toContain("Northforge Digital");
    expect(draft.services.map((s) => s.title)).toEqual([
      "Websites",
      "Branding",
      "SEO",
    ]);
    expect(draft.contact.phone).toBe("(555) 999-0001");
    expect(draft.contact.email).toBe("hello@northforge.example");
    expect(draft.contact.location).toBe("100 Harbor Ave, Portland, OR");

    const { project, meta } = mapDraftToBusinessProject({
      draft,
      questionnaire: answers,
    });
    expect(project.businessName).toBe("Northforge Digital");
    expect(project.contact.phone).toBe("(555) 999-0001");
    expect(project.contact.email).toBe("hello@northforge.example");
    expect(project.primaryColor).toBe("#1a6b5c");
    expect(project.accentColor).toBe("#0b1f1a");
    expect(meta.socialLinks.website).toContain("northforge.example");
    expect(meta.socialLinks.facebook).toBe("northforgedigital");
    expect(meta.socialLinks.instagram).toBe("@northforge");
  });

  it("uses nested questionnaire businessName when top-level is blank", () => {
    const draft = buildMockWebsiteDraft({
      projectId: "p1",
      businessName: "",
      businessType: "",
      description: "",
      questionnaire: {
        businessName: "Northforge Digital",
        businessType: "Agency",
        description: "Custom sites for local brands.",
        phone: "(555) 222-3333",
        email: "team@northforge.example",
        address: "Portland, OR",
        primaryServices: ["Strategy"],
      },
    });
    expect(draft.businessName).toBe("Northforge Digital");
    expect(draft.businessType).toBe("Agency");
    expect(draft.description).toContain("Custom sites");
    expect(draft.contact.phone).toBe("(555) 222-3333");
    expect(draft.services[0]?.title).toBe("Strategy");
  });
});

describe("AI questionnaire UI & API contracts", () => {
  it("generate route accepts questionnaire payload", () => {
    const src = readFileSync(
      resolve(__dirname, "../../app/api/ai/generate/route.ts"),
      "utf8",
    );
    expect(src).toContain("questionnaire");
    expect(src).toContain("resolveGenerateIdentity");
    expect(src).toContain("unauthorized");
    expect(src).toContain('eq("owner_id", user.id)');
  });

  it("questionnaire wizard wires generate + loading + a11y labels", () => {
    const wizard = readFileSync(
      resolve(__dirname, "../../components/ai/ai-questionnaire.tsx"),
      "utf8",
    );
    expect(wizard).toContain("/api/ai/generate");
    expect(wizard).toContain("Creating your website draft");
    expect(wizard).toContain("saveAiQuestionnaire");
    expect(wizard).toContain("useSyncExternalStore");
    expect(wizard).toContain("getAiQuestionnaireSnapshot");
    expect(wizard).toContain("subscribeAiQuestionnaire");
    expect(wizard).not.toMatch(
      /useSyncExternalStore\(\s*subscribeQuestionnaire,\s*\(\)\s*=>\s*loadAiQuestionnaire/,
    );

    const business = readFileSync(
      resolve(__dirname, "../../components/ai/ai-step-business.tsx"),
      "utf8",
    );
    expect(business).toContain('label="Business name"');
    expect(business).toContain("aria-invalid");
    expect(business).toContain('role="alert"');
    expect(business).toContain('id="ai-business-name"');

    const textInput = readFileSync(
      resolve(__dirname, "../../components/ui/text-input.tsx"),
      "utf8",
    );
    expect(textInput).toContain("htmlFor");

    const branding = readFileSync(
      resolve(__dirname, "../../components/ai/ai-step-branding.tsx"),
      "utf8",
    );
    expect(branding).toContain('role="radiogroup"');
    expect(branding).toContain("Upload logo (coming soon)");

    const generateBtn = readFileSync(
      resolve(__dirname, "../../components/ai/ai-generate-button.tsx"),
      "utf8",
    );
    expect(generateBtn).toContain("Generating website");
    expect(generateBtn).toContain("aria-busy");
  });
});
