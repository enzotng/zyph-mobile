-- Group features: co-member profile visibility + join-by-code.

-- Co-member profile visibility (US-026): a user can read profiles of people who
-- share an active trip with them. SECURITY DEFINER helper avoids RLS recursion.
create or replace function private.shares_active_trip(_other uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.trip_members me
    join public.trip_members them on them.trip_id = me.trip_id
    where me.user_id = auth.uid()
      and me.status = 'active'
      and them.user_id = _other
      and them.status = 'active'
  );
$$;

grant usage on schema private to authenticated;
grant execute on function private.shares_active_trip(uuid) to authenticated;

create policy "profiles_select_comember" on public.profiles
  for select to authenticated using (private.shares_active_trip(id));

-- Join a trip by its invite code (US-020). SECURITY DEFINER so a non-member can
-- look up the trip + insert their own membership; idempotent.
create or replace function public.join_trip_by_code(_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  _trip_id uuid;
begin
  select id into _trip_id
  from public.trips
  where invite_code = lower(trim(_code));

  if _trip_id is null then
    raise exception 'invalid invite code';
  end if;

  insert into public.trip_members (trip_id, user_id, role, status)
  values (_trip_id, auth.uid(), 'member', 'active')
  on conflict (trip_id, user_id) do nothing;

  return _trip_id;
end;
$$;

revoke all on function public.join_trip_by_code(text) from public;
revoke all on function public.join_trip_by_code(text) from anon;
grant execute on function public.join_trip_by_code(text) to authenticated;
