-- Atlas Sprint 14: auth-backed multi-project persistence
-- Run in the Supabase SQL editor (or via supabase db push).

create extension if not exists "pgcrypto";

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  data jsonb not null default '{}'::jsonb,
  status text not null default 'draft'
    check (status in ('draft', 'generating', 'ready', 'published')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists projects_user_id_idx on public.projects (user_id);
create index if not exists projects_updated_at_idx on public.projects (updated_at desc);

alter table public.projects enable row level security;

create policy "Users can select own projects"
  on public.projects
  for select
  using (auth.uid() = user_id);

create policy "Users can insert own projects"
  on public.projects
  for insert
  with check (auth.uid() = user_id);

create policy "Users can update own projects"
  on public.projects
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own projects"
  on public.projects
  for delete
  using (auth.uid() = user_id);

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
