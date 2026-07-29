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
  subscribeAiQuestionnaire,
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
    clearAiQuestionnaire("proj-2");
    clearAiQuestionnaireSnapshotCache();
    vi.unstubAllGlobals();
  });

  function stubStorage() {
    const store = new Map<string, string>();
    const listeners = new Map<string, Set<EventListenerOrEventListenerObject>>();
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
      dispatchEvent: (event: Event) => {
        const set = listeners.get(event.type);
        if (set) {
          for (const listener of set) {
            if (typeof listener === "function") listener(event);
            else listener.handleEvent(event);
          }
        }
        return true;
      },
      addEventListener: (
        type: string,
        listener: EventListenerOrEventListenerObject,
      ) => {
        if (!listeners.has(type)) listeners.set(type, new Set());
        listeners.get(type)!.add(listener);
      },
      removeEventListener: (
        type: string,
        listener: EventListenerOrEventListenerObject,
      ) => {
        listeners.get(type)?.delete(listener);
      },
    });
    return store;
  }

  it("saves and resumes progress per project", () => {
    stubStorage();

    const answers = completeAnswers();
    const { progress } = saveAiQuestionnaire({
      projectId: "proj-1",
      stepIndex: 2,
      answers,
    });

    expect(progress.revision).toBe(1);
    const loaded = loadAiQuestionnaire("proj-1");
    expect(loaded).not.toBeNull();
    expect(loaded?.stepIndex).toBe(2);
    expect(loaded?.answers.businessName).toBe("Cedar Cafe");
    expect(loaded?.answers.tone).toBe("friendly");

    expect(loadAiQuestionnaire("other-project")).toBeNull();
  });

  it("returns a referentially stable snapshot when storage is unchanged", () => {
    stubStorage();
    const { progress: first } = saveAiQuestionnaire({
      projectId: "proj-1",
      stepIndex: 1,
      answers: completeAnswers(),
    });

    const second = getAiQuestionnaireSnapshot("proj-1");
    expect(first).not.toBeNull();
    expect(second).toBe(first);

    // Identical save must not churn the snapshot (no write / no event loop).
    const saved = saveAiQuestionnaire({
      projectId: "proj-1",
      stepIndex: 1,
      answers: completeAnswers(),
    });
    expect(saved.progress).toBe(first);
    expect(saved.wrote).toBe(false);
    expect(getAiQuestionnaireSnapshot("proj-1")).toBe(first);
  });

  it("flushes a pending draft before debounce when forced save runs", () => {
    stubStorage();
    vi.useFakeTimers();
    try {
      // Simulate tab A typing (would be debounced in UI) then flushing.
      const first = saveAiQuestionnaire({
        projectId: "proj-1",
        stepIndex: 0,
        answers: completeAnswers({ businessName: "Partial" }),
      });
      expect(first.wrote).toBe(true);

      const second = saveAiQuestionnaire({
        projectId: "proj-1",
        stepIndex: 1,
        answers: completeAnswers({ businessName: "Flushed Cafe" }),
        baseRevision: first.progress.revision,
        baseUpdatedAt: first.progress.updatedAt,
      });
      expect(second.wrote).toBe(true);
      expect(loadAiQuestionnaire("proj-1")?.answers.businessName).toBe(
        "Flushed Cafe",
      );
      expect(loadAiQuestionnaire("proj-1")?.stepIndex).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("notifies subscribers when another tab saves (storage event key filter)", () => {
    stubStorage();
    let calls = 0;
    const unsub = subscribeAiQuestionnaire("proj-1", () => {
      calls += 1;
    });

    saveAiQuestionnaire({
      projectId: "proj-1",
      stepIndex: 0,
      answers: completeAnswers({ businessName: "Tab B" }),
    });
    expect(calls).toBeGreaterThan(0);

    const before = calls;
    // Unrelated storage key must not notify
    const unrelated = new Event("storage") as Event & { key: string };
    unrelated.key = "unrelated-key";
    window.dispatchEvent(unrelated);
    expect(calls).toBe(before);

    unsub();
  });

  it("rejects stale tab writes so they cannot overwrite newer data", () => {
    stubStorage();
    const newer = saveAiQuestionnaire({
      projectId: "proj-1",
      stepIndex: 2,
      answers: completeAnswers({ businessName: "Newest" }),
    });
    expect(newer.progress.revision).toBe(1);

    const stale = saveAiQuestionnaire({
      projectId: "proj-1",
      stepIndex: 0,
      answers: completeAnswers({ businessName: "Stale" }),
      baseRevision: 0,
      baseUpdatedAt: "2000-01-01T00:00:00.000Z",
    });
    expect(stale.rejectedStale).toBe(true);
    expect(stale.wrote).toBe(false);
    expect(loadAiQuestionnaire("proj-1")?.answers.businessName).toBe("Newest");
    expect(loadAiQuestionnaire("proj-1")?.revision).toBe(1);
  });

  it("refresh restores the latest draft snapshot", () => {
    stubStorage();
    saveAiQuestionnaire({
      projectId: "proj-1",
      stepIndex: 3,
      answers: completeAnswers({ businessName: "After Refresh" }),
    });
    clearAiQuestionnaireSnapshotCache();
    const restored = loadAiQuestionnaire("proj-1");
    expect(restored?.answers.businessName).toBe("After Refresh");
    expect(restored?.stepIndex).toBe(3);
  });

  it("keeps project drafts isolated", () => {
    stubStorage();
    saveAiQuestionnaire({
      projectId: "proj-1",
      stepIndex: 1,
      answers: completeAnswers({ businessName: "Project One" }),
    });
    saveAiQuestionnaire({
      projectId: "proj-2",
      stepIndex: 2,
      answers: completeAnswers({ businessName: "Project Two" }),
    });
    expect(loadAiQuestionnaire("proj-1")?.answers.businessName).toBe(
      "Project One",
    );
    expect(loadAiQuestionnaire("proj-2")?.answers.businessName).toBe(
      "Project Two",
    );
    clearAiQuestionnaire("proj-1");
    expect(loadAiQuestionnaire("proj-1")).toBeNull();
    expect(loadAiQuestionnaire("proj-2")?.answers.businessName).toBe(
      "Project Two",
    );
  });

  it("successful creation clearing only removes the completed project draft", () => {
    stubStorage();
    saveAiQuestionnaire({
      projectId: "proj-1",
      stepIndex: 5,
      answers: completeAnswers({ businessName: "Done" }),
    });
    saveAiQuestionnaire({
      projectId: "proj-2",
      stepIndex: 1,
      answers: completeAnswers({ businessName: "Other" }),
    });
    clearAiQuestionnaire("proj-1");
    expect(loadAiQuestionnaire("proj-1")).toBeNull();
    expect(loadAiQuestionnaire("proj-2")?.answers.businessName).toBe("Other");
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
    expect(draft.heroSubheadline).toMatch(/remote workers/i);
    expect(draft.primaryCta.length).toBeGreaterThan(2);
    expect(draft.layoutPreset.id).toBe("friendly");
    expect(draft.enabledSections).toContain("gallery");
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
    expect(draft.heroEyebrow).toContain("Northforge Digital");
    expect(draft.heroHeadline.length).toBeGreaterThan(8);
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
    expect(wizard).toContain("visibilitychange");
    expect(wizard).toContain("pagehide");
    expect(wizard).toContain("Updated in another tab");
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
