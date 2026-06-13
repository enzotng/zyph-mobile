-- Fix: editing an expense raised Postgres ERROR 42725
-- "function update_expense_with_splits(...) is not unique".
--
-- A prior migration (20260606182725_notifications.sql) left TWO overloads of
-- update_expense_with_splits in the database: the canonical 8-arg version (with
-- `_category text default null`) and a 7-arg "legacy" overload with no category. When the client
-- omitted _category (every uncategorised expense), the 7-arg call matched BOTH functions - the
-- 7-arg one exactly AND the 8-arg one via its default - so Postgres could not disambiguate and
-- aborted. create_expense_with_splits was never duplicated, which is why ADD worked but EDIT did
-- not.
--
-- Collapse to exactly ONE canonical 8-arg function (drop-then-create discipline: every RPC whose
-- argument list changes must drop the old signatures rather than `create or replace`, which is how
-- the duplicate was introduced). The canonical body also clears expense_items - the dropped 7-arg
-- body did this but the surviving 8-arg one did not, so editing a former Smart Split expense
-- through the plain split editor used to leave orphaned line items behind.

drop function if exists public.update_expense_with_splits(uuid, text, integer, text, integer, numeric, jsonb, text);
drop function if exists public.update_expense_with_splits(uuid, text, integer, text, integer, numeric, jsonb);

create function public.update_expense_with_splits(
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

-- Re-grant: DROP discards the old function's privileges, and a fresh `create function` inherits
-- the default EXECUTE -> PUBLIC grant, so revoke public/anon first (matching every sibling RPC).
revoke all on function public.update_expense_with_splits(uuid, text, integer, text, integer, numeric, jsonb, text) from public;
revoke all on function public.update_expense_with_splits(uuid, text, integer, text, integer, numeric, jsonb, text) from anon;
grant execute on function public.update_expense_with_splits(uuid, text, integer, text, integer, numeric, jsonb, text) to authenticated;
