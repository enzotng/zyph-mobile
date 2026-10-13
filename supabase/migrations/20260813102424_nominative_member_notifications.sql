-- Nominative member notifications (Lot 1a, spec D2 + section 8.10): the honor-system claim is made safe by
-- a notification that names WHO acted - the only detection defence the group has before the owner
-- can detach - and the four member.* payloads carried the place name alone, so every recipient read
-- an anonymous line. The four emitting functions are reproduced VERBATIM (claim_trip_slot from
-- 20260811071755, the other three from 20260811071805) with ONLY their private.notify payload
-- changed. actorName resolves the acting member through the same profiles -> trip_members cascade as
-- the rest of the app (spec section 3), so a ghost that claimed a place still reads under a name.
-- member.detached also carries the detached account's id: that account is a recipient too, its trip
-- is hidden from it by RLS the moment the row is written, and its id in the payload is the only way
-- the client can tell that recipient apart from the rest of the group.

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

  -- Resolved after the bind, so the claimer's own row is the one read: their profile name, or the
  -- alias the place already carried when they have none.
  select coalesce(p.display_name, m.display_name) into _actor_name
  from public.trip_members m
  left join public.profiles p on p.id = m.user_id
  where m.trip_id = _trip_id and m.user_id = _uid;

  perform private.notify(
    array(select tm.user_id from public.trip_members tm
          where tm.trip_id = _trip_id and tm.status = 'active'),
    _uid, _trip_id, 'member.claimed',
    jsonb_build_object('memberId', _slot_id, 'slotName', _slot_name, 'actorName', _actor_name)
  );
  return _trip_id;
end;
$$;

revoke all on function public.claim_trip_slot(text, uuid) from public;
revoke all on function public.claim_trip_slot(text, uuid) from anon;
grant execute on function public.claim_trip_slot(text, uuid) to authenticated;

create or replace function public.add_ghost_member(_trip_id uuid, _name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  _uid uuid := auth.uid();
  _trimmed text := btrim(_name);
  _member_id uuid;
  _actor_name text;
begin
  if _uid is null then
    raise exception 'not authenticated';
  end if;

  if not private.is_trip_member(_trip_id) then
    raise exception 'not a trip member';
  end if;

  -- btrim(null) is null and no comparison against it is true, so without the null test a null name
  -- falls through this whole check and surfaces as a trip_members_ghost_has_name violation.
  if _trimmed is null or _trimmed = '' or char_length(_trimmed) > 80 then
    raise exception 'invalid name';
  end if;

  if not public.check_rate_limit('add-ghost:' || _trip_id, 30, 3600) then
    raise exception 'rate limited';
  end if;

  -- Anti-abuse cap on the claim list, the balances and the member.added fan-out - not a financial
  -- invariant, so it is deliberately unlocked: two concurrent inserts can reach 51.
  if (select count(*) from public.trip_members
      where trip_id = _trip_id and status = 'active'::public.member_status) >= 50 then
    raise exception 'member limit reached';
  end if;

  insert into public.trip_members (trip_id, user_id, role, status, display_name)
  values (_trip_id, null, 'member', 'active', _trimmed)
  returning id into _member_id;

  select coalesce(p.display_name, m.display_name) into _actor_name
  from public.trip_members m
  left join public.profiles p on p.id = m.user_id
  where m.trip_id = _trip_id and m.user_id = _uid;

  perform private.notify(
    array(select tm.user_id from public.trip_members tm
          where tm.trip_id = _trip_id and tm.status = 'active'),
    _uid, _trip_id, 'member.added',
    jsonb_build_object('memberId', _member_id, 'name', _trimmed, 'actorName', _actor_name)
  );

  return _member_id;
end;
$$;

revoke all on function public.add_ghost_member(uuid, text) from public;
revoke all on function public.add_ghost_member(uuid, text) from anon;
grant execute on function public.add_ghost_member(uuid, text) to authenticated;

create or replace function public.rename_ghost_member(_member_id uuid, _name text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  _uid uuid := auth.uid();
  _trimmed text := btrim(_name);
  _ghost record;
  _actor_name text;
begin
  if _uid is null then
    raise exception 'not authenticated';
  end if;

  -- A claimed place carries the name of the account holding it and a removed one has left the
  -- group: widening this target would let a member rewrite either.
  select trip_id, display_name into _ghost
  from public.trip_members
  where id = _member_id
    and user_id is null
    and status = 'active'::public.member_status;

  if not found then
    raise exception 'not a renamable ghost';
  end if;

  if not private.is_trip_member(_ghost.trip_id) then
    raise exception 'not a trip member';
  end if;

  if _trimmed is null or _trimmed = '' or char_length(_trimmed) > 80 then
    raise exception 'invalid name';
  end if;

  -- Same bounded surface as add_ghost_member: open to every active member, and each call fans a
  -- notification out to the whole trip, so an unbounded rename loop is a spam vector.
  if not public.check_rate_limit('rename-ghost:' || _ghost.trip_id, 30, 3600) then
    raise exception 'rate limited';
  end if;

  update public.trip_members
  set display_name = _trimmed
  where id = _member_id;

  select coalesce(p.display_name, m.display_name) into _actor_name
  from public.trip_members m
  left join public.profiles p on p.id = m.user_id
  where m.trip_id = _ghost.trip_id and m.user_id = _uid;

  -- Renaming a place that already carries financial history is legitimate but must be as visible
  -- as a claim, which is the only defence D8 keeps against a malicious rename.
  perform private.notify(
    array(select tm.user_id from public.trip_members tm
          where tm.trip_id = _ghost.trip_id and tm.status = 'active'),
    _uid, _ghost.trip_id, 'member.renamed',
    jsonb_build_object('memberId', _member_id, 'oldName', _ghost.display_name,
      'newName', _trimmed, 'actorName', _actor_name)
  );
end;
$$;

revoke all on function public.rename_ghost_member(uuid, text) from public;
revoke all on function public.rename_ghost_member(uuid, text) from anon;
grant execute on function public.rename_ghost_member(uuid, text) to authenticated;

create or replace function public.detach_trip_member(_member_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  _uid uuid := auth.uid();
  _detached record;
  _actor_name text;
begin
  if _uid is null then
    raise exception 'not authenticated';
  end if;

  -- Ownership is checked before the target is inspected so that a non-owner learns nothing about
  -- which member ids are detachable.
  if not exists (
    select 1 from public.trip_members m
    join public.trips t on t.id = m.trip_id
    where m.id = _member_id and t.owner_id = _uid
  ) then
    raise exception 'owner only';
  end if;

  if not exists (
    select 1 from public.trip_members m
    where m.id = _member_id
      and m.user_id is not null
      and m.status = 'active'::public.member_status
      and m.role <> 'owner'::public.trip_role
  ) then
    raise exception 'not a detachable member';
  end if;

  -- Captured BEFORE the update: once user_id is null, private.notify drops the recipient
  -- (20260608104900_packing_assignment_rpcs.sql:18-19) and the detached member would never learn
  -- they were detached, with nothing raised to signal it.
  select m.user_id, m.trip_id, m.claimed_at,
         coalesce(m.display_name, p.display_name) as alias
  into _detached
  from public.trip_members m
  left join public.profiles p on p.id = m.user_id
  where m.id = _member_id;

  -- The place keeps this alias once unbound, so a missing or blank one would fail
  -- trip_members_ghost_has_name on the update below rather than here.
  if _detached.alias is null or btrim(_detached.alias) = '' then
    raise exception 'member has no resolvable name';
  end if;

  -- Tenure guard (spec 8.9): payers and splits of non-deleted expenses, settlements sent and
  -- received while active - the exact set get_trip_balances sums - narrowed to rows created since
  -- the claim. Any divergence from that set lets a place that DID move the balances go back on the
  -- claim list, and whoever claims it next inherits those writes.
  if exists (
    select 1 from public.expense_payers ep
    join public.expenses e on e.id = ep.expense_id
    where ep.member_id = _member_id and e.deleted_at is null
      and ep.created_at >= _detached.claimed_at
  ) or exists (
    select 1 from public.expense_splits es
    join public.expenses e on e.id = es.expense_id
    where es.member_id = _member_id and e.deleted_at is null
      and es.created_at >= _detached.claimed_at
  ) or exists (
    select 1 from public.trip_settlements s
    where (s.from_member = _member_id or s.to_member = _member_id)
      and s.status = 'active'::public.settlement_status
      and s.created_at >= _detached.claimed_at
  ) then
    raise exception 'place has ledger activity since claim; remove the member instead';
  end if;

  update public.trip_members
  set user_id = null,
      claimed_at = null,
      display_name = _detached.alias
  where id = _member_id;

  select coalesce(p.display_name, m.display_name) into _actor_name
  from public.trip_members m
  left join public.profiles p on p.id = m.user_id
  where m.trip_id = _detached.trip_id and m.user_id = _uid;

  perform private.notify(
    array[_detached.user_id] ||
      array(select tm.user_id from public.trip_members tm
            where tm.trip_id = _detached.trip_id and tm.status = 'active'),
    _uid, _detached.trip_id, 'member.detached',
    jsonb_build_object('memberId', _member_id, 'name', _detached.alias,
      'actorName', _actor_name, 'detachedUserId', _detached.user_id)
  );
end;
$$;

revoke all on function public.detach_trip_member(uuid) from public;
revoke all on function public.detach_trip_member(uuid) from anon;
grant execute on function public.detach_trip_member(uuid) to authenticated;
