import {
  apiJson,
  getRequestId,
  internalError,
  unauthorized,
} from "@/lib/api";
import { listCustomerInvoices } from "@/lib/billing/checkout";
import { captureException, requestContextFromRequest } from "@/lib/monitoring";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * GET /api/billing/invoices
 * Recent Stripe invoices for the authenticated owner.
 */
export async function GET(request: Request) {
  const requestId = getRequestId(request);

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return unauthorized(requestId);

    const invoices = await listCustomerInvoices({ ownerId: user.id });
    return apiJson({ invoices }, { requestId });
  } catch (error) {
    captureException({
      error,
      context: {
        request: requestContextFromRequest(request, requestId),
        tags: { route: "billing.invoices" },
      },
    });
    return internalError(requestId, "Could not load invoices.");
  }
}
