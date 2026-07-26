-- Atlas Sprint 17.0B: email notifications + lead inbox enhancements
-- Apply in the Supabase SQL editor, or via `supabase db push`.

-- ---------------------------------------------------------------------------
-- lead_forms — owner notification settings
-- ---------------------------------------------------------------------------
alter table public.lead_forms
  add column if not exists notification_email text,
  add column if not exists email_notifications_enabled boolean not null default true,
  add column if not exists email_subject_template text not null
    default 'New lead from {{name}} — {{project}}',
  add column if not exists last_notification_error text,
  add column if not exists last_notification_at timestamptz;

alter table public.lead_forms
  drop constraint if exists lead_forms_notification_email_length;

alter table public.lead_forms
  add constraint lead_forms_notification_email_length
  check (
    notification_email is null
    or char_length(notification_email) between 3 and 320
  );

alter table public.lead_forms
  drop constraint if exists lead_forms_email_subject_template_length;

alter table public.lead_forms
  add constraint lead_forms_email_subject_template_length
  check (char_length(email_subject_template) between 1 and 200);

-- ---------------------------------------------------------------------------
-- lead_submissions — inbox + notification delivery tracking
-- ---------------------------------------------------------------------------
alter table public.lead_submissions
  add column if not exists is_starred boolean not null default false,
  add column if not exists internal_notes text not null default '',
  add column if not exists notification_status text not null default 'pending',
  add column if not exists notification_attempted_at timestamptz,
  add column if not exists notification_sent_at timestamptz,
  add column if not exists notification_error text,
  add column if not exists notification_provider_message_id text;

alter table public.lead_submissions
  drop constraint if exists lead_submissions_notification_status_check;

alter table public.lead_submissions
  add constraint lead_submissions_notification_status_check
  check (
    notification_status in (
      'pending',
      'skipped',
      'sending',
      'sent',
      'failed'
    )
  );

alter table public.lead_submissions
  drop constraint if exists lead_submissions_internal_notes_length;

alter table public.lead_submissions
  add constraint lead_submissions_internal_notes_length
  check (char_length(internal_notes) <= 5000);

create index if not exists lead_submissions_is_starred_idx
  on public.lead_submissions (owner_id, is_starred)
  where is_starred = true;

create index if not exists lead_submissions_notification_status_idx
  on public.lead_submissions (owner_id, notification_status);

create index if not exists lead_submissions_status_created_idx
  on public.lead_submissions (owner_id, project_id, status, created_at desc);

-- Existing owner UPDATE policies already cover new columns (is_starred, notes, etc.).
-- Public INSERT remains limited to enabled forms; notification_status may be set
-- to 'pending' on insert by the submit API using the anon client.

-- Prevent anon from reading owner notification settings (email, errors, etc.).
-- Authenticated owners keep full-row SELECT via existing RLS policies.
revoke select on public.lead_forms from anon;
grant select (
  id,
  project_id,
  owner_id,
  name,
  description,
  success_message,
  is_enabled,
  created_at,
  updated_at
) on public.lead_forms to anon;
