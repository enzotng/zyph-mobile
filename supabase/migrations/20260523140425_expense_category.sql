-- Expense categories: each expense can be tagged with one of a fixed set of categories
-- (food, transport, lodging, activity, shopping, other). Stored as text with a CHECK
-- constraint so future categories can be added without altering an enum type. Nullable
-- for backwards compatibility with rows created before this migration.

alter table public.expenses
  add column category text;

alter table public.expenses
  add constraint expenses_category_check
  check (category is null or category in ('food', 'transport', 'lodging', 'activity', 'shopping', 'other'));

-- Replace create_expense_with_splits to accept the new optional _category parameter.
create or replace function public.create_expense_with_splits(
  _trip_id uuid,
  _description text,
  _amount_cents integer,
  _currency text,
  _base_amount_cents integer,
  _fx_rate numeric,
  _splits jsonb,
  _category text default null
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
    trip_id, description, amount_cents, currency, base_amount_cents, fx_rate, paid_by, created_by, category
  )
  values (
    _trip_id, _description, _amount_cents, _currency, _base_amount_cents, _fx_rate, _payer, _uid, _category
  )
  returning * into _expense;

  insert into public.expense_splits (expense_id, member_id, share_cents)
  select _expense.id, x.member_id, x.share_cents
  from jsonb_to_recordset(_splits) as x(member_id uuid, share_cents integer);

  return _expense;
end;
$$;

drop function if exists public.create_expense_with_splits(uuid, text, integer, text, integer, numeric, jsonb);

revoke all on function public.create_expense_with_splits(uuid, text, integer, text, integer, numeric, jsonb, text) from public;
revoke all on function public.create_expense_with_splits(uuid, text, integer, text, integer, numeric, jsonb, text) from anon;
grant execute on function public.create_expense_with_splits(uuid, text, integer, text, integer, numeric, jsonb, text) to authenticated;

-- Same treatment for update_expense_with_splits.
create or replace function public.update_expense_with_splits(
  _expense_id uuid,
  _description text,
  _amount_cents integer,
  _currency text,
  _base_amount_cents integer,
  _fx_rate numeric,
  _splits jsonb,
  _category text default null
)
returns public.expenses
language plpgsql
security definer
set search_path = ''
as $$
declare
  _uid uuid := auth.uid();
  _trip_id uuid;
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

  select trip_id into _trip_id
  from public.expenses
  where id = _expense_id and deleted_at is null;

  if _trip_id is null then
    raise exception 'expense not found';
  end if;

  if not exists (
    select 1 from public.trip_members
    where trip_id = _trip_id and user_id = _uid and status = 'active'
  ) then
    raise exception 'not an active member of this trip';
  end if;

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

  update public.expenses
  set description = _description,
      amount_cents = _amount_cents,
      currency = _currency,
      base_amount_cents = _base_amount_cents,
      fx_rate = _fx_rate,
      category = _category
  where id = _expense_id
  returning * into _expense;

  delete from public.expense_splits where expense_id = _expense_id;

  insert into public.expense_splits (expense_id, member_id, share_cents)
  select _expense.id, x.member_id, x.share_cents
  from jsonb_to_recordset(_splits) as x(member_id uuid, share_cents integer);

  return _expense;
end;
$$;

drop function if exists public.update_expense_with_splits(uuid, text, integer, text, integer, numeric, jsonb);

revoke all on function public.update_expense_with_splits(uuid, text, integer, text, integer, numeric, jsonb, text) from public;
revoke all on function public.update_expense_with_splits(uuid, text, integer, text, integer, numeric, jsonb, text) from anon;
grant execute on function public.update_expense_with_splits(uuid, text, integer, text, integer, numeric, jsonb, text) to authenticated;
