-- Deleting an account stopped anonymising it when ghost places landed. delete_my_account nulls
-- profiles.display_name, which was enough while trip_member_names read that column alone; it now
-- reads coalesce(p.display_name, m.display_name), and every path that binds an account freezes a
-- copy of the profile name into trip_members.display_name. So a deleted account still resolved to
-- its real name for every co-member, on every historical balance, split and settlement - and on
-- already-shipped clients too, since they call the same function.
--
-- Reproduced VERBATIM from 20260610221630_delete_my_account.sql with ONLY the member-alias update
-- added.

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
