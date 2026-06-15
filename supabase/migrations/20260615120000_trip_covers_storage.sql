-- Trip cover photos the OWNER uploads to override the automatic Google/Unsplash cover.
-- Public bucket so the photo is reachable by a stable URL for every trip member (covers are
-- decorative, not sensitive). Writes happen ONLY through the upload-trip-cover edge function with
-- the service role (it verifies the caller owns the trip), so NO authenticated write policy is
-- granted here - a direct client write stays denied. Reads are public (the bucket is public).
-- Objects are keyed by the trip id as the first path segment: <tripId>/cover. 5 MB cap, image types.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'trip-covers',
  'trip-covers',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;
