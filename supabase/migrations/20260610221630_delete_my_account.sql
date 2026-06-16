-- Account deletion teardown, run server-side from the delete-account edge function with the
-- service role (auth.uid() is null there, so the caller's id is passed in as _user_id and the
-- function is locked to service_role only - never callable directly by an authenticated user).
--
-- A naive auth.users delete is destructive: trips.owner_id and trip_members.user_id are both
-- ON DELETE CASCADE, so deleting the user would hard-delete every trip they own (taking down
-- co-travellers' data) and erase their expense_splits in other people's trips (silently rewriting
-- everyone's balances). This RPC instead:
--   1. blocks while the user still owns a trip another traveller is active/invited in
--      (ownership can't be transferred, so we refuse rather than wipe their data),
--   2. hard-deletes solo-owned trips (a clean, self-only cascade),
--   3. soft-removes the user from trips owned by others (status='removed'), preserving their
--      splits/settlements so balances stay intact for everyone else,
--   4. anonymises the profile (kept so historical balances still resolve to a name).
-- It returns whether the user still has any membership rows: true => the caller should disable +
-- scrub the auth user (keep the row for the shared history); false => the caller can erase it.
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

-- Locked to the service role: only the delete-account edge function (which has already verified the
-- caller owns the passed-in id via their own bearer token) may invoke it.
revoke all on function public.delete_my_account(uuid) from public;
revoke all on function public.delete_my_account(uuid) from anon;
revoke all on function public.delete_my_account(uuid) from authenticated;
grant execute on function public.delete_my_account(uuid) to service_role;
