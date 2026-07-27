-- Atlas Sprint 20.0C: idempotent AI draft → project creation
-- Prevents duplicate projects from double-click / retry / refresh.

create table if not exists public.ai_draft_creations (
  owner_id uuid not null references auth.users (id) on delete cascade,
  idempotency_key text not null,
  project_id uuid not null references public.projects (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (owner_id, idempotency_key)
);

create index if not exists ai_draft_creations_project_id_idx
  on public.ai_draft_creations (project_id);

alter table public.ai_draft_creations enable row level security;

drop policy if exists "Owners select own ai draft creations"
  on public.ai_draft_creations;
create policy "Owners select own ai draft creations"
  on public.ai_draft_creations
  for select
  using (auth.uid() = owner_id);

drop policy if exists "Owners insert own ai draft creations"
  on public.ai_draft_creations;
create policy "Owners insert own ai draft creations"
  on public.ai_draft_creations
  for insert
  with check (auth.uid() = owner_id);

-- No update/delete policies — rows are immutable audit of creation intent.
