-- Multi-currency support (US-025).
-- An expense may be entered in a currency different from the trip's. We freeze the
-- ECB rate at entry time and store the trip-currency amount (base_amount_cents) that
-- drives splits and balances - Splitwise-style, so balances never drift with the rate.
-- The original amount_cents + currency are kept for display.

alter table public.expenses
  add column base_amount_cents integer not null default 0 check (base_amount_cents >= 0),
  add column fx_rate numeric(18, 8) not null default 1 check (fx_rate > 0);

-- Existing rows were single-currency: base equals the original amount, rate 1.
update public.expenses set base_amount_cents = amount_cents;

-- Force callers (the RPC) to supply the base amount explicitly going forward.
alter table public.expenses alter column base_amount_cents drop default;

-- Recreate the atomic insert RPC with the base amount + frozen rate; splits are
-- computed from base_amount_cents so every share is in the trip's currency.
create or replace function public.create_expense_with_splits(
  _trip_id uuid,
  _description text,
  _amount_cents integer,
  _currency text,
  _base_amount_cents integer,
  _fx_rate numeric
)
returns public.expenses
language plpgsql
security definer
set search_path = ''
as $$
declare
  _uid uuid := auth.uid();
  _payer uuid;
  _members uuid[];
  _expense public.expenses;
  _n integer;
  _base integer;
  _rem integer;
  _i integer;
begin
  if _amount_cents < 0 or _base_amount_cents < 0 then
    raise exception 'amount must be non-negative';
  end if;

  if _fx_rate <= 0 then
    raise exception 'fx rate must be positive';
  end if;

  select array_agg(id order by joined_at) into _members
  from public.trip_members
  where trip_id = _trip_id and status = 'active';

  select id into _payer
  from public.trip_members
  where trip_id = _trip_id and user_id = _uid and status = 'active';

  if _payer is null or _members is null then
    raise exception 'not an active member of this trip';
  end if;

  insert into public.expenses (
    trip_id, description, amount_cents, currency, base_amount_cents, fx_rate, paid_by, created_by
  )
  values (
    _trip_id, _description, _amount_cents, _currency, _base_amount_cents, _fx_rate, _payer, _uid
  )
  returning * into _expense;

  _n := array_length(_members, 1);
  _base := _base_amount_cents / _n;
  _rem := _base_amount_cents - _base * _n;

  for _i in 1 .. _n loop
    insert into public.expense_splits (expense_id, member_id, share_cents)
    values (_expense.id, _members[_i], _base + case when _i <= _rem then 1 else 0 end);
  end loop;

  return _expense;
end;
$$;

-- Drop the previous single-currency signature.
drop function if exists public.create_expense_with_splits(uuid, text, integer, text);

revoke all on function public.create_expense_with_splits(uuid, text, integer, text, integer, numeric) from public;
revoke all on function public.create_expense_with_splits(uuid, text, integer, text, integer, numeric) from anon;
grant execute on function public.create_expense_with_splits(uuid, text, integer, text, integer, numeric) to authenticated;

-- Balances must sum the trip-currency amount, not the original currency.
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
  where m.trip_id = _trip_id and m.status = 'active';
$$;

revoke all on function public.get_trip_balances(uuid) from public;
revoke all on function public.get_trip_balances(uuid) from anon;
grant execute on function public.get_trip_balances(uuid) to authenticated;
