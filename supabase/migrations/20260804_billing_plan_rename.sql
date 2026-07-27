-- Atlas Sprint 19.0B pricing update: free→starter, pro→professional
-- List prices live in app config (lib/billing/plans.ts), not in SQL.

do $$ begin
  alter type public.atlas_plan rename value 'free' to 'starter';
exception
  when undefined_object then null;
  when invalid_parameter_value then null; -- already renamed
end $$;

do $$ begin
  alter type public.atlas_plan rename value 'pro' to 'professional';
exception
  when undefined_object then null;
  when invalid_parameter_value then null;
end $$;

-- Refresh locked feature flags for unpaid bootstrap rows
update public.subscriptions
set
  plan = 'starter',
  feature_flags = jsonb_build_object(
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
  ),
  updated_at = now()
where plan::text in ('starter', 'free')
  and status in ('none', 'canceled');

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
