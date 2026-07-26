-- Atlas Sprint 14.4C: public site-previews Storage bucket for static preview hosting.
-- Apply in the Supabase SQL editor, or via `supabase db push`.
--
-- Folder layout: {userId}/{slug}/{relative-file-path}
-- Example: a1b2…/olive-branch/index.html
--
-- Public read (preview URLs); authenticated owners may write/delete their folder.
-- Publishable/anon key only from the browser — never the service-role key.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'site-previews',
  'site-previews',
  true,
  10485760,
  array[
    'text/html',
    'text/css',
    'text/plain',
    'application/json',
    'image/svg+xml',
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'application/octet-stream'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "site-previews: public can read" on storage.objects;
drop policy if exists "site-previews: owners can insert" on storage.objects;
drop policy if exists "site-previews: owners can update" on storage.objects;
drop policy if exists "site-previews: owners can delete" on storage.objects;
drop policy if exists "site-previews: owners can select own files" on storage.objects;

-- Anyone can read preview sites (public bucket + public select).
create policy "site-previews: public can read"
  on storage.objects
  for select
  to public
  using (bucket_id = 'site-previews');

create policy "site-previews: owners can insert"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'site-previews'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "site-previews: owners can update"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'site-previews'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'site-previews'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "site-previews: owners can delete"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'site-previews'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
