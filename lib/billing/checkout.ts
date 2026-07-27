import {
  getPublicAtlasOrigin,
  isLocalDevelopmentRuntime,
  isLocalhostOrigin,
} from "@/lib/app-url";
import { getPlanConfig, isAtlasPlanId } from "@/lib/billing/plans";
import {
  getStripe,
  getStripePriceId,
} from "@/lib/billing/stripe";
import { upsertBillingCustomer } from "@/lib/billing/sync";
import { createServiceClient } from "@/lib/supabase/service";
import type { CheckoutTargetPlan } from "@/lib/billing/types";
import type Stripe from "stripe";

/** Checkout/portal return URLs — never fall back to localhost on deployed runtimes. */
function requireBillingReturnOrigin(): string {
  const origin = getPublicAtlasOrigin();
  if (origin && !isLocalhostOrigin(origin)) return origin;
  if (isLocalDevelopmentRuntime()) {
    return origin || "http://localhost:3000";
  }
  throw new Error(
    "APP_URL must be set to your deployed Atlas origin for Stripe Checkout and Billing Portal return URLs.",
  );
}

async function getOrCreateStripeCustomer(input: {
  ownerId: string;
  email: string | null;
}): Promise<string> {
  const supabase = createServiceClient();
  const { data: existing } = await supabase
    .from("billing_customers")
    .select("stripe_customer_id")
    .eq("owner_id", input.ownerId)
    .maybeSingle();

  if (existing?.stripe_customer_id) {
    return existing.stripe_customer_id;
  }

  const stripe = getStripe();
  const customer = await stripe.customers.create({
    email: input.email || undefined,
    metadata: {
      atlas_owner_id: input.ownerId,
    },
  });

  await upsertBillingCustomer({
    ownerId: input.ownerId,
    stripeCustomerId: customer.id,
    email: input.email,
  });

  return customer.id;
}

/**
 * Create a Stripe Checkout Session for upgrading to Pro or Agency.
 * Uses subscription mode with a configured Price id (production architecture).
 */
export async function createCheckoutSession(input: {
  ownerId: string;
  email: string | null;
  plan: CheckoutTargetPlan;
  /** Future: annual checkout when annual Price env is configured. */
  interval?: "month" | "year";
  successUrl?: string;
  cancelUrl?: string;
}): Promise<{ url: string; sessionId: string }> {
  if (!isAtlasPlanId(input.plan)) {
    throw new Error("Invalid plan id.");
  }

  const origin = requireBillingReturnOrigin();
  const interval = input.interval ?? "month";
  if (interval === "year") {
    const hasAnnual =
      (input.plan === "starter" &&
        Boolean(process.env.STRIPE_PRICE_STARTER_ANNUAL?.trim())) ||
      (input.plan === "professional" &&
        Boolean(process.env.STRIPE_PRICE_PROFESSIONAL_ANNUAL?.trim())) ||
      (input.plan === "agency" &&
        Boolean(process.env.STRIPE_PRICE_AGENCY_ANNUAL?.trim()));
    if (!hasAnnual) {
      throw new Error(
        "Annual billing is not configured for this plan. Choose monthly billing.",
      );
    }
  }
  const priceId = getStripePriceId(input.plan, interval);
  const planConfig = getPlanConfig(input.plan);
  const customerId = await getOrCreateStripeCustomer({
    ownerId: input.ownerId,
    email: input.email,
  });

  const trialDays = planConfig.billing.trialDays;
  const stripe = getStripe();
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    client_reference_id: input.ownerId,
    success_url:
      input.successUrl ||
      `${origin}/dashboard/billing?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url:
      input.cancelUrl || `${origin}/dashboard/billing?checkout=canceled`,
    line_items: [{ price: priceId, quantity: 1 }],
    // Coupons / promotional codes — configured in Stripe, not hard-coded here.
    allow_promotion_codes: true,
    billing_address_collection: "auto",
    subscription_data: {
      metadata: {
        atlas_owner_id: input.ownerId,
        atlas_plan: input.plan,
      },
      ...(typeof trialDays === "number" && trialDays > 0
        ? { trial_period_days: trialDays }
        : {}),
    },
    metadata: {
      atlas_owner_id: input.ownerId,
      atlas_plan: input.plan,
    },
  });

  if (!session.url) {
    throw new Error("Stripe Checkout did not return a session URL.");
  }

  return { url: session.url, sessionId: session.id };
}

export async function createBillingPortalSession(input: {
  ownerId: string;
  email: string | null;
  returnUrl?: string;
}): Promise<{ url: string }> {
  const origin = requireBillingReturnOrigin();
  const customerId = await getOrCreateStripeCustomer({
    ownerId: input.ownerId,
    email: input.email,
  });

  const stripe = getStripe();
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: input.returnUrl || `${origin}/dashboard/billing`,
  });

  return { url: session.url };
}

export async function listCustomerInvoices(input: {
  ownerId: string;
  limit?: number;
}): Promise<
  Array<{
    id: string;
    number: string | null;
    status: string | null;
    amountDue: number;
    amountPaid: number;
    currency: string;
    created: string;
    hostedInvoiceUrl: string | null;
    invoicePdf: string | null;
  }>
> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("billing_customers")
    .select("stripe_customer_id")
    .eq("owner_id", input.ownerId)
    .maybeSingle();

  if (!data?.stripe_customer_id) return [];

  const stripe = getStripe();
  const invoices = await stripe.invoices.list({
    customer: data.stripe_customer_id,
    limit: input.limit ?? 12,
  });

  return invoices.data.map((invoice: Stripe.Invoice) => ({
    id: invoice.id,
    number: invoice.number,
    status: invoice.status,
    amountDue: invoice.amount_due,
    amountPaid: invoice.amount_paid,
    currency: invoice.currency,
    created: new Date(invoice.created * 1000).toISOString(),
    hostedInvoiceUrl: invoice.hosted_invoice_url ?? null,
    invoicePdf: invoice.invoice_pdf ?? null,
  }));
}
