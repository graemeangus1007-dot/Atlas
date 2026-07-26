-- Atlas Sprint 16.0C: link existing Vercel projects (zero-downtime domain adoption)

alter table public.project_domains
  add column if not exists linked_project_id text;

alter table public.project_domains
  add column if not exists linked_project_name text;

alter table public.project_domains
  add column if not exists migration_state text not null default 'none';

alter table public.project_domains
  add column if not exists linked_at timestamptz;

-- Drop and recreate so existing rows keep a valid default.
alter table public.project_domains
  drop constraint if exists project_domains_migration_state_check;

alter table public.project_domains
  add constraint project_domains_migration_state_check
  check (
    migration_state in (
      'none',
      'detected',
      'linked',
      'migrated'
    )
  );

create index if not exists project_domains_linked_project_id_idx
  on public.project_domains (linked_project_id)
  where linked_project_id is not null;

create index if not exists project_domains_migration_state_idx
  on public.project_domains (migration_state);
