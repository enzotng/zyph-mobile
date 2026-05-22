-- Custom splits (US-032): an expense can be divided among a chosen subset of members
-- with adjustable proportions. The client computes the per-member share_cents (equal or
-- weighted, largest-remainder) and passes them explicitly; the server validates that every
-- split member is an active member and that the shares sum to the trip-currency base amount.
-- This replaces the previous server-side equal-split signature.

create or replace function public.create_expense_with_splits(
  _trip_id uuid,
  _description text,
  _amount_cents integer,
  _currency text,
  _base_amount_cents integer,
  _fx_rate numeric,
  _splits jsonb
)
returns public.expenses
language plpgsql
security definer
set search_path = ''
as $$
declare
  _uid uuid := auth.uid();
  _payer uuid;
  _expense public.expenses;
  _total integer := 0;
  _split record;
begin
  if _amount_cents < 0 or _base_amount_cents < 0 then
    raise exception 'amount must be non-negative';
  end if;

  if _fx_rate <= 0 then
    raise exception 'fx rate must be positive';
  end if;

  if _splits is null or jsonb_typeof(_splits) <> 'array' or jsonb_array_length(_splits) = 0 then
    raise exception 'at least one split is required';
  end if;

  select id into _payer
  from public.trip_members
  where trip_id = _trip_id and user_id = _uid and status = 'active';

  if _payer is null then
    raise exception 'not an active member of this trip';
  end if;

  -- Validate every split: positive share, member belongs to this trip and is active.
  for _split in
    select * from jsonb_to_recordset(_splits) as x(member_id uuid, share_cents integer)
  loop
    if _split.share_cents is null or _split.share_cents < 0 then
      raise exception 'share must be non-negative';
    end if;
    if not exists (
      select 1 from public.trip_members
      where id = _split.member_id and trip_id = _trip_id and status = 'active'
    ) then
      raise exception 'split member is not an active trip member';
    end if;
    _total := _total + _split.share_cents;
  end loop;

  if _total <> _base_amount_cents then
    raise exception 'splits must sum to the base amount';
  end if;

  insert into public.expenses (
    trip_id, description, amount_cents, currency, base_amount_cents, fx_rate, paid_by, created_by
  )
  values (
    _trip_id, _description, _amount_cents, _currency, _base_amount_cents, _fx_rate, _payer, _uid
  )
  returning * into _expense;

  insert into public.expense_splits (expense_id, member_id, share_cents)
  select _expense.id, x.member_id, x.share_cents
  from jsonb_to_recordset(_splits) as x(member_id uuid, share_cents integer);

  return _expense;
end;
$$;

-- Drop the previous all-members equal-split signature.
drop function if exists public.create_expense_with_splits(uuid, text, integer, text, integer, numeric);

revoke all on function public.create_expense_with_splits(uuid, text, integer, text, integer, numeric, jsonb) from public;
revoke all on function public.create_expense_with_splits(uuid, text, integer, text, integer, numeric, jsonb) from anon;
grant execute on function public.create_expense_with_splits(uuid, text, integer, text, integer, numeric, jsonb) to authenticated;
