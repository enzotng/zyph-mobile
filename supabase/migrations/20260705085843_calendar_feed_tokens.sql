-- WHY: the per-trip ICS calendar feed is consumed by calendar clients that cannot authenticate -
-- the webcal URL is a bearer capability. Tokens are stored HASHED (sha-256) in the private schema
-- (deny-all RLS, service-role only - same convention as private.rate_limits/places_cache); the
-- raw token is returned exactly once by the creating RPC. One live token per (trip, member);
-- regenerating revokes the previous one. Serve-time validity additionally requires the owning
-- member to still be ACTIVE on the trip, so leaving/removal kills the feed without cleanup.
create table private.calendar_feed_tokens (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

alter table private.calendar_feed_tokens enable row level security;

create index calendar_feed_tokens_live_idx
  on private.calendar_feed_tokens (trip_id, user_id)
  where revoked_at is null;

-- Creates (or regenerates) the caller's feed token for a trip. Returns the RAW token - shown
-- once, never stored. Membership must be active.
create or replace function public.create_calendar_feed_token(_trip_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  _uid uuid := auth.uid();
  _token text;
begin
  if not exists (
    select 1 from public.trip_members
    where trip_id = _trip_id and user_id = _uid and status = 'active'
  ) then
    raise exception 'not an active member of this trip';
  end if;

  update private.calendar_feed_tokens
  set revoked_at = now()
  where trip_id = _trip_id and user_id = _uid and revoked_at is null;

  _token := encode(extensions.gen_random_bytes(32), 'hex');

  insert into private.calendar_feed_tokens (trip_id, user_id, token_hash)
  values (_trip_id, _uid, encode(extensions.digest(_token, 'sha256'), 'hex'));

  return _token;
end;
$$;

revoke all on function public.create_calendar_feed_token(uuid) from public;
revoke all on function public.create_calendar_feed_token(uuid) from anon;
grant execute on function public.create_calendar_feed_token(uuid) to authenticated;

-- Revokes the caller's live token for a trip (no-op if none).
create or replace function public.revoke_calendar_feed_token(_trip_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  _uid uuid := auth.uid();
begin
  update private.calendar_feed_tokens
  set revoked_at = now()
  where trip_id = _trip_id and user_id = _uid and revoked_at is null;
end;
$$;

revoke all on function public.revoke_calendar_feed_token(uuid) from public;
revoke all on function public.revoke_calendar_feed_token(uuid) from anon;
grant execute on function public.revoke_calendar_feed_token(uuid) to authenticated;
