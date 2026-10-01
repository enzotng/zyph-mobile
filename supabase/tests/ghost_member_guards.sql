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
-- Run against a local stack - `supabase db start`, or `supabase db reset` if one is already up:
--   docker exec -i supabase_db_zyph-mobile psql -U postgres -d postgres -q < supabase/tests/ghost_member_guards.sql
-- Every check raises on failure, so a clean run means every guard held. CI runs it on every pull
-- request and on pushes to develop and main.

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
   'authenticated', 'authenticated', 'claimer@guards.test', '', now(), now(), now()),
  ('44444444-4444-4444-4444-444444444444', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'leaver@guards.test', '', now(), now(), now());

update public.profiles set display_name = 'Marco'
  where id = '11111111-1111-1111-1111-111111111111';
update public.profiles set display_name = 'Outsider'
  where id = '22222222-2222-2222-2222-222222222222';
update public.profiles set display_name = 'Lea'
  where id = '33333333-3333-3333-3333-333333333333';

-- One trip per check that could disturb another's.
insert into public.trips (id, owner_id, title, invite_code, currency)
values
  ('aaaaaaaa-0000-0000-0000-00000000000a', '11111111-1111-1111-1111-111111111111', 'A', 'guarda', 'EUR'),
  ('aaaaaaaa-0000-0000-0000-00000000000b', '11111111-1111-1111-1111-111111111111', 'B', 'guardb', 'EUR'),
  ('aaaaaaaa-0000-0000-0000-00000000000c', '11111111-1111-1111-1111-111111111111', 'C', 'guardc', 'EUR'),
  ('aaaaaaaa-0000-0000-0000-00000000000d', '11111111-1111-1111-1111-111111111111', 'D', 'guardd', 'EUR'),
  ('aaaaaaaa-0000-0000-0000-00000000000e', '11111111-1111-1111-1111-111111111111', 'E', 'guarde', 'EUR'),
  ('aaaaaaaa-0000-0000-0000-00000000000f', '11111111-1111-1111-1111-111111111111', 'F', 'guardf', 'EUR'),
  ('aaaaaaaa-0000-0000-0000-000000000010', '11111111-1111-1111-1111-111111111111', 'G', 'guardg', 'EUR'),
  ('aaaaaaaa-0000-0000-0000-000000000011', '11111111-1111-1111-1111-111111111111', 'H', 'guardh', 'EUR'),
  ('aaaaaaaa-0000-0000-0000-000000000012', '11111111-1111-1111-1111-111111111111', 'I', 'guardi', 'EUR');

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

-- 7. Detaching drops the place's live position. The row is keyed to the place, not the account, so
--    left behind it stays readable by co-members and shows under whoever claims the place next.
reset role;
insert into public.trip_members (trip_id, user_id, role, status, display_name, claimed_at)
values ('aaaaaaaa-0000-0000-0000-00000000000e', '33333333-3333-3333-3333-333333333333',
        'member', 'active', 'Lea', now() - interval '1 day');

insert into public.member_locations (trip_member_id, lat, lng)
select id, 38.72, -9.14
from public.trip_members
where trip_id = 'aaaaaaaa-0000-0000-0000-00000000000e'
  and user_id = '33333333-3333-3333-3333-333333333333';

set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111"}';

do $$
declare _member uuid;
begin
  select id into _member from public.trip_members
  where trip_id = 'aaaaaaaa-0000-0000-0000-00000000000e'
    and user_id = '33333333-3333-3333-3333-333333333333';
  perform public.detach_trip_member(_member);
exception when others then
  perform pg_temp.fail('detach drops position', sqlerrm);
end $$;

-- Read back as postgres: under RLS, a surviving row hidden from the owner would pass.
reset role;
do $$
begin
  if exists (
    select 1 from public.member_locations l
    join public.trip_members m on m.id = l.trip_member_id
    where m.trip_id = 'aaaaaaaa-0000-0000-0000-00000000000e'
  ) then
    perform pg_temp.fail('detach drops position', 'the previous holder''s position survived');
  end if;
end $$;

-- 8. claimed_at is set exactly when an account holds the place. The tenure guard compares against
--    it, and `created_at >= null` matches nothing, so a bound row without one detaches unguarded.
do $$
declare _constraint text;
begin
  insert into public.trip_members (trip_id, user_id, role, status, display_name)
  values ('aaaaaaaa-0000-0000-0000-00000000000e', '22222222-2222-2222-2222-222222222222',
          'member', 'active', 'Outsider');
  perform pg_temp.fail('tenure invariant', 'a bound row was stored without claimed_at');
exception when check_violation then
  get stacked diagnostics _constraint = constraint_name;
  if _constraint <> 'trip_members_claimed_iff_bound' then
    perform pg_temp.fail('tenure invariant', _constraint);
  end if;
end $$;

do $$
declare _constraint text;
begin
  insert into public.trip_members (trip_id, user_id, role, status, display_name, claimed_at)
  values ('aaaaaaaa-0000-0000-0000-00000000000e', null, 'member', 'active', 'Nobody', now());
  perform pg_temp.fail('tenure invariant', 'a ghost was stored with a claimed_at');
exception when check_violation then
  get stacked diagnostics _constraint = constraint_name;
  if _constraint <> 'trip_members_claimed_iff_bound' then
    perform pg_temp.fail('tenure invariant', _constraint);
  end if;
end $$;

-- 9. Claiming a free place binds the account and dates the tenure in the same write.
set local role authenticated;
set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333"}';

-- A null slot would still succeed through the "I am not in the list" branch, which inserts a fresh
-- row - so the read-back targets the offered place by id, never "any row of this account".
do $$
declare _slot uuid;
begin
  _slot := (public.get_trip_claim_options('guarda') -> 'slots' -> 0 ->> 'slotId')::uuid;
  if _slot is null then
    raise exception 'no free place was offered';
  end if;
  perform set_config('guards.slot', _slot::text, true);
  perform public.claim_trip_slot('guarda', _slot);
exception when others then
  perform pg_temp.fail('claim binds', sqlerrm);
end $$;

reset role;
do $$
begin
  if not exists (
    select 1 from public.trip_members
    where id = current_setting('guards.slot')::uuid
      and user_id = '33333333-3333-3333-3333-333333333333'
      and claimed_at is not null
  ) then
    perform pg_temp.fail('claim binds', 'the offered place is not bound and dated');
  end if;
end $$;

-- 11. The limiter's window and ceiling come from the server: arguments a caller passes are ignored,
--     and a bucket with no policy is refused rather than left unlimited.
set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222"}';

do $$
declare i int;
begin
  for i in 1..20 loop
    if not public.check_rate_limit('copilot') then
      perform pg_temp.fail('limiter policy', 'call ' || i || ' of 20 was refused');
    end if;
  end loop;
  if public.check_rate_limit('copilot') then
    perform pg_temp.fail('limiter policy', 'the 21st call was allowed');
  end if;
  if public.check_rate_limit('copilot', 1000, -1) then
    perform pg_temp.fail('limiter policy', 'arguments passed by the caller reopened the window');
  end if;
  if public.check_rate_limit('no-such-bucket') then
    perform pg_temp.fail('limiter policy', 'a bucket with no policy was allowed');
  end if;
end $$;

-- 12. A wrong invite code costs an attempt like a right one. It must answer rather than raise: a raise
--     rolls the counter back with it.
do $$
declare i int; _err text := null;
begin
  for i in 1..15 loop
    if public.get_trip_claim_options('guardzz') is distinct from '{"error":"invalid_code"}'::jsonb then
      perform pg_temp.fail('invite attempts', 'a wrong code did not answer invalid_code');
    end if;
    if public.claim_trip_slot('guardzz', gen_random_uuid()) is not null then
      perform pg_temp.fail('invite attempts', 'a wrong code returned a place');
    end if;
  end loop;
  begin
    perform public.get_trip_claim_options('guardzz');
  exception when others then
    _err := sqlerrm;
  end;
  if _err is distinct from 'rate limited' then
    perform pg_temp.fail('invite attempts', coalesce(_err, 'the 31st attempt was allowed'));
  end if;
end $$;

-- 13. A position is only shown for the current tenure: a row older than the claim belongs to whoever
--     held the place before, or to nobody.
reset role;
insert into public.trip_members (trip_id, user_id, role, status, display_name, claimed_at)
values ('aaaaaaaa-0000-0000-0000-00000000000f', '33333333-3333-3333-3333-333333333333',
        'member', 'active', 'Lea', now() - interval '1 day');

insert into public.member_locations (trip_member_id, lat, lng, updated_at)
select id, 38.72, -9.14, claimed_at - interval '1 minute'
from public.trip_members
where trip_id = 'aaaaaaaa-0000-0000-0000-00000000000f'
  and user_id = '33333333-3333-3333-3333-333333333333';

set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111"}';

do $$
begin
  if exists (select 1 from public.member_locations l
             join public.trip_members m on m.id = l.trip_member_id
             where m.trip_id = 'aaaaaaaa-0000-0000-0000-00000000000f') then
    perform pg_temp.fail('tenure position', 'a position older than the claim was readable');
  end if;
end $$;

reset role;
update public.member_locations set updated_at = now()
where trip_member_id in (select id from public.trip_members
                         where trip_id = 'aaaaaaaa-0000-0000-0000-00000000000f');
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111"}';

do $$
begin
  if not exists (select 1 from public.member_locations l
                 join public.trip_members m on m.id = l.trip_member_id
                 where m.trip_id = 'aaaaaaaa-0000-0000-0000-00000000000f') then
    perform pg_temp.fail('tenure position', 'a position from the current tenure was hidden');
  end if;
end $$;

-- 14. Removing a member drops their position.
do $$
declare _member uuid;
begin
  select id into _member from public.trip_members
  where trip_id = 'aaaaaaaa-0000-0000-0000-00000000000f'
    and user_id = '33333333-3333-3333-3333-333333333333';
  perform public.remove_trip_member(_member);
exception when others then
  perform pg_temp.fail('remove drops position', sqlerrm);
end $$;

reset role;
do $$
begin
  if exists (
    select 1 from public.member_locations l
    join public.trip_members m on m.id = l.trip_member_id
    where m.trip_id = 'aaaaaaaa-0000-0000-0000-00000000000f'
  ) then
    perform pg_temp.fail('remove drops position', 'the removed member''s position survived');
  end if;
end $$;

-- 15. Leaving drops your position. Shared through the RPC first, which is also its happy path.
insert into public.trip_members (trip_id, user_id, role, status, display_name, claimed_at)
values ('aaaaaaaa-0000-0000-0000-000000000010', '33333333-3333-3333-3333-333333333333',
        'member', 'active', 'Lea', now() - interval '1 day');

set local role authenticated;
set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333"}';

do $$
begin
  perform public.upsert_member_location('aaaaaaaa-0000-0000-0000-000000000010', 38.72, -9.14);
exception when others then
  perform pg_temp.fail('leave drops position', sqlerrm);
end $$;

reset role;
do $$
begin
  if not exists (
    select 1 from public.member_locations l
    join public.trip_members m on m.id = l.trip_member_id
    where m.trip_id = 'aaaaaaaa-0000-0000-0000-000000000010'
  ) then
    perform pg_temp.fail('leave drops position', 'upsert_member_location wrote nothing');
  end if;
end $$;

set local role authenticated;
set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333"}';

do $$
begin
  perform public.leave_trip('aaaaaaaa-0000-0000-0000-000000000010');
exception when others then
  perform pg_temp.fail('leave drops position', sqlerrm);
end $$;

reset role;
do $$
begin
  if exists (
    select 1 from public.member_locations l
    join public.trip_members m on m.id = l.trip_member_id
    where m.trip_id = 'aaaaaaaa-0000-0000-0000-000000000010'
  ) then
    perform pg_temp.fail('leave drops position', 'the leaver''s position survived');
  end if;
end $$;

-- 16. Deleting an account drops its positions on the trips it shared.
insert into public.trip_members (trip_id, user_id, role, status, display_name, claimed_at)
values ('aaaaaaaa-0000-0000-0000-000000000011', '44444444-4444-4444-4444-444444444444',
        'member', 'active', 'Sam', now() - interval '1 day');

insert into public.member_locations (trip_member_id, lat, lng)
select id, 38.72, -9.14
from public.trip_members
where trip_id = 'aaaaaaaa-0000-0000-0000-000000000011'
  and user_id = '44444444-4444-4444-4444-444444444444';

do $$
begin
  perform public.delete_my_account('44444444-4444-4444-4444-444444444444');
  if exists (
    select 1 from public.member_locations l
    join public.trip_members m on m.id = l.trip_member_id
    where m.trip_id = 'aaaaaaaa-0000-0000-0000-000000000011'
  ) then
    perform pg_temp.fail('account deletion drops position', 'the deleted account''s position survived');
  end if;
end $$;

-- 17. Positions are written through the RPC only, which checks membership under a row lock. A direct
--     write is checked against a snapshot, so it can still land on a place freed in the meantime.
insert into public.trip_members (trip_id, user_id, role, status, display_name, claimed_at)
values ('aaaaaaaa-0000-0000-0000-000000000012', '33333333-3333-3333-3333-333333333333',
        'member', 'active', 'Lea', now() - interval '1 day');

do $$
declare _member uuid;
begin
  select id into _member from public.trip_members
  where trip_id = 'aaaaaaaa-0000-0000-0000-000000000012'
    and user_id = '33333333-3333-3333-3333-333333333333';
  perform set_config('guards.direct_member', _member::text, true);
end $$;

set local role authenticated;
set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333"}';

do $$
begin
  insert into public.member_locations (trip_member_id, lat, lng)
  values (current_setting('guards.direct_member')::uuid, 38.72, -9.14);
  perform pg_temp.fail('direct write', 'a member wrote a position without the RPC');
exception when insufficient_privilege then
  if sqlerrm not like 'permission denied%' then
    perform pg_temp.fail('direct write', sqlerrm);
  end if;
end $$;

-- 18. Tripwire, since one session cannot race two: the RPC must take the place row FOR SHARE so a
--     write in flight waits for a concurrent detach or removal and then sees the place is no longer
--     the caller's.
reset role;
do $$
begin
  if pg_get_functiondef('public.upsert_member_location(uuid, double precision, double precision, real, real)'::regprocedure)
     not ilike '%for share%' then
    perform pg_temp.fail('location row lock', 'upsert_member_location no longer locks the place row');
  end if;
end $$;

-- 19. The invite code is not writable by a client: a unique column answers whether a value is taken,
--     so letting a client choose one turns every insert or update into a lookup.
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111"}';

do $$
declare _err text;
begin
  begin
    update public.trips set invite_code = 'guardb' where id = 'aaaaaaaa-0000-0000-0000-00000000000a';
  exception when others then
    _err := sqlerrm;
  end;
  if _err is distinct from 'invite code is not writable' then
    perform pg_temp.fail('invite code write', coalesce(_err, 'an owner set their trip''s code'));
  end if;
end $$;

do $$
begin
  insert into public.trips (id, owner_id, title, invite_code, currency)
  values ('aaaaaaaa-0000-0000-0000-000000000013', '11111111-1111-1111-1111-111111111111', 'J',
          'guarda', 'EUR');
  perform public.regenerate_invite_code('aaaaaaaa-0000-0000-0000-00000000000b');
exception when others then
  perform pg_temp.fail('invite code write', sqlerrm);
end $$;

reset role;
do $$
begin
  if (select invite_code from public.trips where id = 'aaaaaaaa-0000-0000-0000-000000000013') = 'guarda' then
    perform pg_temp.fail('invite code write', 'an insert kept the code its client chose');
  end if;
  if (select invite_code from public.trips where id = 'aaaaaaaa-0000-0000-0000-00000000000b') = 'guardb' then
    perform pg_temp.fail('invite code write', 'regenerate_invite_code no longer changes the code');
  end if;
end $$;

-- 20. Renaming a free place goes through: a missing limiter policy would refuse every call, and no
--     other check reaches the limiter of rename_ghost_member on a successful path.
do $$
declare _ghost uuid;
begin
  select id into _ghost from public.trip_members
  where trip_id = 'aaaaaaaa-0000-0000-0000-00000000000c' and user_id is null
  limit 1;
  perform set_config('guards.rename_target', _ghost::text, true);
end $$;

set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111"}';

do $$
begin
  perform public.rename_ghost_member(current_setting('guards.rename_target')::uuid, 'Renamed');
exception when others then
  perform pg_temp.fail('rename happy path', sqlerrm);
end $$;

-- 21. Every bucket the code names has a policy: without one the limiter refuses, and an edge
--     function answers 429 to everyone while CI stays green.
reset role;
do $$
declare _missing text;
begin
  select string_agg(b, ', ') into _missing
  from unnest(array['copilot', 'poi-search', 'poi-photo', 'place-search', 'parse-receipt-email',
                    'generate-packing', 'upload-avatar', 'upload-trip-cover', 'trip-cover',
                    'claim-options', 'add-ghost', 'rename-ghost']) as b
  where not exists (select 1 from private.rate_limit_policies p where p.bucket = b);
  if _missing is not null then
    perform pg_temp.fail('limiter policies', 'no policy for ' || _missing);
  end if;
end $$;

set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111"}';

-- 10. Rate limit: 30 per hour per trip. Last, because it spends its trip's budget.
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
