"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import Button from "@/components/ui/button";
import type { AtlasPlanId, BillingSummary } from "@/lib/billing";

type PlanCard = {
  id: AtlasPlanId;
  displayName: string;
  name: string;
  description: string;
  priceMonthlyUsd: number;
  priceMonthlyLabel: string;
  websiteLimit: number | null;
  domainLimit: number | null;
  highlights: string[];
};

type InvoiceRow = {
  id: string;
  number: string | null;
  status: string | null;
  amountPaid: number;
  currency: string;
  created: string;
  hostedInvoiceUrl: string | null;
};

type BillingPayload = BillingSummary & { plans: PlanCard[] };

function formatMoney(cents: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency}`;
  }
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(
      new Date(iso),
    );
  } catch {
    return iso;
  }
}

function usageLabel(count: number, limit: number | null): string {
  if (limit == null) return `${count} / Unlimited`;
  return `${count} / ${limit}`;
}

/**
 * Billing dashboard — plan, usage, upgrade/downgrade, portal, invoices.
 * Prices and limits come from /api/billing/subscription (PLAN_CONFIG).
 */
export default function BillingDashboard() {
  const [data, setData] = useState<BillingPayload | null>(null);
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [subRes, invRes] = await Promise.all([
        fetch("/api/billing/subscription", {
          credentials: "same-origin",
          cache: "no-store",
        }),
        fetch("/api/billing/invoices", {
          credentials: "same-origin",
          cache: "no-store",
        }),
      ]);
      if (!subRes.ok) {
        const body = (await subRes.json()) as {
          error?: { message?: string };
        };
        throw new Error(body.error?.message || "Could not load billing.");
      }
      setData((await subRes.json()) as BillingPayload);
      if (invRes.ok) {
        const invBody = (await invRes.json()) as { invoices?: InvoiceRow[] };
        setInvoices(invBody.invoices ?? []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load billing.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function startCheckout(plan: AtlasPlanId) {
    setBusy(`checkout:${plan}`);
    setError(null);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const body = (await res.json()) as {
        url?: string;
        error?: { message?: string };
      };
      if (!res.ok || !body.url) {
        throw new Error(body.error?.message || "Checkout failed.");
      }
      window.location.href = body.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout failed.");
      setBusy(null);
    }
  }

  async function openPortal() {
    setBusy("portal");
    setError(null);
    try {
      const res = await fetch("/api/billing/portal", {
        method: "POST",
        credentials: "same-origin",
      });
      const body = (await res.json()) as {
        url?: string;
        error?: { message?: string };
      };
      if (!res.ok || !body.url) {
        throw new Error(body.error?.message || "Could not open portal.");
      }
      window.location.href = body.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Portal failed.");
      setBusy(null);
    }
  }

  const current = data?.subscription;
  const currentPlanCard = data?.plans.find((p) => p.id === current?.plan);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-[family-name:var(--font-atlas-display)] text-2xl font-semibold tracking-tight text-foreground">
            Billing
          </h1>
          <p className="mt-1 text-sm text-muted">
            Manage your Atlas plan, usage, and invoices.
          </p>
        </div>
        <Button
          type="button"
          variant="secondary"
          onClick={() => void load()}
          disabled={loading || Boolean(busy)}
        >
          Refresh
        </Button>
      </div>

      {error ? (
        <div
          className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      {loading && !data ? (
        <p className="text-sm text-muted">Loading billing…</p>
      ) : null}

      {current && data ? (
        <section className="grid gap-4 md:grid-cols-3">
          <article className="rounded-2xl border border-border bg-surface/60 p-5 md:col-span-2">
            <p className="text-xs uppercase tracking-wide text-muted">
              Current plan
            </p>
            <p className="mt-2 font-[family-name:var(--font-atlas-display)] text-3xl font-semibold text-foreground">
              {current.planName}
            </p>
            <p className="mt-2 text-sm text-muted">
              {current.plan
                ? `${current.priceMonthlyLabel}/month`
                : "Subscribe to unlock Atlas"}{" "}
              · Status: {current.status}
              {current.cancelAtPeriodEnd ? " · Cancels at period end" : ""}
            </p>
            <p className="mt-1 text-sm text-muted">
              Renewal / period end: {formatDate(current.currentPeriodEnd)}
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => void openPortal()}
                disabled={Boolean(busy)}
              >
                {busy === "portal" ? "Opening…" : "Manage billing"}
              </Button>
              {data.plans.map((plan) => {
                if (plan.id === current.plan) return null;
                const isUpgrade =
                  !current.plan ||
                  (currentPlanCard != null &&
                    plan.priceMonthlyUsd > currentPlanCard.priceMonthlyUsd);
                return (
                  <Button
                    key={plan.id}
                    type="button"
                    variant={isUpgrade ? "primary" : "secondary"}
                    onClick={() => void startCheckout(plan.id)}
                    disabled={Boolean(busy)}
                  >
                    {busy === `checkout:${plan.id}`
                      ? "Redirecting…"
                      : isUpgrade
                        ? `Upgrade to ${plan.displayName}`
                        : `Switch to ${plan.displayName}`}
                  </Button>
                );
              })}
            </div>
            {current.plan ? (
              <p className="mt-3 text-xs text-muted">
                Downgrade or cancel anytime in the Stripe billing portal. Your
                websites are never deleted when you change plans.
              </p>
            ) : null}
          </article>

          <article className="rounded-2xl border border-border bg-surface/60 p-5">
            <p className="text-xs uppercase tracking-wide text-muted">Usage</p>
            <ul className="mt-3 space-y-3 text-sm text-foreground">
              <li>
                Websites:{" "}
                {usageLabel(
                  data.usage.projectCount,
                  data.usage.projectLimit,
                )}
              </li>
              <li>
                Custom domains:{" "}
                {usageLabel(data.usage.domainCount, data.usage.domainLimit)}
              </li>
            </ul>
            {!data.canCreateProject ? (
              <p className="mt-4 text-xs text-amber-200">
                Website limit reached.{" "}
                <button
                  type="button"
                  className="underline"
                  onClick={() => {
                    const next =
                      data.plans.find((p) => p.id !== current.plan) ??
                      data.plans[0];
                    if (next) void startCheckout(next.id);
                  }}
                >
                  Upgrade
                </button>{" "}
                to create more.
              </p>
            ) : null}
          </article>
        </section>
      ) : null}

      {data?.plans ? (
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-foreground">Plans</h2>
          <ul className="grid gap-3 md:grid-cols-3">
            {data.plans.map((plan) => {
              const active = current?.plan === plan.id;
              return (
                <li
                  key={plan.id}
                  className={`rounded-2xl border p-4 ${
                    active
                      ? "border-accent/50 bg-accent-soft/40"
                      : "border-border bg-surface/40"
                  }`}
                >
                  <p className="font-medium text-foreground">
                    {plan.displayName}
                  </p>
                  <p className="mt-1 text-2xl font-semibold text-foreground">
                    {plan.priceMonthlyLabel}
                    <span className="text-sm font-normal text-muted">/mo</span>
                  </p>
                  <p className="mt-2 text-xs text-muted">{plan.description}</p>
                  <ul className="mt-3 space-y-1 text-xs text-muted">
                    {plan.highlights.map((item) => (
                      <li key={item}>• {item}</li>
                    ))}
                  </ul>
                  <div className="mt-4">
                    <Button
                      type="button"
                      variant={active ? "secondary" : "primary"}
                      disabled={active || Boolean(busy)}
                      onClick={() => void startCheckout(plan.id)}
                    >
                      {active ? "Current" : `Choose ${plan.displayName}`}
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-foreground">Invoices</h2>
        {invoices.length === 0 ? (
          <p className="text-sm text-muted">No invoices yet.</p>
        ) : (
          <ul className="divide-y divide-border rounded-2xl border border-border">
            {invoices.map((invoice) => (
              <li
                key={invoice.id}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"
              >
                <div>
                  <p className="text-foreground">
                    {invoice.number || invoice.id}
                  </p>
                  <p className="text-xs text-muted">
                    {formatDate(invoice.created)} · {invoice.status}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-foreground">
                    {formatMoney(invoice.amountPaid, invoice.currency)}
                  </span>
                  {invoice.hostedInvoiceUrl ? (
                    <Link
                      href={invoice.hostedInvoiceUrl}
                      target="_blank"
                      className="text-xs text-accent hover:underline"
                    >
                      View
                    </Link>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
