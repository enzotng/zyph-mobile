-- A member's live position lives exactly as long as their tenure on the place.
--
-- Every path that ends a tenure drops the position (detach already did; remove, leave and account
-- deletion now do too), positions are written through upsert_member_location only, and a co-member
-- reads a position only if it was written during the current tenure.
--
-- Reproduced VERBATIM with ONLY the location handling changed: upsert_member_location from
-- 20260523150914_ar_wayfinder_simplify_coords.sql, detach_trip_member from
-- 20261001195500_ghost_place_audit_followups.sql, remove_trip_member and leave_trip from
-- 20260606182725_notifications.sql, delete_my_account from
-- 20260815083508_anonymise_member_alias_on_delete.sql. The select policy is the one from
-- 20260523150204_ar_wayfinder_schema.sql plus its last line.

drop policy "member_locations_select_comember" on public.member_locations;
create policy "member_locations_select_comember" on public.member_locations
  for select to authenticated using (
    exists (
      select 1
      from public.trip_members me
      join public.trip_members them on them.trip_id = me.trip_id
      where me.user_id = auth.uid()
        and me.status = 'active'
        and them.id = member_locations.trip_member_id
        and them.status = 'active'
        and member_locations.updated_at >= them.claimed_at
    )
  );

-- Policies are checked against the statement's snapshot, so a direct write can still land on a
-- place freed in the meantime; the RPC locks the place row instead.
drop policy "member_locations_insert_self" on public.member_locations;
drop policy "member_locations_update_self" on public.member_locations;
drop policy "member_locations_delete_self" on public.member_locations;
revoke insert, update, delete, truncate, references, trigger, maintain
  on public.member_locations from authenticated, anon;

-- Positions left behind earlier - by a removal, a departure, a deleted account or a previous
-- tenure - would resurface: reactivating a member keeps their claimed_at.
delete from public.member_locations l
using public.trip_members m
where m.id = l.trip_member_id
  and (m.status <> 'active' or m.user_id is null or l.updated_at < m.claimed_at);

create or replace function public.upsert_member_location(
  _trip_id uuid,
  _lat double precision,
  _lng double precision,
  _accuracy_m real default null,
  _heading_deg real default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  _member_id uuid;
begin
  select id into _member_id
  from public.trip_members
  where trip_id = _trip_id
    and user_id = auth.uid()
    and status = 'active'
  -- Waits behind a detach or removal in flight, then re-reads the row and finds it is no longer
  -- the caller's: without the lock, a write already past this check lands on the freed place.
  for share;

  if _member_id is null then
    raise exception 'not an active member of this trip';
  end if;

  insert into public.member_locations (
    trip_member_id, lat, lng, accuracy_m, heading_deg, updated_at
  ) values (
    _member_id,
    _lat,
    _lng,
    _accuracy_m,
    _heading_deg,
    now()
  )
  on conflict (trip_member_id) do update set
    lat = excluded.lat,
    lng = excluded.lng,
    accuracy_m = excluded.accuracy_m,
    heading_deg = excluded.heading_deg,
    updated_at = now();
end;
$$;


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

  update public.trip_members
  set user_id = null,
      claimed_at = null,
      display_name = private.clean_name(_detached.alias)
  where id = _member_id;

  -- The live position is keyed to the place, not the account: left here, co-members would keep
  -- reading it, under the name of whoever claims the place next. Dropped after the unbind so
  -- the place row is locked before the position, the order upsert_member_location takes them.
  delete from public.member_locations where trip_member_id = _member_id;

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

create or replace function public.remove_trip_member(_member_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  _uid uuid := auth.uid();
  _trip_id uuid;
  _role public.trip_role;
  _removed_uid uuid;
begin
  select trip_id, role, user_id into _trip_id, _role, _removed_uid
  from public.trip_members
  where id = _member_id;

  if _trip_id is null then
    raise exception 'member not found';
  end if;

  if _role = 'owner' then
    raise exception 'cannot remove the trip owner';
  end if;

  if not exists (
    select 1 from public.trips
    where id = _trip_id and owner_id = _uid
  ) then
    raise exception 'only the trip owner can remove members';
  end if;

  update public.trip_members
  set status = 'removed'
  where id = _member_id;

  delete from public.member_locations where trip_member_id = _member_id;

  -- Tell the removed member they were removed (actor = the owner, skipped by private.notify
  -- if they ever coincide).
  perform private.notify(
    array[_removed_uid], _uid, _trip_id, 'member.removed', '{}'::jsonb
  );
end;
$$;


create or replace function public.leave_trip(_trip_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  _uid uuid := auth.uid();
  _role public.trip_role;
begin
  select role into _role
  from public.trip_members
  where trip_id = _trip_id and user_id = _uid and status = 'active';

  if _role is null then
    raise exception 'not an active member of this trip';
  end if;

  if _role = 'owner' then
    raise exception 'the owner cannot leave the trip';
  end if;

  update public.trip_members
  set status = 'removed'
  where trip_id = _trip_id and user_id = _uid;

  delete from public.member_locations l
  using public.trip_members m
  where m.id = l.trip_member_id and m.trip_id = _trip_id and m.user_id = _uid;

  -- The leaver is now 'removed', so the active-member set already excludes them; notify the
  -- remaining members. (private.notify also skips the actor defensively.)
  perform private.notify(
    array(select user_id from public.trip_members where trip_id = _trip_id and status = 'active'),
    _uid, _trip_id, 'member.left', '{}'::jsonb
  );
end;
$$;


create or replace function public.delete_my_account(_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  _has_footprint boolean;
begin
  if _user_id is null then
    raise exception 'user id is required';
  end if;

  -- Block while the user owns a trip another traveller is still active or invited in.
  if exists (
    select 1
    from public.trips t
    where t.owner_id = _user_id
      and exists (
        select 1
        from public.trip_members m
        where m.trip_id = t.id
          and m.user_id <> _user_id
          and m.status in ('active', 'invited')
      )
  ) then
    raise exception 'owns shared trips';
  end if;

  -- Hard-delete solo-owned trips (no other active/invited member): a clean self-only cascade.
  delete from public.trips t
  where t.owner_id = _user_id
    and not exists (
      select 1
      from public.trip_members m
      where m.trip_id = t.id
        and m.user_id <> _user_id
        and m.status in ('active', 'invited')
    );

  -- Soft-remove the user from every remaining trip, preserving their expense splits and the
  -- resulting balances for the other members.
  update public.trip_members
  set status = 'removed'
  where user_id = _user_id
    and status <> 'removed';

  -- Solo trips cascaded with their delete above; this covers the shared ones.
  delete from public.member_locations l
  using public.trip_members m
  where m.id = l.trip_member_id and m.user_id = _user_id;

  -- The alias frozen on the member row is a COPY of the profile name, and trip_member_names now
  -- reads coalesce(profile, alias) - so nulling the profile alone no longer anonymises anything.
  -- Safe against trip_members_ghost_has_name: that check only binds rows whose user_id is null,
  -- and these all have one. The rows are 'removed' by the update above, so no later detach can
  -- trip over the missing name.
  update public.trip_members
  set display_name = null
  where user_id = _user_id;

  -- Anonymise the profile (the row is kept so co-travellers' historical balances still resolve).
  update public.profiles
  set display_name = null,
      avatar_url = null
  where id = _user_id;

  select exists (
    select 1 from public.trip_members where user_id = _user_id
  ) into _has_footprint;

  return _has_footprint;
end;
$$;

-- Service-role only, exactly as the original: the signature takes a TARGET user id, so execute
-- for authenticated would let any caller delete any account.
revoke all on function public.delete_my_account(uuid) from public;
revoke all on function public.delete_my_account(uuid) from anon;
revoke all on function public.delete_my_account(uuid) from authenticated;
grant execute on function public.delete_my_account(uuid) to service_role;
