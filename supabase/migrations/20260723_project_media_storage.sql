-- Atlas Sprint 14.3I: project-media Storage bucket + RLS (private bucket)
-- Apply in the Supabase SQL editor, or via `supabase db push`.
--
-- Folder layout: {userId}/{projectId}/{unique-file-name}
-- Browser clients use signed URLs (createSignedUrl) — never getPublicUrl.
-- Publishable/anon key only; never the service-role key.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'project-media',
  'project-media',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- First path segment must equal auth.uid() (owner folder).
-- Example object name: "a1b2…/project-uuid/photo.webp"

drop policy if exists "project-media: owners can select own files" on storage.objects;
drop policy if exists "project-media: owners can insert own files" on storage.objects;
drop policy if exists "project-media: owners can update own files" on storage.objects;
drop policy if exists "project-media: owners can delete own files" on storage.objects;
drop policy if exists "project-media: public can read" on storage.objects;

-- Private bucket: only the owning authenticated user may read objects.
create policy "project-media: owners can select own files"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'project-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "project-media: owners can insert own files"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'project-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "project-media: owners can update own files"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'project-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'project-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "project-media: owners can delete own files"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'project-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
