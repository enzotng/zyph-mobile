-- Recorded settlements: an off-app payment one member made to another to clear a debt.
-- This is a ledger kept separate from expenses. get_trip_balances / get_my_trip_balances
-- net active settlements out of the paid/owed totals, so marking a debt paid lowers the
-- displayed balance without mutating any expense or split. Voiding a wrong entry is a
-- soft-delete (status = 'reversed'), mirroring the trip_members status convention, so the
-- history stays on the books and netting simply ignores reversed rows.

create type public.settlement_status as enum ('active', 'reversed');

-- from_member / to_member cascade on member deletion (matching expense_splits.member_id):
-- members are soft-deleted (status = 'removed') in normal use and only ever hard-deleted
-- when their trip or profile is deleted - in which case purging the settlement is correct.
-- Using cascade (not restrict) keeps trips deletable when settlements exist.
create table public.trip_settlements (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  from_member uuid not null references public.trip_members (id) on delete cascade,
  to_member uuid not null references public.trip_members (id) on delete cascade,
  amount_cents integer not null check (amount_cents > 0),
  currency text not null default 'EUR',
  status public.settlement_status not null default 'active',
  paid_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint settlements_distinct_members check (from_member <> to_member)
);

create index trip_settlements_trip_active_idx
  on public.trip_settlements (trip_id)
  where status = 'active';

alter table public.trip_settlements enable row level security;

-- Mirror expenses_all_member: active trip members get full access, scoped through the
-- parent trip via the existing SECURITY DEFINER helper. Writes still go through the RPC;
-- this policy authorizes the SELECT done by useSettlements.
create policy "settlements_all_member" on public.trip_settlements
  for all to authenticated
  using (private.is_trip_member(trip_id))
  with check (private.is_trip_member(trip_id));

-- Record an off-app payment between two members of a trip. SECURITY DEFINER bypasses RLS;
-- membership is enforced manually against auth.uid(). Validates: positive amount, both
-- members belong to the trip (status irrelevant - a removed member can still be settled
-- with, matching get_trip_balances which keeps members that carry history), and from <> to.
create or replace function public.record_settlement(
  _trip_id uuid,
  _from_member uuid,
  _to_member uuid,
  _amount_cents integer
)
returns public.trip_settlements
language plpgsql
security definer
set search_path = ''
as $$
declare
  _uid uuid := auth.uid();
  _row public.trip_settlements;
begin
  if not exists (
    select 1 from public.trip_members
    where trip_id = _trip_id and user_id = _uid and status = 'active'
  ) then
    raise exception 'not an active member of this trip';
  end if;

  if _amount_cents is null or _amount_cents <= 0 then
    raise exception 'amount must be positive';
  end if;

  if _from_member = _to_member then
    raise exception 'from and to members must differ';
  end if;

  if not exists (
    select 1 from public.trip_members where id = _from_member and trip_id = _trip_id
  ) or not exists (
    select 1 from public.trip_members where id = _to_member and trip_id = _trip_id
  ) then
    raise exception 'both members must belong to this trip';
  end if;

  -- Currency is authoritative from the trip, never trusted from the client: balances net
  -- amount_cents in the trip currency, so a mismatched currency string must be impossible.
  insert into public.trip_settlements
    (trip_id, from_member, to_member, amount_cents, currency, created_by)
  values
    (_trip_id, _from_member, _to_member, _amount_cents,
     (select currency from public.trips where id = _trip_id), _uid)
  returning * into _row;

  return _row;
end;
$$;

revoke all on function public.record_settlement(uuid, uuid, uuid, integer) from public;
revoke all on function public.record_settlement(uuid, uuid, uuid, integer) from anon;
grant execute on function public.record_settlement(uuid, uuid, uuid, integer) to authenticated;

-- Fold active settlements into per-member balances. A settlement moves money from the
-- debtor (raises their balance toward zero: +paid_out) to the creditor (lowers theirs:
-- -received). Extends the live definition (20260529123706) - same paid/owed core plus the
-- two settlement legs - and keeps any member that still carries financial history so the
-- books sum to zero (the reason removed members are not dropped).
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
    coalesce(p.paid, 0) - coalesce(s.owed, 0)
      + coalesce(sp.paid_out, 0) - coalesce(sr.received, 0) as balance_cents
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
  left join (
    select from_member, sum(amount_cents) as paid_out
    from public.trip_settlements
    where trip_id = _trip_id and status = 'active'
    group by from_member
  ) sp on sp.from_member = m.id
  left join (
    select to_member, sum(amount_cents) as received
    from public.trip_settlements
    where trip_id = _trip_id and status = 'active'
    group by to_member
  ) sr on sr.to_member = m.id
  where m.trip_id = _trip_id
    and (
      m.status = 'active'
      or coalesce(p.paid, 0) <> 0
      or coalesce(s.owed, 0) <> 0
      or coalesce(sp.paid_out, 0) <> 0
      or coalesce(sr.received, 0) <> 0
    );
$$;

revoke all on function public.get_trip_balances(uuid) from public;
revoke all on function public.get_trip_balances(uuid) from anon;
grant execute on function public.get_trip_balances(uuid) to authenticated;

-- Keep the batched trips-list balance consistent with the in-trip one: same settlement
-- legs, grouped per trip for the signed-in user. security invoker so RLS scopes the
-- aggregates to the caller's own trips.
create or replace function public.get_my_trip_balances()
returns table (trip_id uuid, balance_cents bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    m.trip_id,
    coalesce(p.paid, 0) - coalesce(s.owed, 0)
      + coalesce(sp.paid_out, 0) - coalesce(sr.received, 0) as balance_cents
  from public.trip_members m
  left join (
    select paid_by, sum(base_amount_cents) as paid
    from public.expenses
    where deleted_at is null
    group by paid_by
  ) p on p.paid_by = m.id
  left join (
    select es.member_id, sum(es.share_cents) as owed
    from public.expense_splits es
    join public.expenses e on e.id = es.expense_id
    where e.deleted_at is null
    group by es.member_id
  ) s on s.member_id = m.id
  left join (
    select from_member, sum(amount_cents) as paid_out
    from public.trip_settlements
    where status = 'active'
    group by from_member
  ) sp on sp.from_member = m.id
  left join (
    select to_member, sum(amount_cents) as received
    from public.trip_settlements
    where status = 'active'
    group by to_member
  ) sr on sr.to_member = m.id
  where m.user_id = auth.uid();
$$;

revoke all on function public.get_my_trip_balances() from public;
revoke all on function public.get_my_trip_balances() from anon;
grant execute on function public.get_my_trip_balances() to authenticated;
