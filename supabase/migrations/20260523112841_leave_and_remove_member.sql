-- Membership admin: a member can leave a trip, and a trip owner can remove a member.
-- Both operations soft-deactivate the row by setting status = 'removed' rather than
-- hard-deleting, so the historical expense_splits (which cascade-delete on member row
-- removal) and the paid_by attribution stay intact. Balances and the member list filter
-- by status = 'active', so a removed member disappears from the UI without breaking
-- past expenses.

alter type public.member_status add value if not exists 'removed';

-- Caller leaves a trip they are a member of. Owners cannot leave (they would orphan
-- the trip); they must transfer ownership or delete the trip first.
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
end;
$$;

-- Trip owner removes a member by member id. Refuses to remove the owner.
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
begin
  select trip_id, role into _trip_id, _role
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
end;
$$;

revoke all on function public.leave_trip(uuid) from public;
revoke all on function public.leave_trip(uuid) from anon;
grant execute on function public.leave_trip(uuid) to authenticated;

revoke all on function public.remove_trip_member(uuid) from public;
revoke all on function public.remove_trip_member(uuid) from anon;
grant execute on function public.remove_trip_member(uuid) to authenticated;
