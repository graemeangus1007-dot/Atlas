-- Atlas Sprint 15.0A: immutable publish version history
-- Apply in the Supabase SQL editor, or via `supabase db push`.

create extension if not exists "pgcrypto";

create table if not exists public.publish_versions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  version_number integer not null,
  artifact_fingerprint text not null,
  deployment_provider text not null,
  deployment_id text not null,
  preview_url text not null,
  deployment_status text not null,
  -- Structured project snapshot at publish time (no generated HTML / credentials).
  project_snapshot jsonb not null,
  created_at timestamptz not null default now(),
  constraint publish_versions_version_number_positive
    check (version_number > 0),
  constraint publish_versions_project_version_unique
    unique (project_id, version_number)
);

create index if not exists publish_versions_project_id_created_at_idx
  on public.publish_versions (project_id, created_at desc);

create index if not exists publish_versions_owner_id_idx
  on public.publish_versions (owner_id);

create index if not exists publish_versions_deployment_id_idx
  on public.publish_versions (deployment_id);

-- Assign the next per-project version number when omitted (immutable after insert).
create or replace function public.set_publish_version_number()
returns trigger
language plpgsql
as $$
begin
  if new.version_number is null or new.version_number <= 0 then
    -- Serialize increments for the same project within a transaction.
    perform pg_advisory_xact_lock(
      hashtext('publish_versions:' || new.project_id::text)
    );
    select coalesce(max(v.version_number), 0) + 1
      into new.version_number
    from public.publish_versions v
    where v.project_id = new.project_id;
  end if;
  return new;
end;
$$;

drop trigger if exists publish_versions_set_version_number on public.publish_versions;
create trigger publish_versions_set_version_number
  before insert on public.publish_versions
  for each row
  execute function public.set_publish_version_number();

-- Block updates so version rows stay immutable for clients.
create or replace function public.reject_publish_version_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'publish_versions rows are immutable';
end;
$$;

drop trigger if exists publish_versions_reject_update on public.publish_versions;
create trigger publish_versions_reject_update
  before update on public.publish_versions
  for each row
  execute function public.reject_publish_version_mutation();

alter table public.publish_versions enable row level security;

drop policy if exists "Users can select own publish versions" on public.publish_versions;
drop policy if exists "Users can insert own publish versions" on public.publish_versions;

-- Read: only versions for projects the user owns.
create policy "Users can select own publish versions"
  on public.publish_versions
  for select
  to authenticated
  using (
    auth.uid() = owner_id
    and exists (
      select 1
      from public.projects p
      where p.id = publish_versions.project_id
        and p.owner_id = auth.uid()
    )
  );

-- Insert: must claim own owner_id and own the target project.
create policy "Users can insert own publish versions"
  on public.publish_versions
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

-- No UPDATE / DELETE policies for authenticated users (immutable history).
-- Rows are removed only via projects ON DELETE CASCADE.
