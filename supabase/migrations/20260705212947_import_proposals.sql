-- WHY: parsed inbound emails (and "propose to group" from the share flow) become review-gated
-- proposals - nothing enters the timeline without a human validating (or, opt-in per trip,
-- auto-validation). The raw email body is NEVER stored: only the structured parse (`events`, the
-- raw parse shape) + minimal meta. A durable row exists from status='parsing' so a failure leaves
-- something visible/debuggable rather than silence. Active trip members can read; inserts happen
-- via the service-role edge function or the SECURITY DEFINER RPCs below (no client INSERT policy).
create table public.import_proposals (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  provider_email_id text unique,
  status text not null check (status in ('parsing', 'pending', 'validated', 'rejected', 'failed', 'expired')),
  source text not null check (source in ('email', 'share')),
  sender_email text,
  subject text,
  received_at timestamptz,
  events jsonb,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  validated_by uuid references public.profiles (id) on delete set null,
  validated_at timestamptz,
  rejected_by uuid references public.profiles (id) on delete set null,
  rejected_at timestamptz
);

create index import_proposals_trip_status_idx on public.import_proposals (trip_id, status);

alter table public.import_proposals enable row level security;

-- Active members of the trip can read its proposals. No INSERT/UPDATE/DELETE policy: writes go
-- through the service-role edge fn (bypasses RLS) or the SECURITY DEFINER RPCs below.
create policy import_proposals_select_members on public.import_proposals
  for select
  using (
    exists (
      select 1 from public.trip_members m
      where m.trip_id = import_proposals.trip_id
        and m.user_id = (select auth.uid())
        and m.status = 'active'
    )
  );

-- "Propose to group" from the existing share-intent flow: an active member turns already-parsed
-- events into a pending proposal instead of inserting them directly. `_events` is the raw parse
-- shape (same as an email proposal).
create or replace function public.create_share_proposal(_trip_id uuid, _events jsonb, _subject text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  _uid uuid := auth.uid();
  _id uuid;
begin
  if not exists (
    select 1 from public.trip_members
    where trip_id = _trip_id and user_id = _uid and status = 'active'
  ) then
    raise exception 'not an active member of this trip';
  end if;

  insert into public.import_proposals (trip_id, status, source, subject, events, received_at)
  values (_trip_id, 'pending', 'share', _subject, _events, now())
  returning id into _id;

  return _id;
end;
$$;

revoke all on function public.create_share_proposal(uuid, jsonb, text) from public;
revoke all on function public.create_share_proposal(uuid, jsonb, text) from anon;
grant execute on function public.create_share_proposal(uuid, jsonb, text) to authenticated;

-- Validates a pending proposal: atomically flips pending->validated (the WHERE status='pending'
-- guard kills the double-validation race - a second concurrent caller updates 0 rows and aborts)
-- and inserts the member-edited RESOLVED events into trip_events. `_events` mirrors what the
-- client's createEvents builds today (camelCase keys, participants as a uuid[] or null). Clears
-- sender_email (third-party PII no longer needed once reviewed).
create or replace function public.validate_import_proposal(_proposal_id uuid, _events jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  _uid uuid := auth.uid();
  _trip_id uuid;
begin
  select trip_id into _trip_id from public.import_proposals where id = _proposal_id;
  if _trip_id is null then
    raise exception 'proposal not found';
  end if;

  if not exists (
    select 1 from public.trip_members
    where trip_id = _trip_id and user_id = _uid and status = 'active'
  ) then
    raise exception 'not an active member of this trip';
  end if;

  update public.import_proposals
  set status = 'validated', validated_by = _uid, validated_at = now(), sender_email = null
  where id = _proposal_id and status = 'pending';

  if not found then
    raise exception 'proposal is not pending';
  end if;

  insert into public.trip_events (
    trip_id, title, type, starts_at, ends_at, notes, lat, lng, place_id,
    gate_location, location_name, end_location, participants, created_by
  )
  select
    _trip_id,
    e ->> 'title',
    coalesce(nullif(e ->> 'type', ''), 'activity'),
    (e ->> 'startsAt')::timestamptz,
    nullif(e ->> 'endsAt', '')::timestamptz,
    nullif(e ->> 'notes', ''),
    (e ->> 'lat')::double precision,
    (e ->> 'lng')::double precision,
    nullif(e ->> 'placeId', ''),
    case when jsonb_typeof(e -> 'gateLocation') = 'object' then e -> 'gateLocation' else null end,
    nullif(e ->> 'locationName', ''),
    case when jsonb_typeof(e -> 'endLocation') = 'object' then e -> 'endLocation' else null end,
    case
      when jsonb_typeof(e -> 'participants') = 'array'
        then array(select jsonb_array_elements_text(e -> 'participants'))::uuid[]
      else null
    end,
    _uid
  from jsonb_array_elements(_events) as e;
end;
$$;

revoke all on function public.validate_import_proposal(uuid, jsonb) from public;
revoke all on function public.validate_import_proposal(uuid, jsonb) from anon;
grant execute on function public.validate_import_proposal(uuid, jsonb) to authenticated;

-- Rejects a proposal (non-destructive: the row is kept a short window for audit, then cron-purged).
-- Clears sender_email.
create or replace function public.reject_import_proposal(_proposal_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  _uid uuid := auth.uid();
  _trip_id uuid;
begin
  select trip_id into _trip_id from public.import_proposals where id = _proposal_id;
  if _trip_id is null then
    raise exception 'proposal not found';
  end if;

  if not exists (
    select 1 from public.trip_members
    where trip_id = _trip_id and user_id = _uid and status = 'active'
  ) then
    raise exception 'not an active member of this trip';
  end if;

  update public.import_proposals
  set status = 'rejected', rejected_by = _uid, rejected_at = now(), sender_email = null
  where id = _proposal_id and status in ('pending', 'parsing', 'failed');
end;
$$;

revoke all on function public.reject_import_proposal(uuid) from public;
revoke all on function public.reject_import_proposal(uuid) from anon;
grant execute on function public.reject_import_proposal(uuid) to authenticated;
