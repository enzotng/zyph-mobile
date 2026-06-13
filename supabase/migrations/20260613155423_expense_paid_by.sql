-- "Paid by" support: let an expense be paid by any active trip member, not just its creator.
-- The expenses.paid_by column and get_trip_balances (which groups paid amounts by paid_by) already
-- support this; only the create/update RPCs hard-coded the payer to auth.uid(). Add an optional
-- `_paid_by` argument to both (drop-then-create discipline, since the arg list changes).
--   create: explicit payer (must be an active member) or default to the caller.
--   update: explicit payer (must be an active member) or keep the existing one (coalesce).

drop function if exists public.create_expense_with_splits(uuid, text, integer, text, integer, numeric, jsonb, text);
drop function if exists public.update_expense_with_splits(uuid, text, integer, text, integer, numeric, jsonb, text);

create function public.create_expense_with_splits(
  _trip_id uuid,
  _description text,
  _amount_cents integer,
  _currency text,
  _base_amount_cents integer,
  _fx_rate numeric,
  _splits jsonb,
  _category text default null,
  _paid_by uuid default null
)
returns public.expenses
language plpgsql
security definer
set search_path = ''
as $$
declare
  _uid uuid := auth.uid();
  _caller uuid;
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

  select id into _caller
  from public.trip_members
  where trip_id = _trip_id and user_id = _uid and status = 'active';

  if _caller is null then
    raise exception 'not an active member of this trip';
  end if;

  -- Resolve the payer: an explicit _paid_by (must be an active member) or the caller.
  if _paid_by is not null then
    if not exists (
      select 1 from public.trip_members
      where id = _paid_by and trip_id = _trip_id and status = 'active'
    ) then
      raise exception 'payer is not an active trip member';
    end if;
    _payer := _paid_by;
  else
    _payer := _caller;
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

  perform private.notify(
    array(select user_id from public.trip_members where trip_id = _trip_id and status = 'active'),
    _uid, _trip_id, 'expense.added',
    jsonb_build_object('expenseId', _expense.id, 'description', _expense.description, 'amountCents', _expense.amount_cents)
  );

  return _expense;
end;
$$;

create function public.update_expense_with_splits(
  _expense_id uuid,
  _description text,
  _amount_cents integer,
  _currency text,
  _base_amount_cents integer,
  _fx_rate numeric,
  _splits jsonb,
  _category text default null,
  _paid_by uuid default null
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

  -- Validate an explicit payer when provided; null keeps the current paid_by.
  if _paid_by is not null and not exists (
    select 1 from public.trip_members
    where id = _paid_by and trip_id = _trip_id and status = 'active'
  ) then
    raise exception 'payer is not an active trip member';
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
      category = _category,
      paid_by = coalesce(_paid_by, paid_by)
  where id = _expense_id
  returning * into _expense;

  -- Editing through the plain split editor converts a former Smart Split (itemised) expense back
  -- to a simple split, so its line items must not survive.
  delete from public.expense_items where expense_id = _expense_id;

  delete from public.expense_splits where expense_id = _expense_id;

  insert into public.expense_splits (expense_id, member_id, share_cents)
  select _expense.id, x.member_id, x.share_cents
  from jsonb_to_recordset(_splits) as x(member_id uuid, share_cents integer);

  perform private.notify(
    array(select user_id from public.trip_members where trip_id = _trip_id and status = 'active'),
    _uid, _trip_id, 'expense.updated',
    jsonb_build_object('expenseId', _expense.id, 'description', _expense.description, 'amountCents', _expense.amount_cents)
  );

  return _expense;
end;
$$;

-- Fresh `create function` objects inherit the default EXECUTE -> PUBLIC grant; revoke it (and anon,
-- for parity with the sibling RPCs - anon is never granted here) then grant authenticated.
revoke all on function public.create_expense_with_splits(uuid, text, integer, text, integer, numeric, jsonb, text, uuid) from public;
revoke all on function public.create_expense_with_splits(uuid, text, integer, text, integer, numeric, jsonb, text, uuid) from anon;
grant execute on function public.create_expense_with_splits(uuid, text, integer, text, integer, numeric, jsonb, text, uuid) to authenticated;

revoke all on function public.update_expense_with_splits(uuid, text, integer, text, integer, numeric, jsonb, text, uuid) from public;
revoke all on function public.update_expense_with_splits(uuid, text, integer, text, integer, numeric, jsonb, text, uuid) from anon;
grant execute on function public.update_expense_with_splits(uuid, text, integer, text, integer, numeric, jsonb, text, uuid) to authenticated;

-- expense_packing_item calls create_expense_with_splits positionally (8 args). It still resolves to
-- the new 9-arg function via the _paid_by default, but recreate it with named arguments so the call
-- is explicit and immune to any future signature change. Same signature (create or replace), so its
-- grants are preserved. Body unchanged except the now-named, _paid_by-explicit call.
create or replace function public.expense_packing_item(_item_id uuid, _amount_cents integer, _member_ids uuid[])
returns public.expenses
language plpgsql
security definer
set search_path = ''
as $$
declare
  _uid uuid := auth.uid();
  _item public.packing_items;
  _currency text;
  _shares jsonb;
  _expense public.expenses;
begin
  if _amount_cents is null or _amount_cents <= 0 then
    raise exception 'amount must be positive';
  end if;

  select * into _item from public.packing_items where id = _item_id;
  if _item.id is null then
    raise exception 'packing item not found';
  end if;
  if _item.scope <> 'shared' then
    raise exception 'only shared items can be split as an expense';
  end if;

  -- Caller must be an active member of the item's trip (create_expense_with_splits re-checks,
  -- but this gives a clear early error and pins the trip from the item, not client input).
  if not exists (
    select 1 from public.trip_members
    where trip_id = _item.trip_id and user_id = _uid and status = 'active'
  ) then
    raise exception 'not an active member of this trip';
  end if;

  -- Block double-billing only while the linked expense is still live; a soft-deleted one frees it.
  if _item.expense_id is not null and exists (
    select 1 from public.expenses where id = _item.expense_id and deleted_at is null
  ) then
    raise exception 'this item is already linked to an expense';
  end if;

  if _member_ids is null or array_length(_member_ids, 1) is null then
    raise exception 'at least one member is required';
  end if;

  -- Equal split across the DISTINCT members, the first (amount mod n) members carrying the extra
  -- cent so the shares always sum exactly to the amount.
  with members as (
    select distinct m as member_id from unnest(_member_ids) as m
  ),
  ordered as (
    select member_id,
           row_number() over (order by member_id) - 1 as idx,
           count(*) over () as n
    from members
  )
  select jsonb_agg(
    jsonb_build_object(
      'member_id', member_id,
      'share_cents', (_amount_cents / n) + case when idx < (_amount_cents % n) then 1 else 0 end
    )
  )
  into _shares
  from ordered;

  select currency into _currency from public.trips where id = _item.trip_id;

  -- Reuse the canonical path: validates members, inserts expense + splits, notifies expense.added.
  -- Named args + explicit _paid_by => null (payer defaults to the caller) so this never depends on
  -- argument position or a defaulted overload.
  _expense := public.create_expense_with_splits(
    _trip_id => _item.trip_id,
    _description => _item.label,
    _amount_cents => _amount_cents,
    _currency => coalesce(_currency, 'EUR'),
    _base_amount_cents => _amount_cents,
    _fx_rate => 1,
    _splits => _shares,
    _category => 'shopping',
    _paid_by => null
  );

  update public.packing_items set expense_id = _expense.id where id = _item_id;

  return _expense;
end;
$$;
