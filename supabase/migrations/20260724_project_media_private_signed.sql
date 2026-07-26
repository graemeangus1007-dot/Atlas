-- Ensure project-media stays private and only owners can read via signed URLs.
-- Safe to re-run if the bucket was previously public.

update storage.buckets
set public = false
where id = 'project-media';

drop policy if exists "project-media: public can read" on storage.objects;

drop policy if exists "project-media: owners can select own files" on storage.objects;
create policy "project-media: owners can select own files"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'project-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
