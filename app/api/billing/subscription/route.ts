import {
  apiJson,
  getRequestId,
  internalError,
  unauthorized,
} from "@/lib/api";
import {
  formatPlanMonthlyPrice,
  PLAN_CATALOG,
  planMonthlyPriceUsd,
} from "@/lib/billing/plans";
import { getBillingSummaryForOwner } from "@/lib/billing/subscription";
import { captureException, requestContextFromRequest } from "@/lib/monitoring";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * GET /api/billing/subscription
 * Current plan, usage, and entitlements for the signed-in owner.
 */
export async function GET(request: Request) {
  const requestId = getRequestId(request);

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return unauthorized(requestId);

    const summary = await getBillingSummaryForOwner(user.id, supabase);
    return apiJson(
      {
        ...summary,
        plans: PLAN_CATALOG.map((plan) => ({
          id: plan.id,
          displayName: plan.displayName,
          name: plan.displayName,
          description: plan.description,
          priceMonthlyUsd: planMonthlyPriceUsd(plan.id),
          priceMonthlyLabel: formatPlanMonthlyPrice(plan.id),
          websiteLimit: plan.websiteLimit,
          domainLimit: plan.domainLimit,
          features: plan.features,
          highlights: plan.highlights,
          billing: plan.billing,
        })),
      },
      { requestId },
    );
  } catch (error) {
    captureException({
      error,
      context: {
        request: requestContextFromRequest(request, requestId),
        tags: { route: "billing.subscription" },
      },
    });
    return internalError(requestId, "Could not load billing summary.");
  }
}
