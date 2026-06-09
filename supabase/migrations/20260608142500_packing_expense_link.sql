-- Cross-feature link: a shared packing item the buyer paid for can be turned into a trip
-- expense in one tap, reusing the existing expense + split engine. We store a back-link
-- (packing_items.expense_id) so the list can badge the item as paid and block double-billing,
-- and expose one RPC that creates the expense (split equally across the chosen travellers) and
-- sets the link atomically. Validation, split insertion and the expense.added notification all
-- flow through create_expense_with_splits, which stays the single source of truth.

alter table public.packing_items
  add column expense_id uuid references public.expenses (id) on delete set null;

-- Splits the cost of a shared packing item equally across the given trip members and links the
-- resulting expense back to the item. The caller (auth.uid()) is the payer. Amount and shares
-- are in the trip currency (fx_rate 1); use the expense screen for any multi-currency edit.
create or replace function public.expense_packing_item(
  _item_id uuid,
  _amount_cents integer,
  _member_ids uuid[]
)
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
  _expense := public.create_expense_with_splits(
    _item.trip_id,
    _item.label,
    _amount_cents,
    coalesce(_currency, 'EUR'),
    _amount_cents,
    1,
    _shares,
    'shopping'
  );

  update public.packing_items set expense_id = _expense.id where id = _item_id;

  return _expense;
end;
$$;

revoke all on function public.expense_packing_item(uuid, integer, uuid[]) from public;
revoke all on function public.expense_packing_item(uuid, integer, uuid[]) from anon;
grant execute on function public.expense_packing_item(uuid, integer, uuid[]) to authenticated;

-- expense_id (like assigned_member) is maintained only by the SECURITY DEFINER RPCs, never by a
-- direct client write. Narrow the client INSERT/UPDATE grants to the columns the app legitimately
-- writes, so a member can't forge the paid-link (or an assignment) by POSTing/PATCHing the row
-- straight through PostgREST. The RPCs run as the table owner and bypass these column grants; RLS
-- still gates which rows are visible/writable. SELECT and DELETE are unchanged.
revoke insert, update on public.packing_items from authenticated;
grant insert (trip_id, scope, owner_id, label, category, quantity, assigned_member)
  on public.packing_items to authenticated;
grant update (label, category, quantity, packed) on public.packing_items to authenticated;
