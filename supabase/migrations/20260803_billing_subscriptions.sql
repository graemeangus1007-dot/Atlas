-- Atlas Sprint 19.0B: Stripe billing & subscriptions
-- Apply in the Supabase SQL editor, or via `supabase db push`.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
do $$ begin
  create type public.atlas_plan as enum ('starter', 'professional', 'agency');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.atlas_subscription_status as enum (
    'trialing',
    'active',
    'past_due',
    'canceled',
    'unpaid',
    'incomplete',
    'incomplete_expired',
    'paused',
    'none'
  );
exception when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- billing_customers — one Stripe customer per Atlas user
-- ---------------------------------------------------------------------------
create table if not exists public.billing_customers (
  owner_id uuid primary key references auth.users (id) on delete cascade,
  stripe_customer_id text not null unique,
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint billing_customers_stripe_customer_id_length
    check (char_length(stripe_customer_id) between 3 and 255)
);

create index if not exists billing_customers_stripe_customer_id_idx
  on public.billing_customers (stripe_customer_id);

alter table public.billing_customers enable row level security;

drop policy if exists "Owners can select own billing customer" on public.billing_customers;
create policy "Owners can select own billing customer"
  on public.billing_customers
  for select
  to authenticated
  using (auth.uid() = owner_id);

drop policy if exists "Owners can update own billing customer" on public.billing_customers;
create policy "Owners can update own billing customer"
  on public.billing_customers
  for update
  to authenticated
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

-- Inserts/deletes are service-role only (Stripe sync). No authenticated insert policy.

-- ---------------------------------------------------------------------------
-- subscriptions — current plan state synchronized from Stripe
-- ---------------------------------------------------------------------------
create table if not exists public.subscriptions (
  owner_id uuid primary key references auth.users (id) on delete cascade,
  plan public.atlas_plan not null default 'starter',
  status public.atlas_subscription_status not null default 'none',
  stripe_customer_id text,
  stripe_subscription_id text unique,
  stripe_price_id text,
  cancel_at_period_end boolean not null default false,
  current_period_start timestamptz,
  current_period_end timestamptz,
  canceled_at timestamptz,
  feature_flags jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint subscriptions_stripe_ids_length check (
    (stripe_customer_id is null or char_length(stripe_customer_id) between 3 and 255)
    and (stripe_subscription_id is null or char_length(stripe_subscription_id) between 3 and 255)
    and (stripe_price_id is null or char_length(stripe_price_id) between 3 and 255)
  )
);

create index if not exists subscriptions_plan_idx
  on public.subscriptions (plan);

create index if not exists subscriptions_status_idx
  on public.subscriptions (status);

create index if not exists subscriptions_stripe_subscription_id_idx
  on public.subscriptions (stripe_subscription_id);

alter table public.subscriptions enable row level security;

drop policy if exists "Owners can select own subscription" on public.subscriptions;
create policy "Owners can select own subscription"
  on public.subscriptions
  for select
  to authenticated
  using (auth.uid() = owner_id);

-- Authenticated users may not change plan/status directly — Stripe webhook (service role) syncs.
-- Allow limited self-update of non-billing metadata only via RPC if needed later.
-- No insert/update/delete policies for authenticated → service role only for writes.

-- ---------------------------------------------------------------------------
-- stripe_webhook_events — idempotency + replay protection
-- ---------------------------------------------------------------------------
create table if not exists public.stripe_webhook_events (
  id text primary key,
  type text not null,
  processed_at timestamptz not null default now(),
  livemode boolean not null default false,
  payload_digest text,
  constraint stripe_webhook_events_type_length check (char_length(type) between 1 and 120)
);

create index if not exists stripe_webhook_events_processed_at_idx
  on public.stripe_webhook_events (processed_at desc);

alter table public.stripe_webhook_events enable row level security;
-- No policies: service role only.

-- ---------------------------------------------------------------------------
-- Ensure every user has a free subscription row (lazy bootstrap)
-- ---------------------------------------------------------------------------
create or replace function public.ensure_free_subscription(p_owner_id uuid)
returns public.subscriptions
language plpgsql
security definer
set search_path = public
as $$
declare
  row public.subscriptions;
begin
  if p_owner_id is null then
    raise exception 'owner required';
  end if;

  -- Only the owning user (or service role) may bootstrap their row.
  if auth.uid() is not null and auth.uid() <> p_owner_id then
    raise exception 'forbidden';
  end if;

  insert into public.subscriptions (owner_id, plan, status, feature_flags)
  values (
    p_owner_id,
    'starter',
    'none',
    jsonb_build_object(
      'maxProjects', 0,
      'maxDomains', 0,
      'customDomains', false,
      'leadInbox', false,
      'emailNotifications', false,
      'advancedAnalytics', false,
      'basicAnalytics', false,
      'basicSeo', false,
      'seoTools', false,
      'versionHistory', false,
      'removeBranding', false,
      'teamMembers', false,
      'whiteLabel', false,
      'aiCredits', false,
      'unlimitedPublishing', false,
      'prioritySupport', false,
      'communitySupport', false
    )
  )
  on conflict (owner_id) do nothing;

  select * into row from public.subscriptions where owner_id = p_owner_id;
  return row;
end;
$$;

revoke all on function public.ensure_free_subscription(uuid) from public;
grant execute on function public.ensure_free_subscription(uuid) to authenticated, service_role;

-- Auto-create free subscription when a new auth user is created.
create or replace function public.handle_new_user_subscription()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.subscriptions (owner_id, plan, status, feature_flags)
  values (
    new.id,
    'starter',
    'none',
    jsonb_build_object(
      'maxProjects', 0,
      'maxDomains', 0,
      'customDomains', false,
      'leadInbox', false,
      'emailNotifications', false,
      'advancedAnalytics', false,
      'basicAnalytics', false,
      'basicSeo', false,
      'seoTools', false,
      'versionHistory', false,
      'removeBranding', false,
      'teamMembers', false,
      'whiteLabel', false,
      'aiCredits', false,
      'unlimitedPublishing', false,
      'prioritySupport', false,
      'communitySupport', false
    )
  )
  on conflict (owner_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_subscription on auth.users;
create trigger on_auth_user_created_subscription
  after insert on auth.users
  for each row execute function public.handle_new_user_subscription();

-- Backfill existing users
insert into public.subscriptions (owner_id, plan, status, feature_flags)
select
  u.id,
  'starter',
  'none',
  jsonb_build_object(
    'maxProjects', 0,
    'maxDomains', 0,
    'customDomains', false,
    'leadInbox', false,
    'emailNotifications', false,
    'advancedAnalytics', false,
    'basicAnalytics', false,
    'basicSeo', false,
    'seoTools', false,
    'versionHistory', false,
    'removeBranding', false,
    'teamMembers', false,
    'whiteLabel', false,
    'aiCredits', false,
    'unlimitedPublishing', false,
    'prioritySupport', false,
    'communitySupport', false
  )
from auth.users u
on conflict (owner_id) do nothing;

-- ---------------------------------------------------------------------------
-- Enforce website limits on insert (do not delete projects on downgrade)
-- ---------------------------------------------------------------------------
create or replace function public.enforce_project_plan_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  sub public.subscriptions;
  project_count integer;
  max_projects integer;
  entitled boolean;
begin
  perform public.ensure_free_subscription(new.owner_id);
  select * into sub from public.subscriptions where owner_id = new.owner_id;

  entitled := sub.status in ('active', 'trialing', 'past_due');
  if not entitled then
    max_projects := 0;
  elsif sub.plan = 'starter' then
    max_projects := 1;
  elsif sub.plan = 'professional' then
    max_projects := 10;
  else
    -- agency / unlimited
    return new;
  end if;

  select count(*)::integer into project_count
  from public.projects
  where owner_id = new.owner_id;

  if project_count >= max_projects then
    raise exception 'PLAN_LIMIT_PROJECTS'
      using errcode = 'P0001',
            hint = 'Upgrade your Atlas plan to create more websites.';
  end if;

  return new;
end;
$$;

drop trigger if exists projects_enforce_plan_limit on public.projects;
create trigger projects_enforce_plan_limit
  before insert on public.projects
  for each row execute function public.enforce_project_plan_limit();
