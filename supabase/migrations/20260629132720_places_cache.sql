-- Server-side cache for Google Places (New) POI searches, to cut recurring API cost when
-- members of the same trip query the same destination/category. Written ONLY by the poi-search
-- edge function via the service role (like upload-trip-cover) - never client-callable, so it
-- cannot be poisoned. Lives in the private schema (not exposed to PostgREST), no client grants.
-- A TTL is applied at read time in the edge (fetched_at), not by the DB.

create table if not exists private.places_cache (
  query_hash text primary key,
  payload jsonb not null,
  fetched_at timestamptz not null default now()
);

-- Enable RLS with no policy (deny-all to anon/authenticated; the service role bypasses it),
-- matching the private.rate_limits convention. Clients have no access to the private schema.
alter table private.places_cache enable row level security;
