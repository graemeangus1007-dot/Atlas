/**
 * Synchronize Stripe subscription state into Supabase (service role).
 */

import { createHash } from "node:crypto";
import {
  DEFAULT_PLAN_ID,
  featureFlagsForPlan,
  LOCKED_FEATURES,
  type AtlasPlanId,
} from "@/lib/billing/plans";
import { planFromStripePriceId } from "@/lib/billing/stripe";
import type { SubscriptionStatus } from "@/lib/billing/types";
import { createServiceClient } from "@/lib/supabase/service";
import type Stripe from "stripe";

function isoFromUnix(seconds: number | null | undefined): string | null {
  if (seconds == null || !Number.isFinite(seconds)) return null;
  return new Date(seconds * 1000).toISOString();
}

function mapStripeStatus(
  status: Stripe.Subscription.Status,
): SubscriptionStatus {
  switch (status) {
    case "trialing":
    case "active":
    case "past_due":
    case "canceled":
    case "unpaid":
    case "incomplete":
    case "incomplete_expired":
    case "paused":
      return status;
    default:
      return "none";
  }
}

function priceIdFromSubscription(
  subscription: Stripe.Subscription,
): string | null {
  const item = subscription.items?.data?.[0];
  const price = item?.price;
  if (!price) return null;
  return typeof price === "string" ? price : price.id;
}

function periodFromSubscription(subscription: Stripe.Subscription): {
  start: string | null;
  end: string | null;
} {
  const item = subscription.items?.data?.[0] as
    | { current_period_start?: number; current_period_end?: number }
    | undefined;
  // Stripe API: period fields live on subscription items in newer API versions;
  // fall back to subscription-level fields when present.
  const sub = subscription as Stripe.Subscription & {
    current_period_start?: number;
    current_period_end?: number;
  };
  const start = item?.current_period_start ?? sub.current_period_start;
  const end = item?.current_period_end ?? sub.current_period_end;
  return { start: isoFromUnix(start), end: isoFromUnix(end) };
}

export function resolvePlanFromSubscription(
  subscription: Stripe.Subscription,
): AtlasPlanId {
  const priceId = priceIdFromSubscription(subscription);
  const mapped = planFromStripePriceId(priceId);
  if (mapped) return mapped;
  // Unknown price — fall back to default catalog id (not entitled without status).
  return DEFAULT_PLAN_ID;
}

export async function upsertBillingCustomer(input: {
  ownerId: string;
  stripeCustomerId: string;
  email?: string | null;
}): Promise<void> {
  const supabase = createServiceClient();
  const { error } = await supabase.from("billing_customers").upsert(
    {
      owner_id: input.ownerId,
      stripe_customer_id: input.stripeCustomerId,
      email: input.email ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "owner_id" },
  );
  if (error) {
    throw new Error(`Failed to upsert billing customer: ${error.message}`);
  }
}

export async function findOwnerIdByStripeCustomerId(
  stripeCustomerId: string,
): Promise<string | null> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("billing_customers")
    .select("owner_id")
    .eq("stripe_customer_id", stripeCustomerId)
    .maybeSingle();
  return typeof data?.owner_id === "string" ? data.owner_id : null;
}

export async function syncSubscriptionFromStripe(
  subscription: Stripe.Subscription,
  ownerId: string,
): Promise<void> {
  const plan = resolvePlanFromSubscription(subscription);
  const status = mapStripeStatus(subscription.status);
  const priceId = priceIdFromSubscription(subscription);
  const period = periodFromSubscription(subscription);
  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer?.id;

  const entitled =
    status === "active" || status === "trialing" || status === "past_due";
  const flags = entitled ? featureFlagsForPlan(plan) : { ...LOCKED_FEATURES };

  const supabase = createServiceClient();
  const { error } = await supabase.from("subscriptions").upsert(
    {
      owner_id: ownerId,
      plan: entitled ? plan : DEFAULT_PLAN_ID,
      status,
      stripe_customer_id: customerId ?? null,
      stripe_subscription_id: subscription.id,
      stripe_price_id: priceId,
      cancel_at_period_end: Boolean(subscription.cancel_at_period_end),
      current_period_start: period.start,
      current_period_end: period.end,
      canceled_at: isoFromUnix(subscription.canceled_at),
      feature_flags: flags,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "owner_id" },
  );

  if (error) {
    throw new Error(`Failed to sync subscription: ${error.message}`);
  }

  if (customerId) {
    await upsertBillingCustomer({
      ownerId,
      stripeCustomerId: customerId,
    });
  }
}

/** Lock entitlements when subscription is fully gone (data retained). */
export async function markSubscriptionCanceled(ownerId: string): Promise<void> {
  const supabase = createServiceClient();
  const { error } = await supabase
    .from("subscriptions")
    .update({
      plan: DEFAULT_PLAN_ID,
      status: "canceled",
      cancel_at_period_end: false,
      stripe_subscription_id: null,
      stripe_price_id: null,
      feature_flags: { ...LOCKED_FEATURES },
      canceled_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("owner_id", ownerId);

  if (error) {
    throw new Error(`Failed to mark subscription canceled: ${error.message}`);
  }
}

/**
 * Record webhook event id for idempotency.
 * Returns false if already processed (replay).
 */
export async function claimWebhookEvent(input: {
  id: string;
  type: string;
  livemode: boolean;
  payload: unknown;
}): Promise<boolean> {
  const digest = createHash("sha256")
    .update(JSON.stringify(input.payload))
    .digest("hex")
    .slice(0, 64);

  const supabase = createServiceClient();
  const { error } = await supabase.from("stripe_webhook_events").insert({
    id: input.id,
    type: input.type,
    livemode: input.livemode,
    payload_digest: digest,
  });

  if (error) {
    // Unique violation → already processed
    if (error.code === "23505") return false;
    throw new Error(`Failed to claim webhook event: ${error.message}`);
  }
  return true;
}

/**
 * Release a claimed webhook event so Stripe retries can reprocess after failure.
 */
export async function releaseWebhookEvent(eventId: string): Promise<void> {
  const supabase = createServiceClient();
  const { error } = await supabase
    .from("stripe_webhook_events")
    .delete()
    .eq("id", eventId);
  if (error) {
    throw new Error(`Failed to release webhook event: ${error.message}`);
  }
}
