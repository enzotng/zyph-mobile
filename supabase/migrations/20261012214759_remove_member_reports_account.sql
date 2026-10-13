-- remove_trip_member answers whether the place it closed was held by an account. The caller's
-- member list can be stale (a place claimed on another device since it last loaded), so whether
-- the removed person can come back through the invite link is the server's answer, not the list's.
--
-- The answer is read after the update, so a claim that commits in between counts, and so does an
-- account that already left or was removed from another device: either can still come back. The
-- notification goes to the holder of the row the update closed, so removing a row that is no
-- longer active notifies nobody.
--
-- Reproduced VERBATIM from 20261001211910_member_location_tenure.sql with ONLY the return type, the
-- update's filter and returning clause, and the final return changed. The return type change needs
-- a drop, so the grants are restated.

drop function public.remove_trip_member(uuid);

create function public.remove_trip_member(_member_id uuid)
returns boolean
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
  where id = _member_id and status = 'active'
  returning user_id into _removed_uid;

  delete from public.member_locations where trip_member_id = _member_id;

  -- Tell the removed member they were removed (actor = the owner, skipped by private.notify
  -- if they ever coincide).
  perform private.notify(
    array[_removed_uid], _uid, _trip_id, 'member.removed', '{}'::jsonb
  );

  return exists (
    select 1 from public.trip_members where id = _member_id and user_id is not null
  );
end;
$$;

revoke all on function public.remove_trip_member(uuid) from public;
revoke all on function public.remove_trip_member(uuid) from anon;
grant execute on function public.remove_trip_member(uuid) to authenticated;
