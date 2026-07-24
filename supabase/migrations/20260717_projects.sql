-- Atlas Sprint 14.3A: structured projects table + RLS
-- Apply in the Supabase SQL editor, or via `supabase db push`.

create extension if not exists "pgcrypto";

-- If an earlier draft schema exists (user_id + data jsonb), drop it so this
-- foundation migration can create the structured table. Safe for early sprints;
-- do not run against production data you need to keep.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'projects'
      and column_name = 'user_id'
  ) then
    drop table public.projects cascade;
  end if;
end $$;

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  business_name text not null,
  business_type text,
  description text,
  goals jsonb not null default '[]'::jsonb,
  content jsonb not null default '{}'::jsonb,
  branding jsonb not null default '{}'::jsonb,
  template text,
  media jsonb not null default '[]'::jsonb,
  status text not null default 'draft',
  published_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists projects_owner_id_idx on public.projects (owner_id);
create index if not exists projects_updated_at_idx on public.projects (updated_at desc);

-- Keep updated_at fresh on every row change.
create or replace function public.set_projects_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists projects_set_updated_at on public.projects;
create trigger projects_set_updated_at
  before update on public.projects
  for each row
  execute function public.set_projects_updated_at();

alter table public.projects enable row level security;

drop policy if exists "Users can select own projects" on public.projects;
drop policy if exists "Users can insert own projects" on public.projects;
drop policy if exists "Users can update own projects" on public.projects;
drop policy if exists "Users can delete own projects" on public.projects;

create policy "Users can select own projects"
  on public.projects
  for select
  to authenticated
  using (auth.uid() = owner_id);

create policy "Users can insert own projects"
  on public.projects
  for insert
  to authenticated
  with check (auth.uid() = owner_id);

create policy "Users can update own projects"
  on public.projects
  for update
  to authenticated
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy "Users can delete own projects"
  on public.projects
  for delete
  to authenticated
  using (auth.uid() = owner_id);
