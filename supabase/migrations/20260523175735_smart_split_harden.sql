-- Harden Smart Split (audit findings):
-- 1. Bound _fx_rate, _amount_cents, _base_amount_cents so a caller cannot inflate
--    splits via giant values.
-- 2. Sanity-check that _amount_cents * _fx_rate ≈ _base_amount_cents.
-- 3. Largest-remainder rounding for derived splits so sum(splits) = _base_amount_cents
--    exactly without ever producing a negative share.
-- 4. Wrap private.is_trip_member calls in (select ...) inside RLS policies so
--    PostgreSQL caches the result per statement (Supabase RLS perf pattern).

-- Bounds (in cents). 100M cents = 1M of the trip currency. Generous, prevents
-- integer overflow when multiplied by fx_rate.
-- fx_rate sanity: same-currency = 1.0, extreme cross-currency JPY/USD around 100,
-- realistic max around 200. Cap at 1000 to leave headroom.

drop policy if exists "expense_items_select_member" on public.expense_items;
create policy "expense_items_select_member" on public.expense_items
  for select to authenticated using (
    exists (
      select 1
      from public.expenses e
      where e.id = expense_items.expense_id
        and (select private.is_trip_member(e.trip_id))
    )
  );

drop policy if exists "expense_items_modify_member" on public.expense_items;
create policy "expense_items_modify_member" on public.expense_items
  for all to authenticated
  using (
    exists (
      select 1
      from public.expenses e
      where e.id = expense_items.expense_id
        and (select private.is_trip_member(e.trip_id))
    )
  )
  with check (
    exists (
      select 1
      from public.expenses e
      where e.id = expense_items.expense_id
        and (select private.is_trip_member(e.trip_id))
    )
  );

drop policy if exists "expense_item_assignments_select_member" on public.expense_item_assignments;
create policy "expense_item_assignments_select_member" on public.expense_item_assignments
  for select to authenticated using (
    exists (
      select 1
      from public.expense_items i
      join public.expenses e on e.id = i.expense_id
      where i.id = expense_item_assignments.item_id
        and (select private.is_trip_member(e.trip_id))
    )
  );

drop policy if exists "expense_item_assignments_modify_member" on public.expense_item_assignments;
create policy "expense_item_assignments_modify_member" on public.expense_item_assignments
  for all to authenticated
  using (
    exists (
      select 1
      from public.expense_items i
      join public.expenses e on e.id = i.expense_id
      where i.id = expense_item_assignments.item_id
        and (select private.is_trip_member(e.trip_id))
    )
  )
  with check (
    exists (
      select 1
      from public.expense_items i
      join public.expenses e on e.id = i.expense_id
      where i.id = expense_item_assignments.item_id
        and (select private.is_trip_member(e.trip_id))
    )
  );

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

  -- Update the expense itself.
  update public.expenses
  set description = _description,
      amount_cents = _amount_cents,
      currency = _currency,
      base_amount_cents = _base_amount_cents,
      fx_rate = _fx_rate
  where id = _expense_id
  returning * into _expense;

  -- Replace items (cascade clears assignments).
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

  -- Largest-remainder rounding: floor each member's exact share in base cents,
  -- then give the leftover cents to the members with the largest fractional
  -- remainder. Guarantees sum(splits) = _base_amount_cents and no negative share.
  delete from public.expense_splits where expense_id = _expense_id;

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

  return _expense;
end;
$$;
