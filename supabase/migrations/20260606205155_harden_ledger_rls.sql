-- Lock the financial-ledger tables to their SECURITY DEFINER RPC write paths, the same fix
-- already applied to trip_settlements (20260606203832). expenses, expense_splits, expense_items
-- and expense_item_assignments carried FOR ALL membership-only policies, and Supabase's default
-- grants give the authenticated role INSERT/UPDATE/DELETE - so any active member could write them
-- directly over PostgREST, bypassing the RPCs that enforce the split-sums-to-base invariant and
-- silently rewriting share_cents / amounts / items to desync everyone's balance. The client only
-- SELECTs these tables directly; every mutation already runs through an RPC, except the expense
-- soft-delete, which this migration moves into a new soft_delete_expense RPC.

-- expenses: move the soft-delete into an RPC, then restrict the table to SELECT.
create or replace function public.soft_delete_expense(_expense_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  _uid uuid := auth.uid();
  _trip_id uuid;
begin
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

  update public.expenses set deleted_at = now() where id = _expense_id;
end;
$$;

revoke all on function public.soft_delete_expense(uuid) from public;
revoke all on function public.soft_delete_expense(uuid) from anon;
grant execute on function public.soft_delete_expense(uuid) to authenticated;

drop policy "expenses_all_member" on public.expenses;
create policy "expenses_select_member" on public.expenses
  for select to authenticated
  using (private.is_trip_member(trip_id));
revoke insert, update, delete on public.expenses from authenticated;
revoke insert, update, delete on public.expenses from anon;

-- expense_splits: the balance source of truth. SELECT-only (was FOR ALL).
drop policy "splits_all_member" on public.expense_splits;
create policy "splits_select_member" on public.expense_splits
  for select to authenticated
  using (
    exists (
      select 1 from public.expenses e
      where e.id = expense_id and private.is_trip_member(e.trip_id)
    )
  );
revoke insert, update, delete on public.expense_splits from authenticated;
revoke insert, update, delete on public.expense_splits from anon;

-- expense_items / expense_item_assignments: keep the existing SELECT policies, drop the FOR ALL
-- modify policies, and revoke direct writes (upsert_expense_with_items is the only write path).
drop policy "expense_items_modify_member" on public.expense_items;
revoke insert, update, delete on public.expense_items from authenticated;
revoke insert, update, delete on public.expense_items from anon;

drop policy "expense_item_assignments_modify_member" on public.expense_item_assignments;
revoke insert, update, delete on public.expense_item_assignments from authenticated;
revoke insert, update, delete on public.expense_item_assignments from anon;

-- trip_members: drop the owner direct-DELETE policy. Membership changes go through the
-- soft-delete RPCs (remove_trip_member / leave_trip set status = 'removed'); a hard DELETE here
-- would cascade expense_splits / trip_settlements and rewrite historical balances. Trip deletion
-- still cascades members via the FK, which is not policy-gated.
drop policy "members_delete_owner" on public.trip_members;
