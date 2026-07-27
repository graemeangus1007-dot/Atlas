/**
 * Stripe webhook verification + event processing.
 * Production architecture: signature verify → idempotent claim → sync.
 */

import {
  findOwnerIdByStripeCustomerId,
  claimWebhookEvent,
  markSubscriptionCanceled,
  syncSubscriptionFromStripe,
} from "@/lib/billing/sync";
import { getStripe, getStripeWebhookSecret } from "@/lib/billing/stripe";
import type Stripe from "stripe";

export type WebhookProcessResult =
  | { ok: true; handled: boolean; type: string; duplicate?: boolean }
  | { ok: false; error: string; status: number };

function customerIdOf(
  subscription: Stripe.Subscription,
): string | null {
  return typeof subscription.customer === "string"
    ? subscription.customer
    : subscription.customer?.id ?? null;
}

async function resolveOwnerId(
  subscription: Stripe.Subscription,
): Promise<string | null> {
  const fromMeta = subscription.metadata?.atlas_owner_id?.trim();
  if (fromMeta) return fromMeta;

  const customerId = customerIdOf(subscription);
  if (!customerId) return null;
  return findOwnerIdByStripeCustomerId(customerId);
}

export function constructStripeEvent(
  rawBody: string | Buffer,
  signature: string | null,
): Stripe.Event {
  if (!signature) {
    throw Object.assign(new Error("Missing Stripe-Signature header."), {
      statusCode: 400,
    });
  }
  const stripe = getStripe();
  return stripe.webhooks.constructEvent(
    rawBody,
    signature,
    getStripeWebhookSecret(),
  );
}

export async function processStripeEvent(
  event: Stripe.Event,
): Promise<WebhookProcessResult> {
  const claimed = await claimWebhookEvent({
    id: event.id,
    type: event.type,
    livemode: event.livemode,
    payload: { id: event.id, type: event.type },
  });

  if (!claimed) {
    return { ok: true, handled: false, type: event.type, duplicate: true };
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode !== "subscription") {
        return { ok: true, handled: false, type: event.type };
      }
      const subscriptionId =
        typeof session.subscription === "string"
          ? session.subscription
          : session.subscription?.id;
      const ownerId =
        session.metadata?.atlas_owner_id?.trim() ||
        session.client_reference_id?.trim() ||
        null;
      if (!subscriptionId || !ownerId) {
        return { ok: true, handled: false, type: event.type };
      }
      const stripe = getStripe();
      const subscription =
        await stripe.subscriptions.retrieve(subscriptionId);
      await syncSubscriptionFromStripe(subscription, ownerId);
      return { ok: true, handled: true, type: event.type };
    }

    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.resumed": {
      const subscription = event.data.object as Stripe.Subscription;
      const ownerId = await resolveOwnerId(subscription);
      if (!ownerId) {
        return {
          ok: false,
          error: "Unable to resolve Atlas owner for subscription event.",
          status: 422,
        };
      }
      await syncSubscriptionFromStripe(subscription, ownerId);
      return { ok: true, handled: true, type: event.type };
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const ownerId = await resolveOwnerId(subscription);
      if (!ownerId) {
        return { ok: true, handled: false, type: event.type };
      }
      // Period ended / fully canceled — lock features, keep project data.
      await markSubscriptionCanceled(ownerId);
      return { ok: true, handled: true, type: event.type };
    }

    case "invoice.paid":
    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const subscriptionId =
        typeof (invoice as Stripe.Invoice & { subscription?: string | { id: string } | null })
          .subscription === "string"
          ? (invoice as Stripe.Invoice & { subscription?: string }).subscription
          : (
              invoice as Stripe.Invoice & {
                subscription?: { id: string } | null;
              }
            ).subscription?.id;

      if (!subscriptionId) {
        return { ok: true, handled: false, type: event.type };
      }
      const stripe = getStripe();
      const subscription =
        await stripe.subscriptions.retrieve(subscriptionId);
      const ownerId = await resolveOwnerId(subscription);
      if (!ownerId) {
        return { ok: true, handled: false, type: event.type };
      }
      await syncSubscriptionFromStripe(subscription, ownerId);
      return { ok: true, handled: true, type: event.type };
    }

    default:
      return { ok: true, handled: false, type: event.type };
  }
}
