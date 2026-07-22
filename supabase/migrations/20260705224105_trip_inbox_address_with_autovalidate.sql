-- WHY: the settings sheet needs BOTH the live address and the current auto_validate flag (to render
-- the toggle) in one round-trip. The original get_trip_inbox_address returned only text; redefine it
-- to return the pair. Only the client reads this RPC (the edge fn uses resolve_trip_inbox), so the
-- return-type change is safe. DROP + CREATE because the return type changes.
drop function if exists public.get_trip_inbox_address(uuid);

create function public.get_trip_inbox_address(_trip_id uuid)
returns table (address text, auto_validate boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  _uid uuid := auth.uid();
begin
  if not exists (
    select 1 from public.trip_members
    where trip_id = _trip_id and user_id = _uid and status = 'active'
  ) then
    raise exception 'not an active member of this trip';
  end if;

  return query
  select a.slug_normalized || '@zyph.enzotang.fr', a.auto_validate
  from private.trip_inbox_addresses a
  where a.trip_id = _trip_id and a.revoked_at is null;
end;
$$;

revoke all on function public.get_trip_inbox_address(uuid) from public;
revoke all on function public.get_trip_inbox_address(uuid) from anon;
grant execute on function public.get_trip_inbox_address(uuid) to authenticated;
