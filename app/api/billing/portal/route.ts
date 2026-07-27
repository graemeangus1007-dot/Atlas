import {
  apiJson,
  getRequestId,
  internalError,
  unauthorized,
} from "@/lib/api";
import { createBillingPortalSession } from "@/lib/billing/checkout";
import { captureException, requestContextFromRequest } from "@/lib/monitoring";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * POST /api/billing/portal
 * Opens the Stripe Billing Portal for the authenticated owner.
 */
export async function POST(request: Request) {
  const requestId = getRequestId(request);

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return unauthorized(requestId);

    const session = await createBillingPortalSession({
      ownerId: user.id,
      email: user.email ?? null,
    });

    return apiJson(session, { requestId });
  } catch (error) {
    captureException({
      error,
      context: {
        request: requestContextFromRequest(request, requestId),
        tags: { route: "billing.portal" },
      },
    });
    return internalError(
      requestId,
      "Could not open the billing portal. Confirm Stripe Customer Portal is enabled.",
    );
  }
}
