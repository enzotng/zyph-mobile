-- Follow-ups from the Lot 1a audits on ghost places.
--
-- detach_trip_member and get_trip_claim_options are reproduced VERBATIM from their latest
-- definitions (20260813134348_harden_actor_names.sql and 20260811071755_ghost_claim_rpcs.sql) with
-- ONLY the member_locations delete and the rate-limit comment changed respectively.

-- The tenure guard compares ledger rows against claimed_at, and `created_at >= null` matches
-- nothing: a bound row without one would detach unguarded.
alter table public.trip_members
  add constraint trip_members_claimed_iff_bound
    check ((user_id is null) = (claimed_at is null));

create index trip_settlements_from_member_idx on public.trip_settlements (from_member);
create index trip_settlements_to_member_idx on public.trip_settlements (to_member);

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

  -- The place keeps this alias once unbound, so a name with nothing legible left in it would
  -- fail trip_members_ghost_has_name on the update below rather than here. Tested through
  -- clean_name, not btrim, because that is what the update stores.
  if private.clean_name(_detached.alias) is null then
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

  -- The live position is keyed to the place, not the account: left here, co-members would keep
  -- reading it, under the name of whoever claims the place next.
  delete from public.member_locations where trip_member_id = _member_id;

  update public.trip_members
  set user_id = null,
      claimed_at = null,
      display_name = private.clean_name(_detached.alias)
  where id = _member_id;

  select private.clean_name(coalesce(p.display_name, m.display_name)) into _actor_name
  from public.trip_members m
  left join public.profiles p on p.id = m.user_id
  where m.trip_id = _detached.trip_id and m.user_id = _uid;

  perform private.notify(
    array[_detached.user_id] ||
      array(select tm.user_id from public.trip_members tm
            where tm.trip_id = _detached.trip_id and tm.status = 'active'),
    _uid, _detached.trip_id, 'member.detached',
    jsonb_build_object('memberId', _member_id, 'name', private.clean_name(_detached.alias),
      'actorName', _actor_name, 'detachedUserId', _detached.user_id)
  );
end;
$$;

revoke all on function public.detach_trip_member(uuid) from public;
revoke all on function public.detach_trip_member(uuid) from anon;
grant execute on function public.detach_trip_member(uuid) to authenticated;

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
  -- 48-bit invite code. Only successful reads are counted: a wrong code raises, and the raise
  -- rolls this counter back with it, so the entropy of the code is what bounds guessing.
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
