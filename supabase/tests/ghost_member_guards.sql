-- Guards on the ghost-place RPCs, asserted against a real database.
--
-- These exist because every one of them was silently dropped once while a SECURITY DEFINER body was
-- being re-created, and nothing noticed: PL/pgSQL resolves function calls at run time, not at CREATE,
-- so the migration applied cleanly; and the Jest suites mock Supabase, so they assert the shape of a
-- client call and can never observe a SQL guard.
--
-- Two rules learned the hard way, both load-bearing here:
--   * each check that spends the rate limit gets its OWN trip, because the limiter is keyed per trip
--     and a shared one makes a later check pass on 'rate limited' instead of the guard it names;
--   * a check must reject the SPECIFIC error, never "anything but success" - the first version of
--     check 3 accepted 'rate limited' too, so deleting the legibility guard would have kept it green.
--
-- Run against a local stack:
--   supabase db reset
--   docker exec -i supabase_db_<project> psql -U postgres -d postgres -f supabase/tests/ghost_member_guards.sql
-- Every check raises on failure, so a clean run means every guard held. Not wired into CI.

\set ON_ERROR_STOP on

begin;

-- pg_temp makes it session-local; Postgres has no CREATE TEMPORARY FUNCTION.
create function pg_temp.fail(_check text, _detail text) returns void
language plpgsql as $$
begin
  raise exception 'GUARD FAILED: % (%)', _check, _detail;
end $$;

insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, created_at, updated_at)
values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'owner@guards.test', '', now(), now(), now()),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'outsider@guards.test', '', now(), now(), now()),
  ('33333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'claimer@guards.test', '', now(), now(), now());

update public.profiles set display_name = 'Marco'
  where id = '11111111-1111-1111-1111-111111111111';
update public.profiles set display_name = 'Outsider'
  where id = '22222222-2222-2222-2222-222222222222';
update public.profiles set display_name = 'Lea'
  where id = '33333333-3333-3333-3333-333333333333';

-- One trip per rate-limit-sensitive check.
insert into public.trips (id, owner_id, title, invite_code, currency)
values
  ('aaaaaaaa-0000-0000-0000-00000000000a', '11111111-1111-1111-1111-111111111111', 'A', 'guarda', 'EUR'),
  ('aaaaaaaa-0000-0000-0000-00000000000b', '11111111-1111-1111-1111-111111111111', 'B', 'guardb', 'EUR'),
  ('aaaaaaaa-0000-0000-0000-00000000000c', '11111111-1111-1111-1111-111111111111', 'C', 'guardc', 'EUR'),
  ('aaaaaaaa-0000-0000-0000-00000000000d', '11111111-1111-1111-1111-111111111111', 'D', 'guardd', 'EUR');

set local role authenticated;

-- 1. Membership. A non-member must not be able to add a place.
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222"}';
do $$
begin
  perform public.add_ghost_member('aaaaaaaa-0000-0000-0000-00000000000a', 'Sneaky');
  perform pg_temp.fail('membership', 'a non-member added a place');
exception when others then
  if sqlerrm <> 'not a trip member' then
    perform pg_temp.fail('membership', sqlerrm);
  end if;
end $$;

set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111"}';

-- 2. The happy path must actually run. This is what catches a rate-limit call that resolves to
--    nothing: a guard test alone would raise before ever reaching it.
do $$
declare _id uuid;
begin
  _id := public.add_ghost_member('aaaaaaaa-0000-0000-0000-00000000000a', 'Lea');
  if _id is null then
    perform pg_temp.fail('happy path', 'add_ghost_member returned null');
  end if;
exception when others then
  perform pg_temp.fail('happy path', sqlerrm);
end $$;

-- 3. A name with nothing legible in it is refused AS SUCH, on a trip whose limiter is untouched.
do $$
begin
  perform public.add_ghost_member('aaaaaaaa-0000-0000-0000-00000000000b', U&'\2800\3164\00A0');
  perform pg_temp.fail('illegible name', 'a blank-rendering name was accepted');
exception when others then
  if sqlerrm <> 'invalid name' then
    perform pg_temp.fail('illegible name', sqlerrm);
  end if;
end $$;

-- 4. Rename targets an ACTIVE, UNCLAIMED place only. A claimed row carries the name of the account
--    holding it; a removed one has left the group.
do $$
declare _claimed uuid;
begin
  select id into _claimed from public.trip_members
  where trip_id = 'aaaaaaaa-0000-0000-0000-00000000000a'
    and user_id = '11111111-1111-1111-1111-111111111111';
  perform public.rename_ghost_member(_claimed, 'Hijacked');
  perform pg_temp.fail('rename target', 'renamed a claimed member');
exception when others then
  if sqlerrm <> 'not a renamable ghost' then
    perform pg_temp.fail('rename target', sqlerrm);
  end if;
end $$;

-- 5. The 50-place cap. Seeded directly, because the per-trip rate limit (30/h) is reached long
--    before the cap and would mask it.
reset role;
insert into public.trip_members (trip_id, user_id, role, status, display_name)
select 'aaaaaaaa-0000-0000-0000-00000000000c', null, 'member', 'active', 'Place ' || i
from generate_series(1, 60) i;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111"}';

do $$
begin
  perform public.add_ghost_member('aaaaaaaa-0000-0000-0000-00000000000c', 'One too many');
  perform pg_temp.fail('50-place cap', 'a 61st place was accepted');
exception when others then
  if sqlerrm <> 'member limit reached' then
    perform pg_temp.fail('50-place cap', sqlerrm);
  end if;
end $$;

-- 6. The tenure guard: the most consequential guard on the lot, and the string the client routes its
--    whole fallback dialog on. A place that moved the balances since the claim must not go back on
--    the claim list carrying someone else's ledger.
reset role;
insert into public.trip_members (trip_id, user_id, role, status, display_name, claimed_at)
values ('aaaaaaaa-0000-0000-0000-00000000000d', '33333333-3333-3333-3333-333333333333',
        'member', 'active', 'Lea', now() - interval '1 day');

insert into public.expenses (id, trip_id, description, amount_cents, base_amount_cents)
values ('eeeeeeee-0000-0000-0000-00000000000e', 'aaaaaaaa-0000-0000-0000-00000000000d',
        'Dinner', 2000, 2000);

insert into public.expense_payers (expense_id, member_id, paid_cents)
select 'eeeeeeee-0000-0000-0000-00000000000e', id, 2000
from public.trip_members
where trip_id = 'aaaaaaaa-0000-0000-0000-00000000000d'
  and user_id = '33333333-3333-3333-3333-333333333333';

set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111"}';

do $$
declare _member uuid;
begin
  select id into _member from public.trip_members
  where trip_id = 'aaaaaaaa-0000-0000-0000-00000000000d'
    and user_id = '33333333-3333-3333-3333-333333333333';
  perform public.detach_trip_member(_member);
  perform pg_temp.fail('tenure guard', 'detached a place that moved the balances since the claim');
exception when others then
  -- The client matches on this substring to offer removal instead; a reword silently disables it.
  if sqlerrm not like 'place has ledger activity since claim%' then
    perform pg_temp.fail('tenure guard', sqlerrm);
  end if;
end $$;

-- 7. Rate limit: 30 per hour per trip. Last, because it spends its trip's budget.
do $$
declare i int; _err text := null;
begin
  for i in 1..31 loop
    begin
      perform public.add_ghost_member('aaaaaaaa-0000-0000-0000-00000000000a', 'Place ' || i);
    exception when others then
      _err := sqlerrm; exit;
    end;
  end loop;
  if _err is distinct from 'rate limited' then
    perform pg_temp.fail('rate limit', coalesce(_err, 'never tripped after 31 calls'));
  end if;
end $$;

rollback;

\echo 'ghost_member_guards: all guards held'
