-- Atlas Sprint 18.0B: website analytics foundation
-- Apply in the Supabase SQL editor, or via `supabase db push`.

create extension if not exists "pgcrypto";

-- Resolve project owner for public collect inserts (anon cannot SELECT projects).
create or replace function public.project_owner_id(p_project_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select owner_id from public.projects where id = p_project_id limit 1;
$$;

revoke all on function public.project_owner_id(uuid) from public;
grant execute on function public.project_owner_id(uuid) to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- site_visits — one row per browser session (privacy-friendly hashed visitor)
-- ---------------------------------------------------------------------------
create table if not exists public.site_visits (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  session_id text not null,
  visitor_id text not null,
  page_path text not null default '/',
  referrer text not null default '',
  utm_source text not null default '',
  utm_medium text not null default '',
  utm_campaign text not null default '',
  country text not null default '',
  region text not null default '',
  city text not null default '',
  device_type text not null default 'desktop'
    check (device_type in ('desktop', 'tablet', 'mobile', 'other')),
  browser text not null default 'Other',
  operating_system text not null default 'Other',
  screen_size text not null default '',
  language text not null default '',
  duration_seconds integer not null default 0
    check (duration_seconds >= 0 and duration_seconds <= 86400),
  bounced boolean not null default true,
  created_at timestamptz not null default now(),
  constraint site_visits_session_id_length check (char_length(session_id) between 8 and 128),
  constraint site_visits_visitor_id_length check (char_length(visitor_id) between 8 and 128),
  constraint site_visits_page_path_length check (char_length(page_path) between 1 and 500),
  constraint site_visits_referrer_length check (char_length(referrer) <= 1000),
  constraint site_visits_utm_length check (
    char_length(utm_source) <= 120
    and char_length(utm_medium) <= 120
    and char_length(utm_campaign) <= 200
  ),
  constraint site_visits_geo_length check (
    char_length(country) <= 80
    and char_length(region) <= 80
    and char_length(city) <= 80
  ),
  constraint site_visits_ua_length check (
    char_length(browser) <= 80
    and char_length(operating_system) <= 80
    and char_length(screen_size) <= 40
    and char_length(language) <= 40
  )
);

create unique index if not exists site_visits_project_session_uidx
  on public.site_visits (project_id, session_id);

create index if not exists site_visits_owner_id_idx
  on public.site_visits (owner_id);

create index if not exists site_visits_project_id_idx
  on public.site_visits (project_id);

create index if not exists site_visits_created_at_idx
  on public.site_visits (created_at desc);

create index if not exists site_visits_project_created_idx
  on public.site_visits (project_id, created_at desc);

create index if not exists site_visits_visitor_id_idx
  on public.site_visits (visitor_id);

alter table public.site_visits enable row level security;

-- Public published sites may insert visits (API uses anon key). Never SELECT.
drop policy if exists "Public can insert site visits" on public.site_visits;
create policy "Public can insert site visits"
  on public.site_visits
  for insert
  to anon, authenticated
  with check (
    owner_id = public.project_owner_id(project_id)
    and public.project_owner_id(project_id) is not null
  );

drop policy if exists "Public can update own session visits" on public.site_visits;
create policy "Public can update own session visits"
  on public.site_visits
  for update
  to anon, authenticated
  using (
    owner_id = public.project_owner_id(project_id)
  )
  with check (
    owner_id = public.project_owner_id(project_id)
  );

drop policy if exists "Owners can select own site visits" on public.site_visits;
create policy "Owners can select own site visits"
  on public.site_visits
  for select
  to authenticated
  using (
    auth.uid() = owner_id
    and exists (
      select 1 from public.projects p
      where p.id = project_id and p.owner_id = auth.uid()
    )
  );

-- No public SELECT. No DELETE in 18.0B.

-- ---------------------------------------------------------------------------
-- page_views — page hits within a visit/session
-- ---------------------------------------------------------------------------
create table if not exists public.page_views (
  id uuid primary key default gen_random_uuid(),
  visit_id uuid not null references public.site_visits (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  page_path text not null default '/',
  "timestamp" timestamptz not null default now(),
  constraint page_views_page_path_length check (char_length(page_path) between 1 and 500)
);

create index if not exists page_views_visit_id_idx
  on public.page_views (visit_id);

create index if not exists page_views_project_id_idx
  on public.page_views (project_id);

create index if not exists page_views_timestamp_idx
  on public.page_views ("timestamp" desc);

create index if not exists page_views_project_path_idx
  on public.page_views (project_id, page_path);

alter table public.page_views enable row level security;

drop policy if exists "Public can insert page views" on public.page_views;
create policy "Public can insert page views"
  on public.page_views
  for insert
  to anon, authenticated
  with check (
    exists (
      select 1 from public.site_visits v
      where v.id = visit_id
        and v.project_id = page_views.project_id
        and v.owner_id = public.project_owner_id(page_views.project_id)
    )
  );

drop policy if exists "Owners can select own page views" on public.page_views;
create policy "Owners can select own page views"
  on public.page_views
  for select
  to authenticated
  using (
    exists (
      select 1 from public.projects p
      where p.id = project_id and p.owner_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- Lead attribution columns (optional join keys for conversions)
-- ---------------------------------------------------------------------------
alter table public.lead_submissions
  add column if not exists session_id text;

alter table public.lead_submissions
  add column if not exists visitor_id text;

alter table public.lead_submissions
  add column if not exists landing_page text;

alter table public.lead_submissions
  add column if not exists referrer text;

alter table public.lead_submissions
  add column if not exists utm_source text;

alter table public.lead_submissions
  add column if not exists utm_medium text;

alter table public.lead_submissions
  add column if not exists utm_campaign text;

comment on table public.site_visits is
  'Privacy-friendly session analytics. Never store raw IP addresses.';
comment on column public.site_visits.visitor_id is
  'Hashed visitor identifier (not raw UUID / not IP).';
comment on column public.site_visits.session_id is
  'Opaque session token from the published site (not IP-derived).';
