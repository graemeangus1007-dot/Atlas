import { apiJson, getRequestId, unauthorized } from "@/lib/api";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * GET /api/debug/billing-env
 *
 * Temporary: reports which Stripe billing env vars are present (booleans only).
 * Never returns secrets or Price ids. Authenticated users only.
 */
export async function GET(request: Request) {
  const requestId = getRequestId(request);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return unauthorized(requestId);

  // Static process.env.* reads — same constraint as checkout price resolution.
  return apiJson(
    {
      STRIPE_SECRET_KEY: Boolean(process.env.STRIPE_SECRET_KEY?.trim()),
      NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: Boolean(
        process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim(),
      ),
      STRIPE_PRICE_STARTER: Boolean(process.env.STRIPE_PRICE_STARTER?.trim()),
      STRIPE_PRICE_PROFESSIONAL: Boolean(
        process.env.STRIPE_PRICE_PROFESSIONAL?.trim() ||
          process.env.STRIPE_PRICE_PRO?.trim(),
      ),
      STRIPE_PRICE_AGENCY: Boolean(process.env.STRIPE_PRICE_AGENCY?.trim()),
    },
    { requestId },
  );
}
