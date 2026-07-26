-- Atlas Sprint 16.0B: DNS verification & SSL activation statuses

-- Expand allowed domain statuses for the verification pipeline.
alter table public.project_domains
  drop constraint if exists project_domains_status_check;

alter table public.project_domains
  add constraint project_domains_status_check
  check (
    status in (
      'pending',
      'verifying',
      'ssl_provisioning',
      'verified',
      'active',
      'failed'
    )
  );

-- Backfill legacy "verified" rows into ssl_provisioning (ownership ok, not live yet).
update public.project_domains
set status = 'ssl_provisioning'
where status = 'verified'
  and activated_at is null;
