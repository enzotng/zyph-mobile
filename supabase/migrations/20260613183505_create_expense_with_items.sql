-- Atomic Smart Split create. Previously the client created a bootstrap expense (a 100%-to-me
-- split) then called upsert_expense_with_items, with a best-effort soft-delete to compensate if the
-- second call failed - a window that could leave an orphaned placeholder expense corrupting
-- balances if the app died in between. This single SECURITY DEFINER function inserts the expense +
-- items + assignments + the item-driven splits in one transaction (payer = the caller).
--
-- Hardening mirrors upsert_expense_with_items (20260523175735_smart_split_harden.sql): hard bounds
-- on amounts/fx to block inflate-via-giant-value attacks and integer overflow, a single materialised
-- assignment-validation pass, array-size caps to bound DoS, and largest-remainder rounding so
-- sum(splits) = _base_amount_cents exactly without ever producing a negative share.
create or replace function public.create_expense_with_items(
  _trip_id uuid,
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
  _payer uuid;
  _expense public.expenses;
  _item_total integer := 0;
  _item_count integer;
  _new_item_ids uuid[];
  _row record;
  _expected_base numeric;
begin
  -- Hard bounds: prevent inflate-via-giant-value attacks and integer overflow.
  if _amount_cents < 0 or _amount_cents > 100000000 then
    raise exception 'amount must be between 0 and 100,000,000 cents (got %)', _amount_cents;
  end if;
  if _base_amount_cents < 0 or _base_amount_cents > 100000000 then
    raise exception 'base amount must be between 0 and 100,000,000 cents (got %)', _base_amount_cents;
  end if;
  if _fx_rate <= 0 or _fx_rate > 1000 then
    raise exception 'fx rate must be between 0 and 1000 (got %)', _fx_rate;
  end if;

  -- Sanity: _amount_cents × _fx_rate ≈ _base_amount_cents (within 2 cents).
  _expected_base := _amount_cents * _fx_rate;
  if abs(_expected_base - _base_amount_cents) > 2 then
    raise exception 'base amount % does not match amount % × fx rate %', _base_amount_cents, _amount_cents, _fx_rate;
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

  select id into _payer
  from public.trip_members
  where trip_id = _trip_id and user_id = _uid and status = 'active';
  if _payer is null then
    raise exception 'not an active member of this trip';
  end if;

  -- Validate items.
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

  -- Validate assignments (one materialised pass for aggregates + membership).
  for _row in
    with parsed as (
      select position, member_id, share
      from jsonb_to_recordset(_assignments) as x(position integer, member_id uuid, share numeric)
    ),
    bad_position as (
      select 1 from parsed
      where position is null or position < 0 or position >= _item_count
      limit 1
    ),
    bad_share as (
      select position, sum(share) as total
      from parsed
      group by position
      having abs(sum(share) - 1.0) > 0.0001
      limit 1
    ),
    missing_assignment as (
      select 1
      from generate_series(0, _item_count - 1) as i
      left join parsed on parsed.position = i
      where parsed.position is null
      limit 1
    ),
    bad_member as (
      select 1
      from parsed p
      where not exists (
        select 1 from public.trip_members
        where id = p.member_id and trip_id = _trip_id and status = 'active'
      )
      limit 1
    )
    select
      (select count(*) from bad_position) as positions,
      (select position from bad_share) as bad_share_pos,
      (select total from bad_share) as bad_share_total,
      (select count(*) from missing_assignment) as missing,
      (select count(*) from bad_member) as members
  loop
    if _row.positions > 0 then
      raise exception 'assignment position out of range';
    end if;
    if _row.bad_share_pos is not null then
      raise exception 'shares for item % must sum to 1 (got %)', _row.bad_share_pos, _row.bad_share_total;
    end if;
    if _row.missing > 0 then
      raise exception 'every item must have at least one assignment';
    end if;
    if _row.members > 0 then
      raise exception 'assignment member is not an active trip member';
    end if;
  end loop;

  insert into public.expenses (
    trip_id, description, amount_cents, currency, base_amount_cents, fx_rate, paid_by, created_by
  )
  values (
    _trip_id, _description, _amount_cents, _currency, _base_amount_cents, _fx_rate, _payer, _uid
  )
  returning * into _expense;

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

  -- Largest-remainder rounding: floor each member's exact share in base cents,
  -- then give the leftover cents to the members with the largest fractional
  -- remainder. Guarantees sum(splits) = _base_amount_cents and no negative share.
  with exact_shares as (
    select asg.member_id,
           sum(itm.amount_cents * asg.share * _fx_rate) as exact_cents
    from public.expense_items itm
    join public.expense_item_assignments asg on asg.item_id = itm.id
    where itm.expense_id = _expense.id
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
  select _expense.id, member_id, share_cents from resolved;

  perform private.notify(
    array(select user_id from public.trip_members where trip_id = _trip_id and status = 'active'),
    _uid, _trip_id, 'expense.added',
    jsonb_build_object('expenseId', _expense.id, 'description', _expense.description, 'amountCents', _expense.amount_cents)
  );

  return _expense;
end;
$$;

revoke all on function public.create_expense_with_items(uuid, text, integer, text, integer, numeric, jsonb, jsonb) from public;
revoke all on function public.create_expense_with_items(uuid, text, integer, text, integer, numeric, jsonb, jsonb) from anon;
grant execute on function public.create_expense_with_items(uuid, text, integer, text, integer, numeric, jsonb, jsonb) to authenticated;
