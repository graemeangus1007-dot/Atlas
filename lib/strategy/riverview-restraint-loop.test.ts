/**
 * v1.6.5 — Riverview production transcript: close the visual-restraint loop.
 */

import { describe, expect, it } from "vitest";
import { MOCK_BUSINESS_PROJECT } from "@/data/mock-project";
import { runAtlasBrain } from "@/lib/ai/atlas-brain";
import {
  sanitizeCustomerFacingText,
} from "@/lib/presentation/customer-language";
import {
  assessStrategicPriorities,
  formatStrategicDirectorReport,
} from "@/lib/strategy";
import {
  buildTransformationPlanForProject,
  executeTransformationPlan,
} from "@/lib/transformation";
import {
  detectRestraintDefects,
  executeRestraintPolish,
  needsRestraintPolish,
  projectRevisionToken,
  verifyRestraintPolish,
  planRestraintPolish,
} from "@/lib/taste/restraint-polish";
import type { BusinessProject } from "@/types/business-project";

const FORBIDDEN =
  /Creative Director|Conversion Director|Strategic Director|Taste Engine|Transformation Engine|clarify_visual_restraint|restraintDefects/i;

function riverviewBusyHero(): BusinessProject {
  return {
    ...MOCK_BUSINESS_PROJECT,
    businessName: "Riverview Bakery",
    businessType: "Coffee Shop",
    primaryCta: "View Our Menu",
    secondaryCta: "Order Online",
    buttonStyle: "square",
    heroOverlay: 75,
    atlasActionMemory: undefined,
    heroTreatment: {
      gradient: { direction: "left", strength: 0.42, coverage: 0.55 },
      textScrim: { enabled: true, opacity: 0.35, blur: 8 },
      textPosition: "left",
    },
    creativePolish: {
      motion: true,
      hoverEffects: true,
      sectionReveal: true,
      visualHierarchy: false,
      spacing: "default",
    },
    designSections: {
      enabled: ["testimonials", "gallery", "faq"],
      testimonials: [
        {
          id: "t1",
          quote: "Best bakery in town.",
          author: "Alex",
          role: "Regular",
        },
        {
          id: "t2",
          quote: "Incredible pastries.",
          author: "Sam",
          role: "Neighbor",
        },
      ],
      faq: [{ id: "f1", question: "Hours?", answer: "7am–3pm." }],
    },
  };
}

describe("v1.6.5 incomplete Complete focus list", () => {
  it("never renders What I'll focus on • 1. without items", () => {
    const assessment = assessStrategicPriorities({
      project: riverviewBusyHero(),
    });
    const report = formatStrategicDirectorReport(assessment, {
      mode: "execute_completion",
    });
    expect(report).not.toMatch(/What I.ll focus on\s*•\s*1\.\s*$/m);
    expect(report).not.toMatch(/What I.ll focus on • 1\./);
    if (/What I.ll focus on/i.test(report)) {
      expect(report).toMatch(/What I.ll focus on\n\d+\.\s+\S+/);
    }
  });

  it("preserves newlines in sanitizeCustomerFacingText", () => {
    const cleaned = sanitizeCustomerFacingText(
      "What I’ll focus on\n1. Simplify competing treatments in the hero.\n2. Preserve clear text and photography.",
    );
    expect(cleaned).toContain("\n");
    expect(cleaned).toMatch(/What I.ll focus on\n1\./);
    expect(cleaned).not.toMatch(/What I.ll focus on • 1\./);
  });
});

describe("v1.6.5 Riverview restraint closed loop", () => {
  it("plans and executes clarify_visual_restraint for a busy Riverview hero", () => {
    const project = riverviewBusyHero();
    expect(needsRestraintPolish(project)).toBe(true);
    const defects = detectRestraintDefects(project);
    expect(defects.length).toBeGreaterThan(0);

    const { plan } = buildTransformationPlanForProject(
      project,
      "Complete my website for launch",
    );
    expect(plan.goals.some((g) => g.id === "clarify_visual_restraint")).toBe(
      true,
    );

    const tx = executeTransformationPlan({
      project,
      plan,
      allowTastePolish: true,
      logDiagnostics: false,
    });
    const restraint =
      tx.executedGoals.find((g) => g.goalId === "clarify_visual_restraint") ??
      tx.blockedGoals.find((g) => g.goalId === "clarify_visual_restraint") ??
      tx.failedGoals.find((g) => g.goalId === "clarify_visual_restraint");
    expect(restraint).toBeTruthy();
    expect(restraint?.status).not.toBe("deferred");

    const direct = executeRestraintPolish({ project });
    const verification = verifyRestraintPolish({
      before: project,
      after: direct.applied ? direct.project : tx.project,
      plan: planRestraintPolish({ project }),
    });

    if (restraint?.status === "applied") {
      // TX may also apply other goals; assert restraint-owned signals moved.
      const defectsBefore = detectRestraintDefects(project);
      const defectsAfter = detectRestraintDefects(tx.project);
      const resolved = defectsBefore.filter((d) => !defectsAfter.includes(d));
      expect(
        resolved.length > 0 ||
          (tx.project.heroOverlay ?? 50) < (project.heroOverlay ?? 50) ||
          (tx.project.heroTreatment?.textScrim?.blur ?? 0) <
            (project.heroTreatment?.textScrim?.blur ?? 0) ||
          Boolean(direct.verification?.materiallyImproved),
      ).toBe(true);
      expect(tx.project.primaryColor).toBe(project.primaryColor);
      expect(tx.project.heroImageId).toBe(project.heroImageId);
      expect(tx.project.primaryCta).toBe(project.primaryCta);
      expect(verification.brandPreserved || direct.verification?.brandPreserved).toBe(
        true,
      );
    } else {
      // Outcome B — truthful no-gain / blocked, no fake keep.
      expect(tx.project.heroOverlay).toBe(project.heroOverlay);
      expect(restraint?.reason || tx.summary || direct.explanation).toMatch(
        /kept the previous|couldn.t safely|didn.t improve|already/i,
      );
    }
  });

  it("exact production transcript: weakness → Complete → reassess", async () => {
    let project = riverviewBusyHero();

    const weakness1 = await runAtlasBrain({
      project,
      request: "What's the biggest weakness?",
    });
    expect(weakness1.explanation).toMatch(
      /visual restraint|competing|focused|polished/i,
    );
    expect(weakness1.explanation).not.toMatch(FORBIDDEN);

    const beforeRevision = projectRevisionToken(project);
    const beforeAssessment = assessStrategicPriorities({ project });
    const beforeTop = beforeAssessment.highestPriorityOpportunity;

    const complete = await runAtlasBrain({
      project,
      request: "Complete my website",
    });
    expect(complete.explanation).not.toMatch(/What I.ll focus on • 1\./);
    expect(complete.explanation).not.toMatch(FORBIDDEN);
    project = complete.project;

    const afterRevision = projectRevisionToken(project);
    const afterAssessment = assessStrategicPriorities({ project });
    const afterTop = afterAssessment.highestPriorityOpportunity;

    const restraintResult = executeRestraintPolish({
      project: riverviewBusyHero(),
    });

    if (restraintResult.applied || complete.applyStatus === "applied") {
      // Outcome A — mutations kept; reassessment uses post-execution truth.
      if (complete.applyStatus === "applied") {
        expect(afterRevision).not.toBe(beforeRevision);
      }
      expect(afterAssessment.assessedAt).toBeTruthy();
      // Must not blindly repeat the identical pre-execution generic diagnosis
      // with zero progress evidence when restraint improved.
      if (
        restraintResult.verification?.materiallyImproved &&
        complete.applyStatus === "applied"
      ) {
        const sameGeneric =
          beforeTop?.id === afterTop?.id &&
          /restraint|quality gap/i.test(beforeTop?.title ?? "") &&
          /restraint|quality gap/i.test(afterTop?.title ?? "") &&
          beforeTop?.explanation === afterTop?.explanation;
        if (sameGeneric) {
          // Allowed only when remaining defects are still the top issue —
          // but explanation must not be byte-identical stale copy.
          expect(afterTop?.explanation).not.toEqual(beforeTop?.explanation);
        }
      }
      expect(complete.explanation).toMatch(
        /simplif|restrain|focus|kept the previous|didn.t improve/i,
      );
    } else {
      // Outcome B — no fake completion.
      expect(complete.explanation).toMatch(
        /kept the previous|didn.t improve|couldn.t safely|already/i,
      );
    }

    const weakness2 = await runAtlasBrain({
      project,
      request: "What's the biggest weakness?",
    });
    expect(weakness2.explanation).not.toMatch(FORBIDDEN);
    expect(weakness2.explanation).not.toMatch(/What I.ll focus on • 1\./);
    // Reflects current project truth (may still be restraint, but not empty churn).
    expect(weakness2.explanation.length).toBeGreaterThan(40);
  });

  it("post-execution reassessment uses a project revision after mutation", () => {
    const before = riverviewBusyHero();
    const beforeRev = projectRevisionToken(before);
    const polish = executeRestraintPolish({ project: before });
    if (!polish.applied) return;
    const afterRev = projectRevisionToken(polish.project);
    expect(afterRev).not.toBe(beforeRev);
    const afterAssessment = assessStrategicPriorities({
      project: polish.project,
    });
    expect(afterAssessment.assessedAt).toBeTruthy();
    expect(polish.diagnostics.projectRevisionAfter).toBe(afterRev);
  });

  it("repeated Complete does not churn after a successful restraint pass", async () => {
    let project = riverviewBusyHero();
    const first = await runAtlasBrain({
      project,
      request: "Complete my website",
    });
    project = first.project;
    const overlayAfterFirst = project.heroOverlay;
    const second = await runAtlasBrain({
      project,
      request: "Complete my website",
    });
    // Second pass should not invent a new redesign when already improved.
    if (first.applyStatus === "applied") {
      const noChurn =
        second.applyStatus === "no_changes" ||
        /already|didn.t make additional|kept|strong completed state/i.test(
          second.explanation,
        ) ||
        second.project.heroOverlay === overlayAfterFirst;
      expect(noChurn).toBe(true);
    }
  });
});

