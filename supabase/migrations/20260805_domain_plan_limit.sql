-- Atlas Sprint 19.1: enforce custom domain plan limits at the database layer
-- Mirrors project plan limits so direct client inserts cannot bypass API gates.

create or replace function public.enforce_domain_plan_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  sub public.subscriptions;
  domain_count integer;
  max_domains integer;
  entitled boolean;
begin
  perform public.ensure_free_subscription(new.owner_id);
  select * into sub from public.subscriptions where owner_id = new.owner_id;

  entitled := sub.status in ('active', 'trialing', 'past_due');
  if not entitled then
    max_domains := 0;
  elsif sub.plan = 'starter' then
    max_domains := 0;
  elsif sub.plan = 'professional' then
    max_domains := 10;
  else
    -- agency / unlimited
    return new;
  end if;

  select count(*)::integer into domain_count
  from public.project_domains
  where owner_id = new.owner_id;

  if domain_count >= max_domains then
    raise exception 'PLAN_LIMIT_DOMAINS'
      using errcode = 'P0001',
            hint = 'Upgrade your Atlas plan to add more custom domains.';
  end if;

  return new;
end;
$$;

drop trigger if exists project_domains_enforce_plan_limit on public.project_domains;
create trigger project_domains_enforce_plan_limit
  before insert on public.project_domains
  for each row execute function public.enforce_domain_plan_limit();
