-- Ghost members (Lot 1a): the place becomes the trip's canonical identity and the account becomes a
-- binding claimed afterwards, so a member can carry ledger before ever installing the app. A ghost is
-- a trip_members row with a null user_id and a display_name; claimed_at dates the current tenure of an
-- account on a place and is what the detach guard measures against.
-- Every path that binds a user_id must freeze the alias and date the tenure, so the creation trigger
-- is patched here and the direct PostgREST INSERT path is closed - after this the list of binding
-- paths is closed and the alias invariant holds by construction rather than by convention.
-- private.handle_new_trip and public.trip_member_names are reproduced VERBATIM from
-- 20260522095147_initial_schema.sql and 20260613181041_trip_member_names.sql, with ONLY the insert
-- column list and the third selected column changed respectively.

alter table public.trip_members
  alter column user_id drop not null,
  add column display_name text,
  add column claimed_at timestamptz,
  add constraint trip_members_ghost_has_name
    check (user_id is not null or (display_name is not null and btrim(display_name) <> ''));

-- claimed_at is the start of the account's CURRENT tenure on the place; null <=> ghost. Every path
-- that binds a user_id sets it, but reactivating an already-bound row never refreshes it: that
-- would move the previous tenure's ledger out of the detach guard's window.
update public.trip_members set claimed_at = joined_at where user_id is not null;

update public.trip_members m
set display_name = p.display_name
from public.profiles p
where p.id = m.user_id and m.display_name is null;

-- The creation trigger is one of the paths that binds a user_id, so it freezes the alias and dates
-- the tenure like the others: without claimed_at, the detach guard's `created_at >= claimed_at`
-- matches nothing and passes vacuously on the owner's row.
create or replace function private.handle_new_trip()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.trip_members (trip_id, user_id, role, status, display_name, claimed_at)
  values (new.id, new.owner_id, 'owner', 'active',
    (select display_name from public.profiles where id = new.owner_id), now());
  return new;
end;
$$;

-- Direct PostgREST INSERT is the last write path that could bind a user_id without an alias, and
-- trip_members_ghost_has_name cannot catch it (the constraint only bounds rows with a null
-- user_id). Close the path rather than widen the constraint: requiring an alias on bound rows too
-- would reject the legitimate residue of a profile nulled before the bind.
drop policy "members_insert_owner" on public.trip_members;
revoke insert on public.trip_members from authenticated, anon;

-- A ghost has no profile row to join, so p.display_name is null: without the coalesce every
-- historical balance, split and settlement resolves it through the client's "Member" fallback.
create or replace function public.trip_member_names(_trip_id uuid)
returns table (id uuid, user_id uuid, display_name text)
language sql
stable
security definer
set search_path = ''
as $$
  select m.id, m.user_id, coalesce(p.display_name, m.display_name)
  from public.trip_members m
  left join public.profiles p on p.id = m.user_id
  where m.trip_id = _trip_id
    and private.is_trip_member(_trip_id)
$$;

revoke all on function public.trip_member_names(uuid) from public;
revoke all on function public.trip_member_names(uuid) from anon;
grant execute on function public.trip_member_names(uuid) to authenticated;
