-- Profile avatars. A public bucket so a photo is reachable by a stable URL for the owner and any
-- co-member who can already read the owner's profile row (avatars are display photos, not
-- sensitive). Objects are keyed by the owner's user id as the first path segment; writes are
-- restricted to that owner, reads are public (the bucket is public). 5 MB cap, common image types.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

-- A user may write/replace/remove only objects under their own <uid>/ folder. Reads are public,
-- so no select policy is needed (the bucket is public).
create policy "avatars_insert_own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "avatars_update_own" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "avatars_delete_own" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
