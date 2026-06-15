-- Align upsert_expense_with_items (the itemised-split EDIT path) with create_expense_with_items.
--
-- The edit path previously rounded each member's share independently (round(sum(...))) and then
-- dumped the whole reconciliation delta onto a single member. For an uneven 3+ way split with
-- fractional cents that produces a DIFFERENT, less-fair allocation than create did for the same
-- items/assignments (e.g. exact 333.6/333.6/332.8 of 1000 -> create 334/333/333, edit 333/334/333),
-- so re-saving an itemised expense unchanged could silently move a cent to a different person, and
-- the greatest(0, ...) clamp on the adjusted member could leave splits not summing to the base.
--
-- This replaces that with the SAME largest-remainder algorithm create uses (floor each exact share,
-- then give the leftover cents to the largest fractional remainders), so edit and create agree and
-- the split always reconciles to base with no negative share. It also brings the edit path up to
-- create's input hardening: hard bounds on amounts/fx, an amount x fx ~= base sanity check, and
-- array-size caps. Itemised expenses stay single-payer (unchanged).
create or replace function public.upsert_expense_with_items(
  _expense_id uuid,
  _description text,
  _amount_cents integer,
  _currency text,
  _base_amount_cents integer,
  _fx_rate numeric,
  _items jsonb,
  _assignments jsonb
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
  _item_total integer := 0;
  _item_count integer;
  _new_item_ids uuid[];
  _row record;
  _expected_base numeric;
begin
  -- Hard bounds: prevent inflate-via-giant-value attacks and integer overflow (mirrors create).
  if _amount_cents < 0 or _amount_cents > 100000000 then
    raise exception 'amount must be between 0 and 100,000,000 cents (got %)', _amount_cents;
  end if;
  if _base_amount_cents < 0 or _base_amount_cents > 100000000 then
    raise exception 'base amount must be between 0 and 100,000,000 cents (got %)', _base_amount_cents;
  end if;
  if _fx_rate <= 0 or _fx_rate > 1000 then
    raise exception 'fx rate must be between 0 and 1000 (got %)', _fx_rate;
  end if;

  -- Sanity: _amount_cents x _fx_rate ~= _base_amount_cents (within 2 cents).
  _expected_base := _amount_cents * _fx_rate;
  if abs(_expected_base - _base_amount_cents) > 2 then
    raise exception 'base amount % does not match amount % x fx rate %', _base_amount_cents, _amount_cents, _fx_rate;
  end if;

  if _items is null or jsonb_typeof(_items) <> 'array' or jsonb_array_length(_items) = 0 then
    raise exception 'at least one item is required';
  end if;
  if _assignments is null or jsonb_typeof(_assignments) <> 'array' or jsonb_array_length(_assignments) = 0 then
    raise exception 'at least one assignment is required';
  end if;

  -- Bound array sizes so a single call cannot allocate unbounded work.
  if jsonb_array_length(_items) > 200 then
    raise exception 'too many items (max 200)';
  end if;
  if jsonb_array_length(_assignments) > 2000 then
    raise exception 'too many assignments (max 2000)';
  end if;

  _item_count := jsonb_array_length(_items);

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

  for _row in
    select * from jsonb_to_recordset(_items) as x(label text, amount_cents integer, position integer)
  loop
    if _row.label is null or btrim(_row.label) = '' then
      raise exception 'item label is required';
    end if;
    if _row.amount_cents is null or _row.amount_cents < 0 then
      raise exception 'item amount must be non-negative';
    end if;
    if _row.amount_cents > 100000000 then
      raise exception 'item amount exceeds maximum (got %)', _row.amount_cents;
    end if;
    _item_total := _item_total + _row.amount_cents;
  end loop;

  if _item_total <> _amount_cents then
    raise exception 'items sum (%) must match expense amount (%)', _item_total, _amount_cents;
  end if;

  for _row in
    select position, sum(share)::numeric as total_share
    from jsonb_to_recordset(_assignments) as x(position integer, member_id uuid, share numeric)
    group by position
  loop
    if _row.position is null or _row.position < 0 or _row.position >= _item_count then
      raise exception 'assignment position % is out of range', _row.position;
    end if;
    if abs(_row.total_share - 1.0) > 0.0001 then
      raise exception 'shares for item % must sum to 1 (got %)', _row.position, _row.total_share;
    end if;
  end loop;

  if (
    select count(distinct position) from jsonb_to_recordset(_assignments)
    as x(position integer, member_id uuid, share numeric)
  ) <> _item_count then
    raise exception 'every item must have at least one assignment';
  end if;

  for _row in
    select distinct member_id
    from jsonb_to_recordset(_assignments) as x(position integer, member_id uuid, share numeric)
  loop
    if not exists (
      select 1 from public.trip_members
      where id = _row.member_id and trip_id = _trip_id and status = 'active'
    ) then
      raise exception 'assignment member is not an active trip member';
    end if;
  end loop;

  update public.expenses
  set description = _description,
      amount_cents = _amount_cents,
      currency = _currency,
      base_amount_cents = _base_amount_cents,
      fx_rate = _fx_rate
  where id = _expense_id
  returning * into _expense;

  delete from public.expense_items where expense_id = _expense_id;

  with inserted as (
    insert into public.expense_items (expense_id, label, amount_cents, position)
    select _expense.id, x.label, x.amount_cents, x.position
    from jsonb_to_recordset(_items) as x(label text, amount_cents integer, position integer)
    returning id, position
  )
  select array_agg(id order by position) into _new_item_ids from inserted;

  insert into public.expense_item_assignments (item_id, member_id, share)
  select _new_item_ids[a.position + 1], a.member_id, a.share
  from jsonb_to_recordset(_assignments) as a(position integer, member_id uuid, share numeric);

  delete from public.expense_splits where expense_id = _expense_id;

  -- Largest-remainder rounding (identical to create_expense_with_items): floor each member's exact
  -- base-cents share, then give the leftover cents to the largest fractional remainders. Guarantees
  -- sum(splits) = _base_amount_cents with no negative share, and makes edit match create.
  with exact_shares as (
    select asg.member_id,
           sum(itm.amount_cents * asg.share * _fx_rate) as exact_cents
    from public.expense_items itm
    join public.expense_item_assignments asg on asg.item_id = itm.id
    where itm.expense_id = _expense_id
    group by asg.member_id
  ),
  floored as (
    select member_id,
           floor(exact_cents)::integer as base_cents,
           (exact_cents - floor(exact_cents)) as remainder
    from exact_shares
  ),
  ranked as (
    select member_id, base_cents, remainder,
           row_number() over (order by remainder desc, member_id) as rk
    from floored
  ),
  remainder_cents as (
    select greatest(0, _base_amount_cents - (select coalesce(sum(base_cents), 0) from floored)) as need
  ),
  resolved as (
    select member_id,
           base_cents + case when rk <= (select need from remainder_cents) then 1 else 0 end as share_cents
    from ranked
  )
  insert into public.expense_splits (expense_id, member_id, share_cents)
  select _expense_id, member_id, share_cents from resolved;

  -- Refresh the single payer row to the (possibly changed) base amount. Itemised expenses stay
  -- single-payer; if the payer ever left (paid_by null) the expense simply has no payer row.
  delete from public.expense_payers where expense_id = _expense_id;
  if _expense.paid_by is not null then
    insert into public.expense_payers (expense_id, member_id, paid_cents)
    values (_expense_id, _expense.paid_by, _base_amount_cents);
  end if;

  perform private.notify(
    array(select user_id from public.trip_members where trip_id = _trip_id and status = 'active'),
    _uid, _trip_id, 'expense.updated',
    jsonb_build_object('expenseId', _expense.id, 'description', _expense.description, 'amountCents', _expense.amount_cents)
  );

  return _expense;
end;
$$;

revoke all on function public.upsert_expense_with_items(uuid, text, integer, text, integer, numeric, jsonb, jsonb) from public;
revoke all on function public.upsert_expense_with_items(uuid, text, integer, text, integer, numeric, jsonb, jsonb) from anon;
grant execute on function public.upsert_expense_with_items(uuid, text, integer, text, integer, numeric, jsonb, jsonb) to authenticated;
