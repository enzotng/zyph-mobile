-- Multi-payer backend. An expense can now be paid by several members (e.g. Alice paid 30, Bob 20
-- of a 50 dinner) instead of a single `paid_by`. This is the backend half: a new expense_payers
-- table holds the per-member paid amounts (in trip-currency cents, mirroring expense_splits), the
-- balance functions read it instead of expenses.paid_by, and the write RPCs maintain it.
--
-- Backward compatible by construction: every existing expense is backfilled with ONE payer row
-- (member = paid_by, paid_cents = base_amount_cents), so the rewritten balances are identical to
-- before. expenses.paid_by is kept as the "primary payer" (largest contributor) for display.
-- The non-itemised RPCs gain an optional _payers input; itemised expenses stay single-payer
-- (payer = caller), so they just write one payer row.
--
-- Invariant: for an expense with a known payer, the payer rows sum to base_amount_cents. The one
-- exception is an expense whose payer has since left the trip (paid_by null): it keeps no payer
-- row and contributes 0 to the "paid" side - exactly the pre-migration behaviour for null paid_by.

-- 1. expense_payers table (mirrors expense_splits: cascade on member delete, unique per member) ----
create table public.expense_payers (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references public.expenses (id) on delete cascade,
  member_id uuid not null references public.trip_members (id) on delete cascade,
  -- Amount this member paid, in trip-currency cents. Per expense, the rows sum to base_amount_cents.
  paid_cents integer not null check (paid_cents >= 0),
  created_at timestamptz not null default now(),
  unique (expense_id, member_id)
);

create index expense_payers_expense_id_idx on public.expense_payers (expense_id);
create index expense_payers_member_id_idx on public.expense_payers (member_id);

-- RLS mirrors expense_splits: members of the parent expense's trip can read; all writes go through
-- the SECURITY DEFINER RPCs.
alter table public.expense_payers enable row level security;

create policy "expense_payers_select_member" on public.expense_payers
  for select to authenticated using (
    exists (
      select 1 from public.expenses e
      where e.id = expense_id and private.is_trip_member(e.trip_id)
    )
  );

revoke insert, update, delete on public.expense_payers from authenticated;
revoke insert, update, delete on public.expense_payers from anon;

-- 2. Backfill one payer row per existing expense (on conflict = idempotent if this re-runs) ---------
insert into public.expense_payers (expense_id, member_id, paid_cents)
select id, paid_by, base_amount_cents
from public.expenses
where paid_by is not null
on conflict (expense_id, member_id) do nothing;

-- 3. Balances now read expense_payers (sum of paid_cents per member) instead of expenses.paid_by ---
create or replace function public.get_trip_balances(_trip_id uuid)
returns table (
  member_id uuid,
  user_id uuid,
  paid_cents bigint,
  owed_cents bigint,
  balance_cents bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    m.id as member_id,
    m.user_id,
    coalesce(p.paid, 0) as paid_cents,
    coalesce(s.owed, 0) as owed_cents,
    coalesce(p.paid, 0) - coalesce(s.owed, 0)
      + coalesce(sp.paid_out, 0) - coalesce(sr.received, 0) as balance_cents
  from public.trip_members m
  left join (
    select ep.member_id, sum(ep.paid_cents) as paid
    from public.expense_payers ep
    join public.expenses e on e.id = ep.expense_id
    where e.trip_id = _trip_id and e.deleted_at is null
    group by ep.member_id
  ) p on p.member_id = m.id
  left join (
    select es.member_id, sum(es.share_cents) as owed
    from public.expense_splits es
    join public.expenses e on e.id = es.expense_id
    where e.trip_id = _trip_id and e.deleted_at is null
    group by es.member_id
  ) s on s.member_id = m.id
  left join (
    select from_member, sum(amount_cents) as paid_out
    from public.trip_settlements
    where trip_id = _trip_id and status = 'active'
    group by from_member
  ) sp on sp.from_member = m.id
  left join (
    select to_member, sum(amount_cents) as received
    from public.trip_settlements
    where trip_id = _trip_id and status = 'active'
    group by to_member
  ) sr on sr.to_member = m.id
  where m.trip_id = _trip_id
    and (
      m.status = 'active'
      or coalesce(p.paid, 0) <> 0
      or coalesce(s.owed, 0) <> 0
      or coalesce(sp.paid_out, 0) <> 0
      or coalesce(sr.received, 0) <> 0
    );
$$;

revoke all on function public.get_trip_balances(uuid) from public;
revoke all on function public.get_trip_balances(uuid) from anon;
grant execute on function public.get_trip_balances(uuid) to authenticated;

create or replace function public.get_my_trip_balances()
returns table (trip_id uuid, balance_cents bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    m.trip_id,
    coalesce(p.paid, 0) - coalesce(s.owed, 0)
      + coalesce(sp.paid_out, 0) - coalesce(sr.received, 0) as balance_cents
  from public.trip_members m
  left join (
    select ep.member_id, sum(ep.paid_cents) as paid
    from public.expense_payers ep
    join public.expenses e on e.id = ep.expense_id
    where e.deleted_at is null
    group by ep.member_id
  ) p on p.member_id = m.id
  left join (
    select es.member_id, sum(es.share_cents) as owed
    from public.expense_splits es
    join public.expenses e on e.id = es.expense_id
    where e.deleted_at is null
    group by es.member_id
  ) s on s.member_id = m.id
  left join (
    select from_member, sum(amount_cents) as paid_out
    from public.trip_settlements
    where status = 'active'
    group by from_member
  ) sp on sp.from_member = m.id
  left join (
    select to_member, sum(amount_cents) as received
    from public.trip_settlements
    where status = 'active'
    group by to_member
  ) sr on sr.to_member = m.id
  where m.user_id = auth.uid();
$$;

revoke all on function public.get_my_trip_balances() from public;
revoke all on function public.get_my_trip_balances() from anon;
grant execute on function public.get_my_trip_balances() to authenticated;

-- 4. Non-itemised RPCs gain an optional _payers list (signature change -> drop + create + regrant) -
-- _payers, when given, is [{member_id uuid, paid_cents integer}] in trip-currency cents that must
-- sum to _base_amount_cents; when absent the expense has a single payer (_paid_by or caller).
drop function if exists public.create_expense_with_splits(uuid, text, integer, text, integer, numeric, jsonb, text, uuid);
drop function if exists public.update_expense_with_splits(uuid, text, integer, text, integer, numeric, jsonb, text, uuid);

create function public.create_expense_with_splits(
  _trip_id uuid,
  _description text,
  _amount_cents integer,
  _currency text,
  _base_amount_cents integer,
  _fx_rate numeric,
  _splits jsonb,
  _category text default null,
  _paid_by uuid default null,
  _payers jsonb default null
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
  _has_payers boolean;
  -- bigint: up to 200 payers x 100,000,000 cents would overflow int4 before the sum check.
  _payers_total bigint := 0;
  _payer_row record;
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

  _has_payers := _payers is not null and jsonb_typeof(_payers) = 'array' and jsonb_array_length(_payers) > 0;

  if _has_payers then
    if jsonb_array_length(_payers) > 200 then
      raise exception 'too many payers (max 200)';
    end if;
    if (select count(*) from jsonb_to_recordset(_payers) as x(member_id uuid, paid_cents integer))
       <> (select count(distinct member_id) from jsonb_to_recordset(_payers) as x(member_id uuid, paid_cents integer)) then
      raise exception 'a payer appears more than once';
    end if;
    for _payer_row in
      select member_id, paid_cents from jsonb_to_recordset(_payers) as x(member_id uuid, paid_cents integer)
    loop
      if _payer_row.paid_cents is null or _payer_row.paid_cents < 0 or _payer_row.paid_cents > 100000000 then
        raise exception 'payer amount must be between 0 and 100,000,000 cents';
      end if;
      if not exists (
        select 1 from public.trip_members
        where id = _payer_row.member_id and trip_id = _trip_id and status = 'active'
      ) then
        raise exception 'payer is not an active trip member';
      end if;
      _payers_total := _payers_total + _payer_row.paid_cents;
    end loop;
    if _payers_total <> _base_amount_cents then
      raise exception 'payers must sum to the base amount (% vs %)', _payers_total, _base_amount_cents;
    end if;
    -- Primary payer = largest contributor (deterministic tie-break), kept on expenses.paid_by.
    select member_id into _payer
    from jsonb_to_recordset(_payers) as x(member_id uuid, paid_cents integer)
    order by paid_cents desc, member_id
    limit 1;
  elsif _paid_by is not null then
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

  if _has_payers then
    insert into public.expense_payers (expense_id, member_id, paid_cents)
    select _expense.id, x.member_id, x.paid_cents
    from jsonb_to_recordset(_payers) as x(member_id uuid, paid_cents integer);
  else
    insert into public.expense_payers (expense_id, member_id, paid_cents)
    values (_expense.id, _payer, _base_amount_cents);
  end if;

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
  _paid_by uuid default null,
  _payers jsonb default null
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
  _has_payers boolean;
  -- bigint: up to 200 payers x 100,000,000 cents would overflow int4 before the sum check.
  _payers_total bigint := 0;
  _payer_row record;
  _payers_primary uuid;
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

  _has_payers := _payers is not null and jsonb_typeof(_payers) = 'array' and jsonb_array_length(_payers) > 0;

  if _has_payers then
    if jsonb_array_length(_payers) > 200 then
      raise exception 'too many payers (max 200)';
    end if;
    if (select count(*) from jsonb_to_recordset(_payers) as x(member_id uuid, paid_cents integer))
       <> (select count(distinct member_id) from jsonb_to_recordset(_payers) as x(member_id uuid, paid_cents integer)) then
      raise exception 'a payer appears more than once';
    end if;
    for _payer_row in
      select member_id, paid_cents from jsonb_to_recordset(_payers) as x(member_id uuid, paid_cents integer)
    loop
      if _payer_row.paid_cents is null or _payer_row.paid_cents < 0 or _payer_row.paid_cents > 100000000 then
        raise exception 'payer amount must be between 0 and 100,000,000 cents';
      end if;
      if not exists (
        select 1 from public.trip_members
        where id = _payer_row.member_id and trip_id = _trip_id and status = 'active'
      ) then
        raise exception 'payer is not an active trip member';
      end if;
      _payers_total := _payers_total + _payer_row.paid_cents;
    end loop;
    if _payers_total <> _base_amount_cents then
      raise exception 'payers must sum to the base amount (% vs %)', _payers_total, _base_amount_cents;
    end if;
    select member_id into _payers_primary
    from jsonb_to_recordset(_payers) as x(member_id uuid, paid_cents integer)
    order by paid_cents desc, member_id
    limit 1;
  elsif _paid_by is not null and not exists (
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

  -- Primary payer: a multi-payer list wins, else an explicit _paid_by, else the existing payer.
  update public.expenses
  set description = _description,
      amount_cents = _amount_cents,
      currency = _currency,
      base_amount_cents = _base_amount_cents,
      fx_rate = _fx_rate,
      category = _category,
      paid_by = coalesce(_payers_primary, _paid_by, paid_by)
  where id = _expense_id
  returning * into _expense;

  -- Editing through the plain split editor converts a former Smart Split (itemised) expense back
  -- to a simple split, so its line items must not survive.
  delete from public.expense_items where expense_id = _expense_id;

  delete from public.expense_splits where expense_id = _expense_id;

  insert into public.expense_splits (expense_id, member_id, share_cents)
  select _expense.id, x.member_id, x.share_cents
  from jsonb_to_recordset(_splits) as x(member_id uuid, share_cents integer);

  -- Rebuild payers so they always sum to the (possibly changed) base amount.
  delete from public.expense_payers where expense_id = _expense_id;

  if _has_payers then
    insert into public.expense_payers (expense_id, member_id, paid_cents)
    select _expense.id, x.member_id, x.paid_cents
    from jsonb_to_recordset(_payers) as x(member_id uuid, paid_cents integer);
  elsif _expense.paid_by is not null then
    insert into public.expense_payers (expense_id, member_id, paid_cents)
    values (_expense.id, _expense.paid_by, _base_amount_cents);
  end if;

  perform private.notify(
    array(select user_id from public.trip_members where trip_id = _trip_id and status = 'active'),
    _uid, _trip_id, 'expense.updated',
    jsonb_build_object('expenseId', _expense.id, 'description', _expense.description, 'amountCents', _expense.amount_cents)
  );

  return _expense;
end;
$$;

revoke all on function public.create_expense_with_splits(uuid, text, integer, text, integer, numeric, jsonb, text, uuid, jsonb) from public;
revoke all on function public.create_expense_with_splits(uuid, text, integer, text, integer, numeric, jsonb, text, uuid, jsonb) from anon;
grant execute on function public.create_expense_with_splits(uuid, text, integer, text, integer, numeric, jsonb, text, uuid, jsonb) to authenticated;

revoke all on function public.update_expense_with_splits(uuid, text, integer, text, integer, numeric, jsonb, text, uuid, jsonb) from public;
revoke all on function public.update_expense_with_splits(uuid, text, integer, text, integer, numeric, jsonb, text, uuid, jsonb) from anon;
grant execute on function public.update_expense_with_splits(uuid, text, integer, text, integer, numeric, jsonb, text, uuid, jsonb) to authenticated;

-- 5. Itemised RPCs stay single-payer (payer = caller) but must now write/refresh the payer row -----
-- create_expense_with_items: re-create the hardened body (20260613183505) with one added payer
-- insert. Same signature, so create or replace preserves grants.
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
  if _amount_cents < 0 or _amount_cents > 100000000 then
    raise exception 'amount must be between 0 and 100,000,000 cents (got %)', _amount_cents;
  end if;
  if _base_amount_cents < 0 or _base_amount_cents > 100000000 then
    raise exception 'base amount must be between 0 and 100,000,000 cents (got %)', _base_amount_cents;
  end if;
  if _fx_rate <= 0 or _fx_rate > 1000 then
    raise exception 'fx rate must be between 0 and 1000 (got %)', _fx_rate;
  end if;

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

  -- Itemised expenses are single-payer (the caller): one payer row for the whole base amount.
  insert into public.expense_payers (expense_id, member_id, paid_cents)
  values (_expense.id, _payer, _base_amount_cents);

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

-- upsert_expense_with_items: same body as 20260606182725 plus a payer-row refresh keyed to the
-- (unchanged) paid_by, so the single payer row tracks the possibly-changed base amount.
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
  _adjust_member uuid;
  _splits_total integer;
  _delta integer;
begin
  if _amount_cents < 0 or _base_amount_cents < 0 then
    raise exception 'amount must be non-negative';
  end if;
  if _fx_rate <= 0 then
    raise exception 'fx rate must be positive';
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

  for _row in
    select * from jsonb_to_recordset(_items) as x(label text, amount_cents integer, position integer)
  loop
    if _row.label is null or btrim(_row.label) = '' then
      raise exception 'item label is required';
    end if;
    if _row.amount_cents is null or _row.amount_cents < 0 then
      raise exception 'item amount must be non-negative';
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

  insert into public.expense_splits (expense_id, member_id, share_cents)
  select
    _expense_id,
    asg.member_id,
    greatest(0, round(sum(itm.amount_cents * asg.share * _fx_rate))::integer) as share_cents
  from public.expense_items itm
  join public.expense_item_assignments asg on asg.item_id = itm.id
  where itm.expense_id = _expense_id
  group by asg.member_id;

  select sum(share_cents) into _splits_total
  from public.expense_splits
  where expense_id = _expense_id;
  _delta := _base_amount_cents - _splits_total;

  if _delta <> 0 then
    select member_id into _adjust_member
    from public.expense_splits
    where expense_id = _expense_id
    order by share_cents desc, member_id
    limit 1;

    update public.expense_splits
    set share_cents = greatest(0, share_cents + _delta)
    where expense_id = _expense_id and member_id = _adjust_member;
  end if;

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
