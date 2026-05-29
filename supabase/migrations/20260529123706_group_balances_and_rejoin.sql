-- Group accounting fixes.
--
-- 1. get_trip_balances dropped removed members entirely (status = 'active'
--    filter), so a member who had paid for or owed on past expenses vanished
--    from the totals. The remaining balances then no longer summed to zero and
--    "Settle up" produced wrong transfers. Soft-delete (status = 'removed') was
--    chosen precisely to keep historical balances on the books, so balances must
--    still include any member with financial history, active or not.
--
-- 2. join_trip_by_code used ON CONFLICT DO NOTHING, so a member who had left or
--    been removed could never re-join with the code (their row stayed 'removed').
--    Re-joining now reactivates the existing membership.

-- Include removed members that still carry a paid amount or an owed share, so the
-- books balance. Active members are always listed (even with zero activity);
-- removed members appear only while they still have outstanding history.
create or replace function public.get_trip_balances(_trip_id uuid)
returns table (
  member_id uuid,
  user_id uuid,
  paid_cents bigint,
  owed_cents bigint,
  balance_cents bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    m.id as member_id,
    m.user_id,
    coalesce(p.paid, 0) as paid_cents,
    coalesce(s.owed, 0) as owed_cents,
    coalesce(p.paid, 0) - coalesce(s.owed, 0) as balance_cents
  from public.trip_members m
  left join (
    select paid_by, sum(base_amount_cents) as paid
    from public.expenses
    where trip_id = _trip_id and deleted_at is null
    group by paid_by
  ) p on p.paid_by = m.id
  left join (
    select es.member_id, sum(es.share_cents) as owed
    from public.expense_splits es
    join public.expenses e on e.id = es.expense_id
    where e.trip_id = _trip_id and e.deleted_at is null
    group by es.member_id
  ) s on s.member_id = m.id
  where m.trip_id = _trip_id
    and (m.status = 'active' or coalesce(p.paid, 0) <> 0 or coalesce(s.owed, 0) <> 0);
$$;

revoke all on function public.get_trip_balances(uuid) from public;
revoke all on function public.get_trip_balances(uuid) from anon;
grant execute on function public.get_trip_balances(uuid) to authenticated;

-- Re-joining by code reactivates a previously removed membership instead of
-- silently doing nothing. Already-active members are a no-op (the WHERE guard
-- skips a redundant write).
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
  on conflict (trip_id, user_id) do update
    set status = 'active'
    where trip_members.status <> 'active';

  return _trip_id;
end;
$$;

revoke all on function public.join_trip_by_code(text) from public;
revoke all on function public.join_trip_by_code(text) from anon;
grant execute on function public.join_trip_by_code(text) to authenticated;
