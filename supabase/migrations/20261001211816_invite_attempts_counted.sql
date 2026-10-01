-- Invite-code attempts are counted on every call, hit or miss, across both claim RPCs: an unknown
-- code now answers a value instead of raising, so the limiter's increment commits.
-- join_trip_by_code is left unchanged for the clients that predate the claim flow.
--
-- get_trip_claim_options is reproduced VERBATIM from 20261001195500_ghost_place_audit_followups.sql
-- and claim_trip_slot from 20260813134348_harden_actor_names.sql, with ONLY the limiter and the
-- unknown-code answer changed.

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
  -- 48-bit invite code, so every lookup costs an attempt, hit or miss. A wrong code answers
  -- rather than raises, because a raise would roll this counter back with it.
  if not public.check_rate_limit('claim-options') then
    raise exception 'rate limited';
  end if;

  select t.id, t.title into _trip
  from public.trips t
  where t.invite_code = lower(trim(_code));

  if _trip.id is null then
    return jsonb_build_object('error', 'invalid_code');
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
  _actor_name text;
begin
  if _uid is null then
    raise exception 'not authenticated';
  end if;

  -- Same budget as get_trip_claim_options, since this answers differently for a known and an
  -- unknown code: every call costs an attempt, and an unknown code answers null.
  if not public.check_rate_limit('claim-options') then
    raise exception 'rate limited';
  end if;

  -- Gated on the code, not on the trip id: otherwise any authenticated user knowing a trip id
  -- could claim one of its places.
  select id into _trip_id from public.trips where invite_code = lower(trim(_code));
  if _trip_id is null then return null; end if;

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

    select private.clean_name(coalesce(p.display_name, m.display_name)) into _actor_name
    from public.trip_members m
    left join public.profiles p on p.id = m.user_id
    where m.trip_id = _trip_id and m.user_id = _uid;

    perform private.notify(
      array(select tm.user_id from public.trip_members tm
            where tm.trip_id = _trip_id and tm.status = 'active'),
      _uid, _trip_id, 'member.joined',
      jsonb_build_object('actorName', _actor_name)
    );
    return _trip_id;
  end if;

  if _slot_id is null then
    -- "I am not in the list": a brand new place, like the legacy join. The alias is frozen at
    -- insert time so that a later detach cannot produce a nameless ghost when the profile has
    -- since been anonymised.
    insert into public.trip_members (trip_id, user_id, role, status, display_name, claimed_at)
    values (_trip_id, _uid, 'member', 'active',
      (select private.clean_name(display_name) from public.profiles where id = _uid), now());

    select private.clean_name(coalesce(p.display_name, m.display_name)) into _actor_name
    from public.trip_members m
    left join public.profiles p on p.id = m.user_id
    where m.trip_id = _trip_id and m.user_id = _uid;

    perform private.notify(
      array(select tm.user_id from public.trip_members tm
            where tm.trip_id = _trip_id and tm.status = 'active'),
      _uid, _trip_id, 'member.joined',
      jsonb_build_object('actorName', _actor_name)
    );
    return _trip_id;
  end if;

  -- `user_id is null` is the sole arbiter between two concurrent claims: the loser matches no row.
  update public.trip_members
  set user_id = _uid,
      claimed_at = now(),
      display_name = coalesce(display_name,
        (select private.clean_name(display_name) from public.profiles where id = _uid))
  where id = _slot_id and trip_id = _trip_id
    and user_id is null and status = 'active'::public.member_status
  returning display_name into _slot_name;

  if not found then raise exception 'slot already claimed'; end if;

  -- Resolved after the bind, so the claimer's own row is the one read: their profile name, or the
  -- alias the place already carried when they have none.
  select private.clean_name(coalesce(p.display_name, m.display_name)) into _actor_name
  from public.trip_members m
  left join public.profiles p on p.id = m.user_id
  where m.trip_id = _trip_id and m.user_id = _uid;

  perform private.notify(
    array(select tm.user_id from public.trip_members tm
          where tm.trip_id = _trip_id and tm.status = 'active'),
    _uid, _trip_id, 'member.claimed',
    jsonb_build_object('memberId', _slot_id, 'slotName', private.clean_name(_slot_name),
      'actorName', _actor_name)
  );
  return _trip_id;
end;
$$;

revoke all on function public.claim_trip_slot(text, uuid) from public;
revoke all on function public.claim_trip_slot(text, uuid) from anon;
grant execute on function public.claim_trip_slot(text, uuid) to authenticated;

-- The code is the trip's only credential, and a unique column answers whether a value is taken: a
-- client may neither choose a code nor change one. regenerate_invite_code runs as its owner and is
-- not affected.
create or replace function private.protect_invite_code()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.invite_code := encode(extensions.gen_random_bytes(6), 'hex');
  elsif new.invite_code is distinct from old.invite_code then
    raise exception 'invite code is not writable';
  end if;

  return new;
end;
$$;

create trigger trips_protect_invite_code
  before insert or update of invite_code on public.trips
  for each row execute function private.protect_invite_code();
