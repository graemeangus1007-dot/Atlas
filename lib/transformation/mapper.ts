/**
 * Deterministic TransformationGoal → validated EditOperation mapping.
 * No LLM ops. No direct BusinessProject mutation. Allowlist only.
 */

import { composeDesignPatterns } from "@/lib/ai/design-patterns/composition";
import type { EditOperation } from "@/lib/ai/edit-operations";
import {
  isExecutableHeroPatternId,
  planHeroPatternApplication,
  type ExecutableHeroPatternId,
} from "@/lib/ai/hero-pattern-application";
import { getEffectiveSectionOrder } from "@/lib/ai/section-order";
import type { GoalMappingResult } from "@/lib/transformation/execution-types";
import type {
  TransformationGoal,
  TransformationPlan,
  WebsiteVision,
} from "@/lib/transformation/types";
import {
  planPrimaryCtaRefinement,
} from "@/lib/conversion/primary-cta";
import type { BusinessProject } from "@/types/business-project";

const APPROVED_OPS = new Set<EditOperation["operation"]>([
  "applyHeroPattern",
  "setHeroOverlay",
  "insertSection",
  "moveSection",
  "setGalleryInteraction",
  "updateGalleryItemMetadata",
  "replaceText",
  "setCreativePolish",
  "setComponentSurface",
  "rewriteServices",
]);

function filterApproved(ops: EditOperation[]): EditOperation[] {
  return ops.filter((op) => APPROVED_OPS.has(op.operation));
}

function hasSection(project: BusinessProject, section: string): boolean {
  const order = getEffectiveSectionOrder(project);
  if (order.includes(section)) return true;
  if (section === "testimonials") {
    return Boolean(project.designSections?.testimonials?.length);
  }
  if (section === "faq") {
    return Boolean(project.designSections?.faq?.length);
  }
  if (section === "gallery") {
    return (project.designSections?.enabled ?? []).includes("gallery");
  }
  if (section === "bookingCta") {
    return Boolean(project.designSections?.bookingCta);
  }
  return false;
}

function galleryAssetCount(project: BusinessProject): number {
  return (project.galleryImageIds ?? []).filter(Boolean).length;
}

function libraryCount(project: BusinessProject): number {
  return (project.mediaLibrary ?? []).length;
}

function pickHeroPattern(
  project: BusinessProject,
  vision: WebsiteVision,
): ExecutableHeroPatternId | null {
  const composed = composeDesignPatterns({
    industry: project.businessType || vision.businessPositioning,
    businessDescription: project.description,
    hasHeroImage: Boolean(project.heroImageId),
    galleryFilledSlots: galleryAssetCount(project),
    libraryCount: libraryCount(project),
    hasTestimonials: hasSection(project, "testimonials"),
    primaryGoal: vision.conversionStrategy,
  });
  for (const id of composed.patternIds) {
    if (isExecutableHeroPatternId(id)) return id;
  }
  // Safe professional defaults by tone
  if (vision.agencyTones.includes("luxury") || vision.agencyTones.includes("premium")) {
    return "hero.premium_minimal";
  }
  if (
    /landscap|roof|plumb|electric|contractor|builder|gym/i.test(
      project.businessType,
    )
  ) {
    return "hero.contractor_left";
  }
  if (/coastal|marina|beach|water/i.test(project.description)) {
    return "hero.coastal_service";
  }
  return "hero.premium_minimal";
}

function industryCta(project: BusinessProject): string {
  const type = (project.businessType || "").toLowerCase();
  const current = (project.primaryCta || "").trim();
  const generic =
    !current ||
    /^(learn more|get started|contact us|click here|submit|book now)$/i.test(
      current,
    );
  if (!generic) return current;
  if (/law|attorney|legal/.test(type)) return "Schedule a consultation";
  if (/dental|dentist|clinic|medical/.test(type)) return "Book an appointment";
  if (/restaurant|cafe|bakery|dining/.test(type)) return "Reserve a table";
  if (/gym|fitness/.test(type)) return "Start your membership";
  if (/plumb|electric|roof|landscap|builder|contractor/.test(type)) {
    return "Get a free estimate";
  }
  return current || "Get in touch";
}

function proofBeforeContactOps(project: BusinessProject): EditOperation[] {
  const ops: EditOperation[] = [];
  const order = getEffectiveSectionOrder(project);
  const contactIdx = order.indexOf("contact");
  if (contactIdx < 0) return ops;

  for (const section of ["testimonials", "gallery", "faq"] as const) {
    if (!hasSection(project, section) && section !== "gallery") continue;
    if (section === "gallery" && !hasSection(project, "gallery")) continue;
    const idx = order.indexOf(section);
    if (idx < 0) continue;
    if (idx > contactIdx || idx === order.length - 1) {
      ops.push({
        operation: "moveSection",
        section,
        position: "before",
        relativeTo: "contact",
      });
    }
  }
  return ops;
}

/**
 * Map one transformation goal to approved operations (or a blocker).
 */
export function mapTransformationGoalToOperations(
  goal: TransformationGoal,
  project: BusinessProject,
  context: {
    plan: TransformationPlan;
    conflictBlocked: boolean;
    conflictReason?: string;
  },
): GoalMappingResult {
  if (context.conflictBlocked) {
    return {
      ok: false,
      status: "blocked_conflict",
      operations: [],
      reason:
        context.conflictReason ||
        "This goal conflicts with another part of the transformation plan.",
    };
  }

  if (goal.risk === "high") {
    return {
      ok: false,
      status: "deferred_high_risk",
      operations: [],
      reason: "High-risk goals stay deferred until a safer mapping exists.",
    };
  }

  switch (goal.id) {
    case "set_page_direction": {
      // Direction is captured in the plan vision; no brand rewrite.
      return {
        ok: true,
        status: "already_satisfied",
        operations: [],
        reason: "Page direction is established in the transformation vision.",
      };
    }

    case "strengthen_hero": {
      if (!project.heroImageId && libraryCount(project) === 0) {
        return {
          ok: false,
          status: "blocked_missing_asset",
          operations: [],
          reason: "A hero photograph is required before refining the first impression.",
        };
      }
      const patternId = pickHeroPattern(project, context.plan.vision);
      if (!patternId) {
        return {
          ok: false,
          status: "blocked_unsupported",
          operations: [],
          reason: "No supported hero pattern is available for this site.",
        };
      }
      const planned = planHeroPatternApplication({
        project,
        patternId,
        strategyContext: { patternIds: [patternId] },
      });
      if (planned.blocked) {
        return {
          ok: false,
          status: "blocked_unsupported",
          operations: [],
          reason: planned.blockReason || "Hero pattern could not be planned safely.",
        };
      }
      if (planned.alreadySatisfied) {
        return {
          ok: true,
          status: "already_satisfied",
          operations: [],
          reason: "Hero composition already matches the planned direction.",
        };
      }
      return {
        ok: true,
        status: "ready",
        operations: filterApproved(planned.operations),
      };
    }

    case "establish_trust": {
      if (hasSection(project, "testimonials")) {
        return {
          ok: true,
          status: "already_satisfied",
          operations: [],
          reason: "Testimonials are already on the page.",
        };
      }
      return {
        ok: true,
        status: "ready",
        operations: [{ operation: "insertSection", type: "testimonials" }],
      };
    }

    case "clarify_services": {
      const services = project.services ?? [];
      if (services.length === 0) {
        return {
          ok: false,
          status: "blocked_unsupported",
          operations: [],
          reason: "Services content is missing and cannot be invented safely.",
        };
      }
      const vague = services.filter(
        (s) => !(s.description || "").trim() || (s.description || "").length < 24,
      );
      if (vague.length === 0) {
        return {
          ok: true,
          status: "ready",
          operations: [
            {
              operation: "setCreativePolish",
              serviceIcons: true,
              visualHierarchy: true,
            },
          ],
        };
      }
      // Soft polish only — do not fabricate service copy.
      return {
        ok: true,
        status: "ready",
        operations: [
          {
            operation: "setCreativePolish",
            serviceIcons: true,
            visualHierarchy: true,
          },
        ],
      };
    }

    case "strengthen_proof": {
      const filled = galleryAssetCount(project);
      const ops: EditOperation[] = [];
      if (!hasSection(project, "gallery")) {
        if (filled === 0 && libraryCount(project) < 2) {
          return {
            ok: false,
            status: "blocked_missing_asset",
            operations: [],
            reason: "Project photography is required before strengthening visual proof.",
          };
        }
        ops.push({ operation: "insertSection", type: "gallery" });
      }
      if (filled > 0 || libraryCount(project) > 0) {
        ops.push({
          operation: "setGalleryInteraction",
          mode: "lightbox",
          navigation: true,
          captions: true,
        });
      }
      if (ops.length === 0) {
        return {
          ok: true,
          status: "already_satisfied",
          operations: [],
          reason: "Proof surfaces are already configured.",
        };
      }
      return { ok: true, status: "ready", operations: filterApproved(ops) };
    }

    case "sequence_proof_before_ask": {
      const ops = proofBeforeContactOps(project);
      if (ops.length === 0) {
        const hasProof =
          hasSection(project, "testimonials") || hasSection(project, "gallery");
        if (!hasProof) {
          return {
            ok: false,
            status: "blocked_unsupported",
            operations: [],
            reason: "Proof sections must exist before they can be sequenced.",
          };
        }
        return {
          ok: true,
          status: "already_satisfied",
          operations: [],
          reason: "Proof already appears before the contact ask.",
        };
      }
      return { ok: true, status: "ready", operations: filterApproved(ops) };
    }

    case "clarify_primary_cta": {
      const planned = planPrimaryCtaRefinement({ project });
      if (planned.disposition === "already_satisfied") {
        return {
          ok: true,
          status: "already_satisfied",
          operations: [],
          reason: "Primary CTA is already specific and appropriate.",
        };
      }
      if (planned.disposition !== "applyable" || !planned.plan) {
        return {
          ok: false,
          status: "blocked_missing_asset",
          operations: [],
          reason:
            planned.assessment.blockedReason ??
            "Primary CTA refinement needs a real destination on the site.",
        };
      }
      return {
        ok: true,
        status: "ready",
        operations: filterApproved(planned.plan.operations),
      };
    }

    case "simplify_conversion": {
      const ops: EditOperation[] = [];
      // Prefer verified Conversion Director CTA plan over heuristic industry labels.
      const planned = planPrimaryCtaRefinement({ project });
      if (planned.disposition === "applyable" && planned.plan) {
        ops.push(...planned.plan.operations);
      } else {
        const nextCta = industryCta(project);
        if (nextCta !== (project.primaryCta || "").trim()) {
          // Only apply heuristic when Conversion Director also considers it weak/generic.
          const generic =
            !project.primaryCta?.trim() ||
            /^(learn more|get started|contact us|click here|submit|book now)$/i.test(
              project.primaryCta.trim(),
            );
          if (generic && nextCta !== project.primaryCta?.trim()) {
            ops.push({
              operation: "replaceText",
              target: "hero.primaryCta",
              value: nextCta,
            });
          }
        }
      }
      ops.push({
        operation: "setCreativePolish",
        contactFormEnabled: true,
        visualHierarchy: true,
      });
      const contactBtn = (project.contact?.buttonText || "").trim();
      const ctaForButton =
        planned.plan?.label ||
        industryCta(project);
      if (!contactBtn || /submit|send/i.test(contactBtn)) {
        ops.push({
          operation: "replaceText",
          target: "contact.buttonText",
          value: ctaForButton,
        });
      }
      if (ops.length === 0) {
        return {
          ok: true,
          status: "already_satisfied",
          operations: [],
          reason: "Conversion path is already clear.",
        };
      }
      return { ok: true, status: "ready", operations: filterApproved(ops) };
    }

    case "improve_rhythm": {
      const spacing = project.creativePolish?.spacing;
      if (spacing === "comfortable" || spacing === "airy") {
        return {
          ok: true,
          status: "already_satisfied",
          operations: [],
          reason: "Spacing rhythm is already comfortable.",
        };
      }
      return {
        ok: true,
        status: "ready",
        operations: [
          {
            operation: "setCreativePolish",
            spacing: "comfortable",
            visualHierarchy: true,
          },
        ],
      };
    }

    case "tighten_messaging": {
      const sub = (project.heroSubheadline || "").trim();
      if (sub.length > 220) {
        const shortened =
          sub.slice(0, 180).replace(/\s+\S*$/, "").trim() + ".";
        return {
          ok: true,
          status: "ready",
          operations: [
            {
              operation: "replaceText",
              target: "hero.subheadline",
              value: shortened,
            },
          ],
        };
      }
      return {
        ok: true,
        status: "already_satisfied",
        operations: [],
        reason: "Messaging length is already within a readable range.",
      };
    }

    default: {
      return {
        ok: false,
        status: "blocked_unsupported",
        operations: [],
        reason: "No safe operation mapping exists for this goal yet.",
      };
    }
  }
}

/** Operations kinds used by the transformation allowlist (for diagnostics). */
export function approvedTransformationOperationKinds(): string[] {
  return [...APPROVED_OPS];
}
