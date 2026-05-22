-- Attach PDF documents to events (US-031). Reuses the existing media table; adds the
-- event link + file metadata, and a private Storage bucket with membership-scoped RLS.

alter table public.media
  add column event_id uuid references public.trip_events (id) on delete cascade,
  add column name text,
  add column mime_type text,
  add column size_bytes bigint;

create index media_event_id_idx on public.media (event_id);

-- Private bucket; objects are keyed by trip id as the first path segment so RLS can
-- check membership. PDF only, 25 MB cap.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('trip-documents', 'trip-documents', false, 26214400, array['application/pdf'])
on conflict (id) do nothing;

-- A user may read/add/remove an object only when they are a member of the trip whose
-- id is the object's top-level folder. private.is_trip_member is the same SECURITY
-- DEFINER helper used by the public-table policies.
create policy "trip_documents_select" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'trip-documents'
    and private.is_trip_member(((storage.foldername(name))[1])::uuid)
  );

create policy "trip_documents_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'trip-documents'
    and private.is_trip_member(((storage.foldername(name))[1])::uuid)
  );

create policy "trip_documents_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'trip-documents'
    and private.is_trip_member(((storage.foldername(name))[1])::uuid)
  );
