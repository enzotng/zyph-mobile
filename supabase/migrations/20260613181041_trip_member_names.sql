-- Resolve display names for ALL trip members, including soft-removed ones, so historical balances
-- and splits show a real name instead of "Member". A direct client join cannot do this: the
-- profiles RLS (profiles_select_comember -> private.shares_active_trip) only exposes a profile when
-- BOTH members are active, so a removed member's name reads back as null. This SECURITY DEFINER
-- function reads profiles as the owner, gated on the caller being an active member of the trip, so
-- it never exposes anyone outside the caller's own trips (and it surfaces no data the caller did
-- not already see while that person was active). RGPD-deleted accounts keep their nulled name.
create or replace function public.trip_member_names(_trip_id uuid)
returns table (id uuid, user_id uuid, display_name text)
language sql
stable
security definer
set search_path = ''
as $$
  select m.id, m.user_id, p.display_name
  from public.trip_members m
  left join public.profiles p on p.id = m.user_id
  where m.trip_id = _trip_id
    and private.is_trip_member(_trip_id)
$$;

revoke all on function public.trip_member_names(uuid) from public;
revoke all on function public.trip_member_names(uuid) from anon;
grant execute on function public.trip_member_names(uuid) to authenticated;
