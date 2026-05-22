-- Atomic creation of an expense plus its equal splits across active trip members.
-- One round trip, one transaction. SECURITY DEFINER bypasses RLS, so membership
-- is enforced manually against the authenticated user.
create or replace function public.create_expense_with_splits(
  _trip_id uuid,
  _description text,
  _amount_cents integer,
  _currency text
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
  if _amount_cents < 0 then
    raise exception 'amount must be non-negative';
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

  insert into public.expenses (trip_id, description, amount_cents, currency, paid_by, created_by)
  values (_trip_id, _description, _amount_cents, _currency, _payer, _uid)
  returning * into _expense;

  _n := array_length(_members, 1);
  _base := _amount_cents / _n;
  _rem := _amount_cents - _base * _n;

  for _i in 1 .. _n loop
    insert into public.expense_splits (expense_id, member_id, share_cents)
    values (_expense.id, _members[_i], _base + case when _i <= _rem then 1 else 0 end);
  end loop;

  return _expense;
end;
$$;

revoke all on function public.create_expense_with_splits(uuid, text, integer, text) from public;
revoke all on function public.create_expense_with_splits(uuid, text, integer, text) from anon;
grant execute on function public.create_expense_with_splits(uuid, text, integer, text) to authenticated;
