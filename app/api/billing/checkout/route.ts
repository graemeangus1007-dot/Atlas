import {
  apiJson,
  badRequest,
  getRequestId,
  internalError,
  unauthorized,
} from "@/lib/api";
import { createCheckoutSession } from "@/lib/billing/checkout";
import type { CheckoutTargetPlan } from "@/lib/billing/types";
import { captureException, requestContextFromRequest } from "@/lib/monitoring";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * POST /api/billing/checkout
 * Body: { plan: "starter" | "professional" | "agency", interval?: "month" | "year" }
 * Returns Stripe Checkout URL for the authenticated owner.
 */
export async function POST(request: Request) {
  const requestId = getRequestId(request);

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return unauthorized(requestId);

    let body: { plan?: string; interval?: string };
    try {
      body = (await request.json()) as { plan?: string; interval?: string };
    } catch {
      return badRequest("Invalid JSON body.", requestId, "invalid_json");
    }

    const plan = body.plan?.trim().toLowerCase();
    if (
      plan !== "starter" &&
      plan !== "professional" &&
      plan !== "agency"
    ) {
      return badRequest(
        'plan must be "starter", "professional", or "agency".',
        requestId,
        "invalid_plan",
      );
    }

    const interval =
      body.interval === "year" ? ("year" as const) : ("month" as const);

    const session = await createCheckoutSession({
      ownerId: user.id,
      email: user.email ?? null,
      plan: plan as CheckoutTargetPlan,
      interval,
    });

    return apiJson(session, { requestId });
  } catch (error) {
    captureException({
      error,
      context: {
        request: requestContextFromRequest(request, requestId),
        tags: { route: "billing.checkout" },
      },
    });
    return internalError(
      requestId,
      "Could not start checkout. Confirm Stripe keys and price IDs are configured.",
    );
  }
}
