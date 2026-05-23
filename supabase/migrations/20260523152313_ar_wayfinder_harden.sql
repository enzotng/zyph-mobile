-- Harden AR Wayfinder policies + perf:
-- 1. Restrict member_locations UPDATE/DELETE to active members (match INSERT).
-- 2. clear_member_location RPC also requires active membership.
-- 3. Partial index on trip_members (trip_id, status='active') to speed up RLS
--    self-joins on member_locations SELECT polls.

drop policy if exists "member_locations_update_self" on public.member_locations;
create policy "member_locations_update_self" on public.member_locations
  for update to authenticated using (
    exists (
      select 1
      from public.trip_members
      where id = trip_member_id
        and user_id = auth.uid()
        and status = 'active'
    )
  );

drop policy if exists "member_locations_delete_self" on public.member_locations;
create policy "member_locations_delete_self" on public.member_locations
  for delete to authenticated using (
    exists (
      select 1
      from public.trip_members
      where id = trip_member_id
        and user_id = auth.uid()
        and status = 'active'
    )
  );

create or replace function public.clear_member_location(_trip_id uuid)
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
    and status = 'active';

  if _member_id is null then
    return;
  end if;

  delete from public.member_locations where trip_member_id = _member_id;
end;
$$;

create index if not exists trip_members_trip_id_active_idx
  on public.trip_members (trip_id)
  where status = 'active';
