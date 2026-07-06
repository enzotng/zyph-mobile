-- WHY: each trip gets a dedicated inbound email address (roadtrip-<slug>@zyph.enzotang.fr).
-- Forwarded booking emails hit Brevo inbound parsing -> our webhook -> the resolver RPC below maps
-- the envelope recipient's local part back to a trip. The slug is a semi-public capability (it
-- travels through every MTA a forward touches), so it is NOT the security boundary - the private
-- schema + service-role-only resolver + the human review gate are. Unlike the calendar token
-- (hashed, show-once), the slug is stored PLAINTEXT because it must be looked up from an inbound
-- local part AND re-displayed in trip settings (a durable auto-forward config, not a one-time
-- secret). One live address per trip; regenerating revokes the previous one.
create table private.trip_inbox_addresses (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  slug_normalized text not null unique,
  auto_validate boolean not null default false,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

alter table private.trip_inbox_addresses enable row level security;

-- One live address per trip: declarative, so two concurrent creates cannot leave two live slugs.
create unique index trip_inbox_addresses_live_key
  on private.trip_inbox_addresses (trip_id)
  where revoked_at is null;

-- WHY: Brevo delivers at-least-once and retries on a non-2xx webhook. This ledger is written for
-- EVERY inbound webhook (including dropped/garbage mail) so a retry is a cheap no-op and never
-- re-parses. Deny-all RLS, service-role only. Pruned by cron (30d).
create table private.processed_inbound_webhooks (
  provider_email_id text primary key,
  received_at timestamptz not null default now()
);

alter table private.processed_inbound_webhooks enable row level security;

-- Creates (or regenerates) the trip's inbound address. Any active member may call it (the address
-- is shared, not per-member) - the client warns about the group-wide impact. Returns the full
-- address; the slug's random suffix is >= 80 bits (blind enumeration is pointless: catch-all has
-- no bounce and the resolver drops uniformly with no oracle).
create or replace function public.create_trip_inbox_address(_trip_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  _uid uuid := auth.uid();
  _title text;
  _prefix text;
  _slug text;
begin
  if not exists (
    select 1 from public.trip_members
    where trip_id = _trip_id and user_id = _uid and status = 'active'
  ) then
    raise exception 'not an active member of this trip';
  end if;

  select title into _title from public.trips where id = _trip_id;
  _prefix := trim(both '-' from lower(regexp_replace(coalesce(_title, 'trip'), '[^a-z0-9]+', '-', 'gi')));
  _prefix := left(_prefix, 16);
  if _prefix = '' then
    _prefix := 'trip';
  end if;
  _slug := _prefix || '-' || encode(extensions.gen_random_bytes(10), 'hex');

  update private.trip_inbox_addresses
  set revoked_at = now()
  where trip_id = _trip_id and revoked_at is null;

  insert into private.trip_inbox_addresses (trip_id, slug_normalized)
  values (_trip_id, _slug);

  return _slug || '@zyph.enzotang.fr';
end;
$$;

revoke all on function public.create_trip_inbox_address(uuid) from public;
revoke all on function public.create_trip_inbox_address(uuid) from anon;
grant execute on function public.create_trip_inbox_address(uuid) to authenticated;

-- Revokes the trip's live address (no-op if none). Any active member.
create or replace function public.revoke_trip_inbox_address(_trip_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  _uid uuid := auth.uid();
begin
  if not exists (
    select 1 from public.trip_members
    where trip_id = _trip_id and user_id = _uid and status = 'active'
  ) then
    raise exception 'not an active member of this trip';
  end if;

  update private.trip_inbox_addresses
  set revoked_at = now()
  where trip_id = _trip_id and revoked_at is null;
end;
$$;

revoke all on function public.revoke_trip_inbox_address(uuid) from public;
revoke all on function public.revoke_trip_inbox_address(uuid) from anon;
grant execute on function public.revoke_trip_inbox_address(uuid) to authenticated;

-- Returns the trip's live address (or null), for display in settings. Any active member.
create or replace function public.get_trip_inbox_address(_trip_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  _uid uuid := auth.uid();
  _slug text;
begin
  if not exists (
    select 1 from public.trip_members
    where trip_id = _trip_id and user_id = _uid and status = 'active'
  ) then
    raise exception 'not an active member of this trip';
  end if;

  select slug_normalized into _slug
  from private.trip_inbox_addresses
  where trip_id = _trip_id and revoked_at is null;

  if _slug is null then
    return null;
  end if;
  return _slug || '@zyph.enzotang.fr';
end;
$$;

revoke all on function public.get_trip_inbox_address(uuid) from public;
revoke all on function public.get_trip_inbox_address(uuid) from anon;
grant execute on function public.get_trip_inbox_address(uuid) to authenticated;

-- Toggles TripIt-style auto-validation for the trip's live address (D5). OFF by default; when ON,
-- an unambiguous parse is inserted straight into the timeline (attributed + soft-deletable) rather
-- than held as a proposal. Any active member.
create or replace function public.set_trip_inbox_autovalidate(_trip_id uuid, _on boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  _uid uuid := auth.uid();
begin
  if not exists (
    select 1 from public.trip_members
    where trip_id = _trip_id and user_id = _uid and status = 'active'
  ) then
    raise exception 'not an active member of this trip';
  end if;

  update private.trip_inbox_addresses
  set auto_validate = _on
  where trip_id = _trip_id and revoked_at is null;
end;
$$;

revoke all on function public.set_trip_inbox_autovalidate(uuid, boolean) from public;
revoke all on function public.set_trip_inbox_autovalidate(uuid, boolean) from anon;
grant execute on function public.set_trip_inbox_autovalidate(uuid, boolean) to authenticated;

-- WHY: the inbound edge function (verify_jwt=false, no auth.uid()) must map an incoming envelope
-- recipient to a trip. PostgREST does not expose the private schema, so this is the ONE public
-- SECURITY DEFINER path in. It normalizes the recipient (lower-case local part, strip +suffix),
-- finds the live address, and enforces a fixed-window rate limit keyed on the TRIP (there is no
-- user identity here - the shared rate_limits table is keyed on the trip id in the user_id slot,
-- same upsert idiom as check_rate_limit). Empty result = no match (edge drops uniformly, no
-- oracle). Service-role only.
create or replace function public.resolve_trip_inbox(
  _recipient text,
  _limit integer default 30,
  _window_seconds integer default 60
)
returns table (trip_id uuid, auto_validate boolean, rate_limited boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  _local text;
  _row record;
  _count integer;
begin
  _local := split_part(lower(_recipient), '@', 1);
  _local := split_part(_local, '+', 1);

  select a.trip_id, a.auto_validate into _row
  from private.trip_inbox_addresses a
  where a.slug_normalized = _local and a.revoked_at is null;

  if _row.trip_id is null then
    return;
  end if;

  insert into private.rate_limits as r (user_id, bucket, window_start, count)
  values (_row.trip_id, 'inbox:' || _row.trip_id, now(), 1)
  on conflict (user_id, bucket) do update
    set
      count = case
        when r.window_start < now() - make_interval(secs => _window_seconds) then 1
        else r.count + 1
      end,
      window_start = case
        when r.window_start < now() - make_interval(secs => _window_seconds) then now()
        else r.window_start
      end
  returning r.count into _count;

  return query select _row.trip_id, _row.auto_validate, _count > _limit;
end;
$$;

revoke all on function public.resolve_trip_inbox(text, integer, integer) from public;
revoke all on function public.resolve_trip_inbox(text, integer, integer) from anon;
revoke all on function public.resolve_trip_inbox(text, integer, integer) from authenticated;
grant execute on function public.resolve_trip_inbox(text, integer, integer) to service_role;
