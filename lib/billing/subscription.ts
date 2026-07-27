import {
  buildBillingSummary,
  resolveFeatures,
  toPublicSubscription,
} from "@/lib/billing/entitlements";
import type {
  BillingSummary,
  PublicSubscription,
  SubscriptionRow,
} from "@/lib/billing/types";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

type AnySupabase = SupabaseClient<Database>;

function parseSubscriptionRow(raw: unknown): SubscriptionRow | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  if (typeof row.owner_id !== "string") return null;
  const plan = row.plan;
  if (plan !== "starter" && plan !== "professional" && plan !== "agency") {
    return null;
  }
  return {
    owner_id: row.owner_id,
    plan,
    status: (typeof row.status === "string"
      ? row.status
      : "none") as SubscriptionRow["status"],
    stripe_customer_id:
      typeof row.stripe_customer_id === "string"
        ? row.stripe_customer_id
        : null,
    stripe_subscription_id:
      typeof row.stripe_subscription_id === "string"
        ? row.stripe_subscription_id
        : null,
    stripe_price_id:
      typeof row.stripe_price_id === "string" ? row.stripe_price_id : null,
    cancel_at_period_end: Boolean(row.cancel_at_period_end),
    current_period_start:
      typeof row.current_period_start === "string"
        ? row.current_period_start
        : null,
    current_period_end:
      typeof row.current_period_end === "string"
        ? row.current_period_end
        : null,
    canceled_at:
      typeof row.canceled_at === "string" ? row.canceled_at : null,
    feature_flags:
      row.feature_flags && typeof row.feature_flags === "object"
        ? (row.feature_flags as SubscriptionRow["feature_flags"])
        : {},
    created_at:
      typeof row.created_at === "string"
        ? row.created_at
        : new Date().toISOString(),
    updated_at:
      typeof row.updated_at === "string"
        ? row.updated_at
        : new Date().toISOString(),
  };
}

export async function ensureSubscriptionRow(
  supabase: AnySupabase,
  ownerId: string,
): Promise<SubscriptionRow | null> {
  const { data: existing } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("owner_id", ownerId)
    .maybeSingle();

  const parsed = parseSubscriptionRow(existing);
  if (parsed) return parsed;

  const { data: created, error } = await supabase.rpc(
    "ensure_free_subscription",
    { p_owner_id: ownerId },
  );
  if (error) return null;
  return parseSubscriptionRow(created);
}

export async function getSubscriptionForOwner(
  ownerId: string,
  client?: AnySupabase,
): Promise<SubscriptionRow | null> {
  const supabase = client ?? (await createClient());
  return ensureSubscriptionRow(supabase, ownerId);
}

export async function getPublicSubscriptionForOwner(
  ownerId: string,
  client?: AnySupabase,
): Promise<PublicSubscription> {
  const row = await getSubscriptionForOwner(ownerId, client);
  return toPublicSubscription(row);
}

export async function countOwnerProjects(
  supabase: AnySupabase,
  ownerId: string,
): Promise<number> {
  const { count, error } = await supabase
    .from("projects")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", ownerId);
  if (error) return 0;
  return typeof count === "number" ? count : 0;
}

export async function countOwnerDomains(
  supabase: AnySupabase,
  ownerId: string,
): Promise<number> {
  const { count, error } = await supabase
    .from("project_domains")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", ownerId);
  if (error) return 0;
  return typeof count === "number" ? count : 0;
}

export async function getBillingSummaryForOwner(
  ownerId: string,
  client?: AnySupabase,
): Promise<BillingSummary> {
  const supabase = client ?? (await createClient());
  const [row, projectCount, domainCount] = await Promise.all([
    ensureSubscriptionRow(supabase, ownerId),
    countOwnerProjects(supabase, ownerId),
    countOwnerDomains(supabase, ownerId),
  ]);
  return buildBillingSummary(row, { projectCount, domainCount });
}

export async function ownerHasFeature(
  ownerId: string,
  feature: keyof ReturnType<typeof resolveFeatures>,
  client?: AnySupabase,
): Promise<boolean> {
  const row = await getSubscriptionForOwner(ownerId, client);
  return Boolean(resolveFeatures(row)[feature]);
}
