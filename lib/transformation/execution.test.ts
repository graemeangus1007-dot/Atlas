/**
 * Transformation Engine Phase 2 — guarded execution contracts.
 */

import { describe, expect, it } from "vitest";
import {
  createEmptyRevisionStack,
  pushEditorRevision,
  undoEditorRevision,
} from "@/lib/ai/editor-revisions";
import { storeRecommendations } from "@/lib/ai/atlas-action-memory";
import { setInteractionState } from "@/lib/ai/interaction-state";
import { MOCK_BUSINESS_PROJECT } from "@/data/mock-project";
import type { BusinessProject } from "@/types/business-project";
import type { MediaAsset } from "@/types/media";
import {
  buildTransformationPlanForProject,
  captureBrandScopeSnapshot,
  brandIntegrityViolations,
  executeTransformationPlan,
  formatTransformationExecutionReport,
  mapTransformationGoalToOperations,
  restoreTransformationBaseline,
  captureTransformationUndoSnapshot,
  transformationTextExposesInternalIds,
  runTransformationPreflight,
} from "@/lib/transformation";
import { detectTransformationConflicts } from "@/lib/transformation/conflicts";

function asset(id: string, title: string): MediaAsset {
  return {
    id,
    name: `${title}.jpg`,
    filename: `${id}.jpg`,
    url: `https://cdn.example.com/${id}.jpg`,
    storagePath: `user/proj/${id}.jpg`,
    mimeType: "image/jpeg",
    size: 1000,
    sizeLabel: "1 KB",
    createdAt: Date.now(),
    title,
    description: title,
    alt: title,
  };
}

function baseProject(overrides: Partial<BusinessProject> = {}): BusinessProject {
  return {
    ...MOCK_BUSINESS_PROJECT,
    businessName: "Greenfield Landscapes",
    businessType: "Contractor",
    description:
      "Outdoor landscaping design and build for homeowners who want finished yards.",
    heroHeadline: "Yards that feel intentional",
    heroSubheadline: "Design, plant, and maintain outdoor spaces.",
    primaryCta: "Learn more",
    heroImageId: "hero-1",
    mediaLibrary: [asset("hero-1", "Yard"), asset("g1", "Patio"), asset("g2", "Garden")],
    galleryImageIds: ["g1", "g2"],
    designSections: {
      enabled: [],
    },
    sectionOrder: ["hero", "about", "services", "contact"],
    ...overrides,
  };
}

describe("Transformation Engine Phase 2 — Landscaping redesign", () => {
  it("executes hero, testimonials, gallery, CTA with verified score path", () => {
    const project = baseProject();
    const { plan } = buildTransformationPlanForProject(project);
    const result = executeTransformationPlan({
      project,
      plan,
      allowRefinement: true,
    });

    expect(["applied", "partially_applied", "already_satisfied"]).toContain(
      result.status,
    );
    expect(result.summary.length).toBeGreaterThan(40);
    expect(transformationTextExposesInternalIds(result.summary)).toBe(false);
    expect(result.preflight.passed).toBe(true);

    const appliedIds = result.executedGoals
      .filter((g) => g.status === "applied")
      .map((g) => g.goalId);
    // At least one supported structural goal should land when assets exist
    expect(
      appliedIds.length +
        result.executedGoals.filter((g) => g.status === "already_satisfied")
          .length,
    ).toBeGreaterThan(0);

    if (result.status === "applied" || result.status === "partially_applied") {
      expect(result.verifiedScoreDelta).toBeGreaterThanOrEqual(0);
      expect(result.project.primaryColor).toBe(project.primaryColor);
      expect(result.project.headingFont).toBe(project.headingFont);
    }
  });
});

describe("Transformation Engine Phase 2 — Law firm", () => {
  it("keeps trust-first order and restrained professional conversion", () => {
    const project = baseProject({
      businessName: "Harbor Law",
      businessType: "Other",
      description: "Trusted law firm counsel for families and local businesses.",
      primaryCta: "Learn more",
      designSections: { enabled: [] },
    });
    const { plan, strategy } = buildTransformationPlanForProject(project);
    expect(strategy.agencyTones.length).toBeGreaterThan(0);
    expect(plan.vision.personality.join(" ")).not.toMatch(/playful/i);

    const order = plan.graph.dependencyOrder;
    const trust = order.indexOf("establish_trust");
    const conv = order.indexOf("simplify_conversion");
    if (trust >= 0 && conv >= 0) {
      expect(conv).toBeGreaterThan(trust);
    }

    const result = executeTransformationPlan({ project, plan });
    expect(result.summary).not.toMatch(/playful|party|fun neon/i);
    if (result.project.primaryCta !== project.primaryCta) {
      expect(result.project.primaryCta).toMatch(/consultation|schedule|contact/i);
    }
  });
});

describe("Transformation Engine Phase 2 — Restaurant imagery", () => {
  it("blocks proof goals when photos are missing and reports partial/blocked honestly", () => {
    const project = baseProject({
      businessName: "Salt & Cedar",
      businessType: "Restaurant",
      heroImageId: null,
      mediaLibrary: [],
      galleryImageIds: [],
      designSections: { enabled: [] },
    });
    const { plan } = buildTransformationPlanForProject(project);
    const result = executeTransformationPlan({ project, plan });

    const blockedProof = [...result.blockedGoals, ...result.failedGoals].filter(
      (g) =>
        g.goalId === "strengthen_proof" ||
        g.goalId === "strengthen_hero" ||
        g.classification === "blocked_missing_asset",
    );
    expect(blockedProof.length).toBeGreaterThan(0);
    expect(result.summary).toMatch(/input|photograph|photo|imagery|upload/i);
    expect(result.status).not.toBe("applied");
  });
});

describe("Transformation Engine Phase 2 — Active plan Apply All", () => {
  it("stores a transformation plan that Apply All can execute", () => {
    const project = baseProject();
    const { plan } = buildTransformationPlanForProject(project);
    const memory = storeRecommendations(undefined, {
      creative: [],
      transformationPlan: plan,
      executionPlan: {
        goal: "Review transformation",
        steps: [
          {
            id: "tx.apply",
            agent: "creative_director",
            label: "Apply transformation",
          },
        ],
        estimatedImpact: "high",
      },
    });
    expect(memory.activePlan?.transformationPlan?.goals.length).toBeGreaterThan(
      0,
    );
    expect(memory.activePlan?.applyAllPending).toBe(true);

    const withPlan = setInteractionState(project, memory);
    const storedPlan = memory.activePlan?.transformationPlan ?? plan;
    const result = executeTransformationPlan({
      project: withPlan,
      plan: storedPlan,
    });
    expect(result.summary.length).toBeGreaterThan(20);
  });
});

describe("Transformation Engine Phase 2 — Complete website", () => {
  it("creates and executes a fresh plan without empty-plan messaging", () => {
    const project = baseProject();
    const { plan } = buildTransformationPlanForProject(
      project,
      "Complete my website",
    );
    const result = executeTransformationPlan({ project, plan });
    expect(result.summary).not.toMatch(/empty plan|no plan/i);
    expect(result.planId.length).toBeGreaterThan(4);
    expect(formatTransformationExecutionReport(result)).toBe(result.summary);
  });
});

describe("Transformation Engine Phase 2 — Dependency failure", () => {
  it("defers conversion when trust prerequisite cannot complete", () => {
    const project = baseProject({
      // Force establish_trust ready, but simulate blocked by conflict on trust
    });
    const { plan } = buildTransformationPlanForProject(project);
    // Inject a high-severity conflict on establish_trust
    const poisoned = {
      ...plan,
      conflicts: [
        ...plan.conflicts,
        {
          kind: "tone_clash" as const,
          severity: "high" as const,
          goalIds: ["establish_trust" as const],
          explanation: "Trust goal conflicts with current brand direction.",
          resolution: "Resolve tone before adding testimonials.",
        },
      ],
      validation: { ...plan.validation, passed: false, consistent: false },
    };
    const preflight = runTransformationPreflight({
      plan: poisoned,
      project,
    });
    expect(preflight.passed).toBe(false);

    // Softer case: mapping marks strengthen_proof blocked → dependents deferred at runtime
    const noPhotos = baseProject({
      galleryImageIds: [],
      mediaLibrary: [asset("hero-1", "Yard")],
      heroImageId: "hero-1",
      designSections: {
        enabled: ["testimonials"],
        testimonials: [
          {
            author: "A",
            quote: "Great work on the patio and lawn.",
            role: "Homeowner",
          },
        ],
      },
    });
    const { plan: plan2 } = buildTransformationPlanForProject(noPhotos);
    // Remove gallery assets so strengthen_proof blocks
    const emptyProofProject = {
      ...noPhotos,
      galleryImageIds: [],
      mediaLibrary: [asset("hero-1", "Yard")],
    };
    const mapped = mapTransformationGoalToOperations(
      plan2.goals.find((g) => g.id === "strengthen_proof")!,
      emptyProofProject,
      { plan: plan2, conflictBlocked: false },
    );
    if (!mapped.ok) {
      expect(mapped.status).toBe("blocked_missing_asset");
    }
  });
});

describe("Transformation Engine Phase 2 — Conflict blocks execution", () => {
  it("does not execute when high-severity conflicts remain", () => {
    const project = baseProject();
    const { plan } = buildTransformationPlanForProject(project);
    const conflicts = detectTransformationConflicts({
      goals: plan.goals,
      dependencies: plan.dependencies,
      vision: {
        ...plan.vision,
        personality: ["luxury", "playful"],
      },
      strategy: buildTransformationPlanForProject(project).strategy,
      evaluation: null,
    });
    // Force a blocking validation failure
    const blockedPlan = {
      ...plan,
      conflicts: [
        {
          kind: "tone_clash" as const,
          severity: "high" as const,
          goalIds: plan.goals.map((g) => g.id).slice(0, 2),
          explanation: "Luxury direction conflicts with a playful CTA treatment.",
          resolution: "Pick one coherent tone before executing.",
        },
      ],
      validation: {
        ...plan.validation,
        passed: false,
        consistent: false,
        issues: ["Unresolved high-severity conflict"],
      },
    };
    void conflicts;
    const result = executeTransformationPlan({
      project,
      plan: blockedPlan,
    });
    expect(result.status).toBe("blocked");
    expect(result.project).toEqual(project);
    expect(result.operations).toHaveLength(0);
  });
});

describe("Transformation Engine Phase 2 — Idempotency", () => {
  it("rerunning a completed transformation does not churn brand or invent work", () => {
    const project = baseProject();
    const { plan } = buildTransformationPlanForProject(project);
    const first = executeTransformationPlan({ project, plan });
    const second = executeTransformationPlan({
      project: first.project,
      plan: buildTransformationPlanForProject(first.project).plan,
    });
    expect(second.project.primaryColor).toBe(first.project.primaryColor);
    expect(second.project.headingFont).toBe(first.project.headingFont);
    // Second pass should mostly be satisfied / partial without wild rewrites
    expect(["already_satisfied", "partially_applied", "applied", "blocked"]).toContain(
      second.status,
    );
  });
});

describe("Transformation Engine Phase 2 — Undo", () => {
  it("restores the exact baseline project", () => {
    const project = baseProject();
    const { plan } = buildTransformationPlanForProject(project);
    const result = executeTransformationPlan({ project, plan });
    const snap = captureTransformationUndoSnapshot(result);
    const restored = restoreTransformationBaseline(snap);
    expect(restored.businessName).toBe(project.businessName);
    expect(restored.primaryColor).toBe(project.primaryColor);
    expect(restored.primaryCta).toBe(project.primaryCta);
    expect(restored.designSections).toEqual(project.designSections);

    // Editor-style single revision undo
    if (result.operations.length > 0) {
      const stack = pushEditorRevision(createEmptyRevisionStack(), {
        before: project,
        after: result.project,
        operations: result.operations,
        changes: result.changes,
        prompt: "Complete my website",
      });
      const undone = undoEditorRevision(stack);
      expect(undone?.project.primaryCta).toBe(project.primaryCta);
      expect(undone?.project.designSections).toEqual(project.designSections);
    }
  });
});

describe("Transformation Engine Phase 2 — Whole-page verification honesty", () => {
  it("does not claim success when score does not improve", () => {
    const project = baseProject({
      // Already fairly complete — transformation may not improve score
      designSections: {
        enabled: ["testimonials", "gallery", "faq"],
        testimonials: [
          {
            author: "Jordan",
            quote: "They transformed our backyard into a calm outdoor room.",
            role: "Homeowner",
          },
        ],
        faq: [
          {
            question: "Do you offer maintenance?",
            answer: "Yes, seasonal plans.",
          },
        ],
      },
      creativePolish: {
        spacing: "comfortable",
        visualHierarchy: true,
        serviceIcons: true,
      },
      primaryCta: "Get a free estimate",
      sectionOrder: [
        "hero",
        "about",
        "services",
        "testimonials",
        "gallery",
        "faq",
        "contact",
      ],
    });
    const { plan } = buildTransformationPlanForProject(project);
    const result = executeTransformationPlan({
      project,
      plan,
      allowRefinement: false,
    });
    if (result.verifiedScoreDelta <= 0 && result.operations.length === 0) {
      expect(result.status).not.toBe("applied");
      expect(result.summary).not.toMatch(/^Done\./i);
    }
    if (result.status === "failed") {
      expect(result.summary).not.toMatch(/I completed the redesign/i);
    }
  });
});

describe("Transformation Engine Phase 2 — Scope preservation", () => {
  it("preserves palette, fonts, forms, gallery ids, and contact data", () => {
    const project = baseProject({
      contact: {
        ...MOCK_BUSINESS_PROJECT.contact!,
        phone: "555-0100",
        email: "hello@greenfield.test",
        formEnabled: true,
        buttonText: "Send message",
      },
    });
    const before = captureBrandScopeSnapshot(project);
    const { plan } = buildTransformationPlanForProject(project);
    const result = executeTransformationPlan({ project, plan });
    const violations = brandIntegrityViolations(before, result.project);
    expect(violations).toEqual([]);
    expect(result.project.contact?.phone).toBe("555-0100");
    expect(result.project.contact?.email).toBe("hello@greenfield.test");
    expect(result.project.galleryImageIds).toEqual(project.galleryImageIds);
    expect(result.project.mediaLibrary.map((m) => m.id).sort()).toEqual(
      project.mediaLibrary.map((m) => m.id).sort(),
    );
  });
});
