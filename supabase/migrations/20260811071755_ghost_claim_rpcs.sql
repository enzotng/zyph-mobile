-- Claim RPCs (Lot 1a): the two functions behind the "Who are you?" screen. get_trip_claim_options
-- lists the free places of a trip to a candidate who is not a member yet (RLS hides everything from
-- them, hence SECURITY DEFINER), and claim_trip_slot binds the caller's account to one of those
-- places - the only null -> non-null transition of trip_members.user_id.
-- public.join_trip_by_code is reproduced VERBATIM from 20260606191108_notifications_fixes.sql - its
-- LATEST definition, which supersedes the one in 20260606182725_notifications.sql and carries the
-- _prev_status guard - with ONLY the insert column list and values changed. Old clients still call
-- it, so it keeps its signature and semantics; it now freezes the alias and dates the tenure like
-- every other path that binds a user_id (D7), and its ON CONFLICT branch still touches neither.

-- Deliberately VOLATILE (the default): check_rate_limit writes its counters, which Postgres refuses
-- from a stable function at runtime.
create or replace function public.get_trip_claim_options(_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  _uid uuid := auth.uid();
  _trip record;
  _my_status public.member_status;
  _slots jsonb;
begin
  if _uid is null then
    raise exception 'not authenticated';
  end if;

  -- The trip title and the first names of its free places are readable by anyone who guesses a
  -- 48-bit invite code, so the code is the only proof required but the attempts are bounded.
  if not public.check_rate_limit('claim-options', 30, 3600) then
    raise exception 'rate limited';
  end if;

  select t.id, t.title into _trip
  from public.trips t
  where t.invite_code = lower(trim(_code));

  if _trip.id is null then
    raise exception 'invalid invite code';
  end if;

  select m.status into _my_status
  from public.trip_members m
  where m.trip_id = _trip.id and m.user_id = _uid;

  -- A free place is a ghost that is still active: a removed ghost has left the group and must not
  -- come back as claimable. The caller's own row can never appear here (its user_id is not null).
  select coalesce(
    jsonb_agg(jsonb_build_object('slotId', s.id, 'slotName', s.display_name)
              order by s.joined_at),
    '[]'::jsonb)
  into _slots
  from public.trip_members s
  where s.trip_id = _trip.id and s.user_id is null
    and s.status = 'active'::public.member_status;

  return jsonb_build_object(
    'tripId', _trip.id,
    'tripTitle', _trip.title,
    'myStatus', _my_status,
    'slots', _slots
  );
end;
$$;

revoke all on function public.get_trip_claim_options(text) from public;
revoke all on function public.get_trip_claim_options(text) from anon;
grant execute on function public.get_trip_claim_options(text) to authenticated;

create or replace function public.claim_trip_slot(_code text, _slot_id uuid default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  _uid uuid := auth.uid();
  _trip_id uuid;
  _mine public.trip_members;
  _slot_name text;
begin
  if _uid is null then
    raise exception 'not authenticated';
  end if;

  -- Gated on the code, not on the trip id: otherwise any authenticated user knowing a trip id
  -- could claim one of its places.
  select id into _trip_id from public.trips where invite_code = lower(trim(_code));
  if _trip_id is null then raise exception 'invalid invite code'; end if;

  select * into _mine from public.trip_members
  where trip_id = _trip_id and user_id = _uid;

  -- A removed row is reactivated rather than bound to a free ghost - unique (trip_id, user_id)
  -- would reject the bind anyway. status is the ONLY column touched: refreshing claimed_at would
  -- move the previous tenure's ledger out of the detach guard's window.
  if _mine.id is not null then
    if _mine.status = 'active'::public.member_status then
      raise exception 'already a member';
    end if;
    update public.trip_members set status = 'active' where id = _mine.id;
    perform private.notify(
      array(select tm.user_id from public.trip_members tm
            where tm.trip_id = _trip_id and tm.status = 'active'),
      _uid, _trip_id, 'member.joined', '{}'::jsonb
    );
    return _trip_id;
  end if;

  if _slot_id is null then
    -- "I am not in the list": a brand new place, like the legacy join. The alias is frozen at
    -- insert time so that a later detach cannot produce a nameless ghost when the profile has
    -- since been anonymised.
    insert into public.trip_members (trip_id, user_id, role, status, display_name, claimed_at)
    values (_trip_id, _uid, 'member', 'active',
      (select display_name from public.profiles where id = _uid), now());
    perform private.notify(
      array(select tm.user_id from public.trip_members tm
            where tm.trip_id = _trip_id and tm.status = 'active'),
      _uid, _trip_id, 'member.joined', '{}'::jsonb
    );
    return _trip_id;
  end if;

  -- `user_id is null` is the sole arbiter between two concurrent claims: the loser matches no row.
  update public.trip_members
  set user_id = _uid,
      claimed_at = now(),
      display_name = coalesce(display_name,
        (select display_name from public.profiles where id = _uid))
  where id = _slot_id and trip_id = _trip_id
    and user_id is null and status = 'active'::public.member_status
  returning display_name into _slot_name;

  if not found then raise exception 'slot already claimed'; end if;

  perform private.notify(
    array(select tm.user_id from public.trip_members tm
          where tm.trip_id = _trip_id and tm.status = 'active'),
    _uid, _trip_id, 'member.claimed',
    jsonb_build_object('memberId', _slot_id, 'slotName', _slot_name)
  );
  return _trip_id;
end;
$$;

revoke all on function public.claim_trip_slot(text, uuid) from public;
revoke all on function public.claim_trip_slot(text, uuid) from anon;
grant execute on function public.claim_trip_slot(text, uuid) to authenticated;

create or replace function public.join_trip_by_code(_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  _uid uuid := auth.uid();
  _trip_id uuid;
  _prev_status public.member_status;
begin
  select id into _trip_id
  from public.trips
  where invite_code = lower(trim(_code));

  if _trip_id is null then
    raise exception 'invalid invite code';
  end if;

  select status into _prev_status
  from public.trip_members
  where trip_id = _trip_id and user_id = _uid;

  insert into public.trip_members (trip_id, user_id, role, status, display_name, claimed_at)
  values (_trip_id, _uid, 'member', 'active',
    (select display_name from public.profiles where id = _uid), now())
  on conflict (trip_id, user_id) do update
    set status = 'active'
    where trip_members.status <> 'active';

  -- Only announce a join when the member actually became active (brand new row or a
  -- reactivation), never on a redundant re-join by an already-active member.
  if _prev_status is null or _prev_status <> 'active' then
    perform private.notify(
      array(select user_id from public.trip_members where trip_id = _trip_id and status = 'active'),
      _uid, _trip_id, 'member.joined', '{}'::jsonb
    );
  end if;

  return _trip_id;
end;
$$;

revoke all on function public.join_trip_by_code(text) from public;
revoke all on function public.join_trip_by_code(text) from anon;
grant execute on function public.join_trip_by_code(text) to authenticated;
