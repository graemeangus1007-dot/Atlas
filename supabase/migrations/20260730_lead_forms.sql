-- Atlas Sprint 17.0A: contact forms foundation & lead storage
-- Apply in the Supabase SQL editor, or via `supabase db push`.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- lead_forms — one configurable form per project (for now)
-- ---------------------------------------------------------------------------
create table if not exists public.lead_forms (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null default 'Contact form',
  description text not null default '',
  success_message text not null default 'Thanks — we received your message and will get back to you soon.',
  is_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lead_forms_project_id_unique unique (project_id),
  constraint lead_forms_name_length check (char_length(name) between 1 and 120),
  constraint lead_forms_success_message_length check (char_length(success_message) between 1 and 500)
);

create index if not exists lead_forms_owner_id_idx
  on public.lead_forms (owner_id);

create index if not exists lead_forms_project_id_idx
  on public.lead_forms (project_id);

create or replace function public.set_lead_forms_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists lead_forms_set_updated_at on public.lead_forms;
create trigger lead_forms_set_updated_at
  before update on public.lead_forms
  for each row
  execute function public.set_lead_forms_updated_at();

create or replace function public.reject_lead_forms_ownership_change()
returns trigger
language plpgsql
as $$
begin
  if new.project_id is distinct from old.project_id
     or new.owner_id is distinct from old.owner_id then
    raise exception 'lead_forms ownership fields are immutable';
  end if;
  return new;
end;
$$;

drop trigger if exists lead_forms_reject_ownership_change on public.lead_forms;
create trigger lead_forms_reject_ownership_change
  before update on public.lead_forms
  for each row
  execute function public.reject_lead_forms_ownership_change();

alter table public.lead_forms enable row level security;

drop policy if exists "Owners can select own lead forms" on public.lead_forms;
create policy "Owners can select own lead forms"
  on public.lead_forms
  for select
  to authenticated
  using (
    auth.uid() = owner_id
    and exists (
      select 1 from public.projects p
      where p.id = project_id and p.owner_id = auth.uid()
    )
  );

drop policy if exists "Owners can insert own lead forms" on public.lead_forms;
create policy "Owners can insert own lead forms"
  on public.lead_forms
  for insert
  to authenticated
  with check (
    auth.uid() = owner_id
    and exists (
      select 1 from public.projects p
      where p.id = project_id and p.owner_id = auth.uid()
    )
  );

drop policy if exists "Owners can update own lead forms" on public.lead_forms;
create policy "Owners can update own lead forms"
  on public.lead_forms
  for update
  to authenticated
  using (
    auth.uid() = owner_id
    and exists (
      select 1 from public.projects p
      where p.id = project_id and p.owner_id = auth.uid()
    )
  )
  with check (
    auth.uid() = owner_id
    and exists (
      select 1 from public.projects p
      where p.id = project_id and p.owner_id = auth.uid()
    )
  );

drop policy if exists "Owners can delete own lead forms" on public.lead_forms;
create policy "Owners can delete own lead forms"
  on public.lead_forms
  for delete
  to authenticated
  using (
    auth.uid() = owner_id
    and exists (
      select 1 from public.projects p
      where p.id = project_id and p.owner_id = auth.uid()
    )
  );

-- Public sites need form metadata (id, enabled, success_message) to submit.
-- Never grants access to lead_submissions.
drop policy if exists "Public can select enabled lead forms" on public.lead_forms;
create policy "Public can select enabled lead forms"
  on public.lead_forms
  for select
  to anon, authenticated
  using (is_enabled = true);

-- ---------------------------------------------------------------------------
-- lead_submissions — public insert only via API + RLS; never readable by anon
-- ---------------------------------------------------------------------------
create table if not exists public.lead_submissions (
  id uuid primary key default gen_random_uuid(),
  form_id uuid not null references public.lead_forms (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null default '',
  email text not null default '',
  phone text,
  company text,
  message text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  ip_hash text,
  user_agent text,
  status text not null default 'new'
    check (status in ('new', 'read', 'archived', 'spam')),
  created_at timestamptz not null default now(),
  constraint lead_submissions_email_length check (char_length(email) between 1 and 320),
  constraint lead_submissions_name_length check (char_length(name) <= 200),
  constraint lead_submissions_message_length check (char_length(message) <= 5000)
);

create index if not exists lead_submissions_owner_id_idx
  on public.lead_submissions (owner_id);

create index if not exists lead_submissions_project_id_idx
  on public.lead_submissions (project_id);

create index if not exists lead_submissions_form_id_idx
  on public.lead_submissions (form_id);

create index if not exists lead_submissions_status_idx
  on public.lead_submissions (status);

create index if not exists lead_submissions_created_at_idx
  on public.lead_submissions (created_at desc);

alter table public.lead_submissions enable row level security;

-- Public websites may insert into enabled forms (API uses anon key).
-- They must never SELECT submissions.
drop policy if exists "Public can insert submissions to enabled forms"
  on public.lead_submissions;
create policy "Public can insert submissions to enabled forms"
  on public.lead_submissions
  for insert
  to anon, authenticated
  with check (
    exists (
      select 1 from public.lead_forms f
      where f.id = form_id
        and f.is_enabled = true
        and f.project_id = lead_submissions.project_id
        and f.owner_id = lead_submissions.owner_id
    )
  );

drop policy if exists "Owners can select own lead submissions"
  on public.lead_submissions;
create policy "Owners can select own lead submissions"
  on public.lead_submissions
  for select
  to authenticated
  using (
    auth.uid() = owner_id
    and exists (
      select 1 from public.projects p
      where p.id = project_id and p.owner_id = auth.uid()
    )
  );

drop policy if exists "Owners can update own lead submissions"
  on public.lead_submissions;
create policy "Owners can update own lead submissions"
  on public.lead_submissions
  for update
  to authenticated
  using (
    auth.uid() = owner_id
    and exists (
      select 1 from public.projects p
      where p.id = project_id and p.owner_id = auth.uid()
    )
  )
  with check (
    auth.uid() = owner_id
    and exists (
      select 1 from public.projects p
      where p.id = project_id and p.owner_id = auth.uid()
    )
  );

-- No DELETE policy in 17.0A (no delete yet).
-- No SELECT policy for anon — public website can never read submissions.
