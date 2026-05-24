-- Smart Split: per-item attribution for expenses (Pilier 3 du pitch).
-- An expense can have N items, each item is assigned to one or more trip members.
-- expense_splits remains the source of truth for balances; this RPC derives splits
-- from items + assignments atomically so the two stay in sync.

create table public.expense_items (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references public.expenses (id) on delete cascade,
  label text not null,
  amount_cents integer not null check (amount_cents >= 0),
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create index expense_items_expense_id_idx on public.expense_items (expense_id);

alter table public.expense_items enable row level security;

create policy "expense_items_select_member" on public.expense_items
  for select to authenticated using (
    exists (
      select 1
      from public.expenses e
      where e.id = expense_items.expense_id
        and private.is_trip_member(e.trip_id)
    )
  );

create policy "expense_items_modify_member" on public.expense_items
  for all to authenticated
  using (
    exists (
      select 1
      from public.expenses e
      where e.id = expense_items.expense_id
        and private.is_trip_member(e.trip_id)
    )
  )
  with check (
    exists (
      select 1
      from public.expenses e
      where e.id = expense_items.expense_id
        and private.is_trip_member(e.trip_id)
    )
  );

create table public.expense_item_assignments (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.expense_items (id) on delete cascade,
  member_id uuid not null references public.trip_members (id) on delete cascade,
  share numeric(5, 4) not null default 1.0 check (share > 0 and share <= 1),
  unique (item_id, member_id)
);

create index expense_item_assignments_item_id_idx on public.expense_item_assignments (item_id);
create index expense_item_assignments_member_id_idx on public.expense_item_assignments (member_id);

alter table public.expense_item_assignments enable row level security;

create policy "expense_item_assignments_select_member" on public.expense_item_assignments
  for select to authenticated using (
    exists (
      select 1
      from public.expense_items i
      join public.expenses e on e.id = i.expense_id
      where i.id = expense_item_assignments.item_id
        and private.is_trip_member(e.trip_id)
    )
  );

create policy "expense_item_assignments_modify_member" on public.expense_item_assignments
  for all to authenticated
  using (
    exists (
      select 1
      from public.expense_items i
      join public.expenses e on e.id = i.expense_id
      where i.id = expense_item_assignments.item_id
        and private.is_trip_member(e.trip_id)
    )
  )
  with check (
    exists (
      select 1
      from public.expense_items i
      join public.expenses e on e.id = i.expense_id
      where i.id = expense_item_assignments.item_id
        and private.is_trip_member(e.trip_id)
    )
  );

-- Smart Split RPC: writes the expense + items + assignments and recomputes
-- expense_splits from the item allocation atomically.
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

  -- Validate items: non-negative amounts, sum matches expense total.
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

  -- Validate assignments: positions in range, shares per item sum to 1.
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

  -- Every item must have at least one assignment.
  if (
    select count(distinct position) from jsonb_to_recordset(_assignments)
    as x(position integer, member_id uuid, share numeric)
  ) <> _item_count then
    raise exception 'every item must have at least one assignment';
  end if;

  -- Every assignment member must be an active member of this trip.
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

  -- Update expense.
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

  -- Insert assignments using position → uuid mapping.
  insert into public.expense_item_assignments (item_id, member_id, share)
  select _new_item_ids[a.position + 1], a.member_id, a.share
  from jsonb_to_recordset(_assignments) as a(position integer, member_id uuid, share numeric);

  -- Derive expense_splits from items × assignments × fx_rate.
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

  -- Last-cent correction so sum(splits) = _base_amount_cents exactly.
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

  return _expense;
end;
$$;

revoke all on function public.upsert_expense_with_items(uuid, text, integer, text, integer, numeric, jsonb, jsonb) from public;
revoke all on function public.upsert_expense_with_items(uuid, text, integer, text, integer, numeric, jsonb, jsonb) from anon;
grant execute on function public.upsert_expense_with_items(uuid, text, integer, text, integer, numeric, jsonb, jsonb) to authenticated;

-- Keep the legacy update_expense_with_splits RPC honest: when called on an expense
-- that previously had Smart Split items, the items become stale. Clear them so the
-- two flows can never silently disagree.
create or replace function public.update_expense_with_splits(
  _expense_id uuid,
  _description text,
  _amount_cents integer,
  _currency text,
  _base_amount_cents integer,
  _fx_rate numeric,
  _splits jsonb
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
      fx_rate = _fx_rate
  where id = _expense_id
  returning * into _expense;

  -- Clear items left over from a previous Smart Split flow.
  delete from public.expense_items where expense_id = _expense_id;

  delete from public.expense_splits where expense_id = _expense_id;

  insert into public.expense_splits (expense_id, member_id, share_cents)
  select _expense.id, x.member_id, x.share_cents
  from jsonb_to_recordset(_splits) as x(member_id uuid, share_cents integer);

  return _expense;
end;
$$;
