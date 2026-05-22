-- Per-member balance for a trip: paid - owed. SECURITY INVOKER so RLS applies
-- (only active members of the trip can read its expenses/splits, hence its balances).
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
    select paid_by, sum(amount_cents) as paid
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
  where m.trip_id = _trip_id and m.status = 'active';
$$;

revoke all on function public.get_trip_balances(uuid) from public;
revoke all on function public.get_trip_balances(uuid) from anon;
grant execute on function public.get_trip_balances(uuid) to authenticated;
