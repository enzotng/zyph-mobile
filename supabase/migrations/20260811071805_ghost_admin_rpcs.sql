-- Admin RPCs (Lot 1a): the three gestures the group performs on places. Adding and renaming a ghost
-- stay open to any active member - fixing the spelling of a friend's first name is the same level of
-- trust as adding them (D8) - while detaching is owner-only, since it unbinds someone else's account.
-- detach_trip_member is the only non-null -> null transition of trip_members.user_id, and it leaves
-- the ledger untouched: the place keeps its rows and its alias, only the account walks away. That is
-- sound only while the tenure has produced nothing the balances can see, hence the tenure guard,
-- whose three branches mirror the four terms of public.get_trip_balances
-- (20260613194439_multi_payer_backend.sql:66-107) restricted to rows created since the claim. A
-- tenure that did move the balances must go through remove_trip_member instead, which takes the
-- place out of the group with its history attached.

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

  perform private.notify(
    array(select tm.user_id from public.trip_members tm
          where tm.trip_id = _trip_id and tm.status = 'active'),
    _uid, _trip_id, 'member.added', jsonb_build_object('memberId', _member_id, 'name', _trimmed)
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

  -- Renaming a place that already carries financial history is legitimate but must be as visible
  -- as a claim, which is the only defence D8 keeps against a malicious rename.
  perform private.notify(
    array(select tm.user_id from public.trip_members tm
          where tm.trip_id = _ghost.trip_id and tm.status = 'active'),
    _uid, _ghost.trip_id, 'member.renamed',
    jsonb_build_object('memberId', _member_id, 'oldName', _ghost.display_name, 'newName', _trimmed)
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

  perform private.notify(
    array[_detached.user_id] ||
      array(select tm.user_id from public.trip_members tm
            where tm.trip_id = _detached.trip_id and tm.status = 'active'),
    _uid, _detached.trip_id, 'member.detached',
    jsonb_build_object('memberId', _member_id, 'name', _detached.alias)
  );
end;
$$;

revoke all on function public.detach_trip_member(uuid) from public;
revoke all on function public.detach_trip_member(uuid) from anon;
grant execute on function public.detach_trip_member(uuid) to authenticated;
