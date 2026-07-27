import { NextResponse } from "next/server";
import {
  constructStripeEvent,
  processStripeEvent,
} from "@/lib/billing/webhooks";
import { captureException } from "@/lib/monitoring";
import { getRequestId } from "@/lib/api";

export const runtime = "nodejs";
/** Stripe needs the raw body for signature verification. */
export const dynamic = "force-dynamic";

/**
 * POST /api/stripe/webhook
 * Verifies Stripe signatures, enforces idempotency, syncs subscriptions.
 */
export async function POST(request: Request) {
  const requestId = getRequestId(request);
  const signature = request.headers.get("stripe-signature");

  try {
    const rawBody = await request.text();
    const event = constructStripeEvent(rawBody, signature);
    const result = await processStripeEvent(event);

    if (!result.ok) {
      return NextResponse.json(
        {
          error: {
            code: "webhook_processing_failed",
            message: result.error,
            requestId,
          },
        },
        { status: result.status, headers: { "x-request-id": requestId } },
      );
    }

    return NextResponse.json(
      {
        received: true,
        type: result.type,
        handled: result.handled,
        duplicate: Boolean(result.duplicate),
        requestId,
      },
      { headers: { "x-request-id": requestId } },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Webhook verification failed.";
    const status =
      typeof error === "object" &&
      error !== null &&
      "statusCode" in error &&
      typeof (error as { statusCode: unknown }).statusCode === "number"
        ? (error as { statusCode: number }).statusCode
        : 400;

    captureException({
      error,
      context: {
        request: { requestId, path: "/api/stripe/webhook", method: "POST" },
        tags: { route: "stripe.webhook" },
      },
    });

    return NextResponse.json(
      {
        error: {
          code: "webhook_invalid",
          message,
          requestId,
        },
      },
      { status, headers: { "x-request-id": requestId } },
    );
  }
}
