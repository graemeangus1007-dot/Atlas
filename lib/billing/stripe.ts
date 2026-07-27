/**
 * Server-only Stripe client factory.
 * Never import from client components.
 */

import {
  planFromStripePriceId as planFromPriceIdInCatalog,
  resolveStripePriceId,
  type AtlasPlanId,
} from "@/lib/billing/plans";
import Stripe from "stripe";

let stripeSingleton: Stripe | null = null;

export function getStripeSecretKey(): string {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) {
    throw new Error(
      "Missing STRIPE_SECRET_KEY. Add it to the server environment.",
    );
  }
  return key;
}

export function getStripeWebhookSecret(): string {
  const key = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!key) {
    throw new Error(
      "Missing STRIPE_WEBHOOK_SECRET. Add it to the server environment.",
    );
  }
  return key;
}

export function getStripePublishableKey(): string | null {
  return process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim() || null;
}

/** Resolve Stripe Price id from plan catalog env keys. */
export function getStripePriceId(
  plan: AtlasPlanId,
  interval: "month" | "year" = "month",
): string {
  return resolveStripePriceId(plan, interval);
}

/** Resolve Atlas plan from a Stripe Price id via catalog env mapping. */
export function planFromStripePriceId(
  priceId: string | null | undefined,
): AtlasPlanId | null {
  return planFromPriceIdInCatalog(priceId);
}

export function getStripe(): Stripe {
  if (stripeSingleton) return stripeSingleton;
  stripeSingleton = new Stripe(getStripeSecretKey(), {
    typescript: true,
    appInfo: {
      name: "Atlas",
      version: "0.1.0",
    },
  });
  return stripeSingleton;
}

/** Reset singleton (tests). */
export function resetStripeClientForTests(): void {
  stripeSingleton = null;
}
