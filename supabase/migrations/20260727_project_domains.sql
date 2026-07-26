-- Atlas Sprint 16.0A: custom domain data model & verification foundation
-- Apply in the Supabase SQL editor, or via `supabase db push`.

create extension if not exists "pgcrypto";

create table if not exists public.project_domains (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  hostname text not null,
  normalized_hostname text not null,
  domain_type text not null check (domain_type in ('apex', 'subdomain')),
  status text not null default 'pending'
    check (status in ('pending', 'verifying', 'verified', 'active', 'failed')),
  verification_token text not null,
  verification_method text not null default 'dns-txt',
  verification_records jsonb not null default '[]'::jsonb,
  provider text not null default 'mock',
  provider_domain_id text,
  last_checked_at timestamptz,
  verified_at timestamptz,
  activated_at timestamptz,
  failure_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- One hostname globally (prevents two projects claiming the same domain).
  constraint project_domains_normalized_hostname_unique unique (normalized_hostname),
  -- One primary custom domain per project for now.
  constraint project_domains_project_id_unique unique (project_id),
  -- Safe hostname constraints (no protocol/path; labels only).
  constraint project_domains_hostname_format check (
    hostname ~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$'
    and char_length(hostname) between 1 and 253
    and position('*' in hostname) = 0
    and position(':' in hostname) = 0
    and position('/' in hostname) = 0
  ),
  constraint project_domains_normalized_matches check (
    normalized_hostname = lower(hostname)
  )
);

create index if not exists project_domains_owner_id_idx
  on public.project_domains (owner_id);

create index if not exists project_domains_status_idx
  on public.project_domains (status);

-- Keep updated_at fresh.
create or replace function public.set_project_domains_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists project_domains_set_updated_at on public.project_domains;
create trigger project_domains_set_updated_at
  before update on public.project_domains
  for each row
  execute function public.set_project_domains_updated_at();

-- Ownership fields are immutable after insert.
create or replace function public.reject_project_domain_ownership_change()
returns trigger
language plpgsql
as $$
begin
  if new.project_id is distinct from old.project_id
     or new.owner_id is distinct from old.owner_id then
    raise exception 'project_domains ownership fields are immutable';
  end if;
  return new;
end;
$$;

drop trigger if exists project_domains_reject_ownership_change on public.project_domains;
create trigger project_domains_reject_ownership_change
  before update on public.project_domains
  for each row
  execute function public.reject_project_domain_ownership_change();

alter table public.project_domains enable row level security;

drop policy if exists "Users can select own project domains" on public.project_domains;
drop policy if exists "Users can insert own project domains" on public.project_domains;
drop policy if exists "Users can update own project domains" on public.project_domains;
drop policy if exists "Users can delete own project domains" on public.project_domains;

create policy "Users can select own project domains"
  on public.project_domains
  for select
  to authenticated
  using (
    auth.uid() = owner_id
    and exists (
      select 1
      from public.projects p
      where p.id = project_domains.project_id
        and p.owner_id = auth.uid()
    )
  );

create policy "Users can insert own project domains"
  on public.project_domains
  for insert
  to authenticated
  with check (
    auth.uid() = owner_id
    and exists (
      select 1
      from public.projects p
      where p.id = project_id
        and p.owner_id = auth.uid()
    )
  );

create policy "Users can update own project domains"
  on public.project_domains
  for update
  to authenticated
  using (
    auth.uid() = owner_id
    and exists (
      select 1
      from public.projects p
      where p.id = project_domains.project_id
        and p.owner_id = auth.uid()
    )
  )
  with check (
    auth.uid() = owner_id
    and exists (
      select 1
      from public.projects p
      where p.id = project_id
        and p.owner_id = auth.uid()
    )
  );

create policy "Users can delete own project domains"
  on public.project_domains
  for delete
  to authenticated
  using (
    auth.uid() = owner_id
    and exists (
      select 1
      from public.projects p
      where p.id = project_domains.project_id
        and p.owner_id = auth.uid()
    )
  );
