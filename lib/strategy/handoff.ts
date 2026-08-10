/**
 * Strategic Director → Transformation Engine completion handoff.
 * Strategic Director never mutates the project; Transformation applies.
 */

import type { StrategicAssessment } from "@/lib/strategy/types";
import type { TransformationExecutionResult } from "@/lib/transformation/execution-types";

export type StrategicCompletionDiagnostics = {
  strategicRequestMode: "execute_completion";
  strategicAdvisoryQuestion: null;
  selectedLeader: StrategicAssessment["recommendedLeader"];
  highestPriorityOpportunity: string | null;
  transformationHandoff: true;
  transformationPlanId: string | null;
  executionStarted: boolean;
  executionResult: TransformationExecutionResult["status"] | "skipped_idempotent";
  blockedWork: string[];
  tastePassTriggered: boolean;
  finalVerified: boolean;
};

export function logStrategicCompletionDiagnostics(
  diag: StrategicCompletionDiagnostics,
  requestId?: string | null,
): void {
  if (process.env.NODE_ENV !== "development") return;
  console.info("[atlas:strategic-director:completion]", {
    requestId: requestId ?? null,
    ...diag,
  });
}

export function formatStrategicCompletionReport(input: {
  assessment: StrategicAssessment;
  strategicPreface: string;
  tx: TransformationExecutionResult;
  idempotent: boolean;
}): string {
  if (input.idempotent) {
    return "The website is already in a strong completed state. I didn’t make additional changes just for the sake of changing it.";
  }

  const blocked = [
    ...input.assessment.blockedWork.map(
      (b) => b.blockedReason || b.title,
    ),
    ...(input.tx.capabilityGaps ?? [])
      .filter((g) => g.userInputRequired)
      .map((g) => g.recommendedNextStep),
  ];
  const uniqueBlocked = [...new Set(blocked)].slice(0, 3);

  const applied =
    input.tx.status === "applied" || input.tx.status === "partially_applied";

  const lines: string[] = [input.strategicPreface, "", input.tx.summary];

  if (applied && uniqueBlocked.length > 0) {
    lines.push(
      "",
      "I completed the improvements I could verify safely. Remaining items need real business input before I can finish them properly:",
      ...uniqueBlocked.map((b) => `• ${b}`),
    );
  } else if (!applied && uniqueBlocked.length > 0) {
    lines.push(
      "",
      "I couldn’t safely complete every priority without real business information:",
      ...uniqueBlocked.map((b) => `• ${b}`),
    );
  }

  return lines.filter(Boolean).join("\n");
}

export function isIdempotentCompletion(input: {
  assessment: StrategicAssessment;
  tx: TransformationExecutionResult;
  skippedAsRepeat?: boolean;
}): boolean {
  if (input.skippedAsRepeat) return true;
  if (input.tx.skippedAsRepeat) return true;
  if (input.tx.status === "already_satisfied" && input.tx.operations.length === 0) {
    return true;
  }
  return (
    input.tx.operations.length === 0 &&
    input.assessment.websiteState === "excellent" &&
    input.assessment.opportunities.filter((o) => !o.blocked).length === 0
  );
}
