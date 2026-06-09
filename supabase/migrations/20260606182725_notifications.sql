-- Notifications: a single source of truth (public.notifications) that feeds the in-app
-- feed now and push later. Rows are written ONLY by SECURITY DEFINER code (private.notify),
-- never directly by clients, so actor attribution and recipient scoping are trustworthy.
-- Notifications are emitted from inside the existing mutation RPCs (where auth.uid() and the
-- user's intent are both known) rather than from blind AFTER triggers - a trip_members
-- trigger could not read auth.uid(), so member.left vs member.removed would be unattributable
-- and the actor could notify themselves. The one exception is event.added, emitted by an
-- AFTER INSERT trigger on trip_events because created_by already records the actor for INSERT.

-- 1. Tables -------------------------------------------------------------------

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  actor_id uuid references public.profiles (id) on delete set null,
  trip_id uuid references public.trips (id) on delete cascade,
  type text not null,
  payload jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  constraint notifications_payload_object
    check (jsonb_typeof(payload) = 'object' and octet_length(payload::text) <= 2048)
);

create index notifications_recipient_idx
  on public.notifications (recipient_id, created_at desc);

create index notifications_recipient_unread_idx
  on public.notifications (recipient_id)
  where read_at is null;

alter table public.notifications enable row level security;

-- Recipients read only their own rows. No INSERT/UPDATE/DELETE policy exists: writes go
-- through private.notify (insert) and mark_*_read (update read_at) SECURITY DEFINER funcs,
-- so a client can neither forge a notification for someone else nor tamper with type/actor.
create policy "notifications_select_own" on public.notifications
  for select to authenticated
  using (recipient_id = (select auth.uid()));

create table public.notification_preferences (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  push_enabled boolean not null default true,
  members_enabled boolean not null default true,
  expenses_enabled boolean not null default true,
  settlements_enabled boolean not null default true,
  timeline_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.notification_preferences enable row level security;

create policy "notification_preferences_own" on public.notification_preferences
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- 2. notify helper ------------------------------------------------------------

-- Inserts one notification per recipient, skipping the actor and any recipient who has
-- opted out of the matching category. Absence of a preferences row means "enabled" (the
-- default), so we insert UNLESS a row explicitly disables that category. Lives in private
-- (not exposed via PostgREST); only ever called from other SECURITY DEFINER functions.
create or replace function private.notify(
  _recipients uuid[],
  _actor uuid,
  _trip_id uuid,
  _type text,
  _payload jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  _category text := split_part(_type, '.', 1);
begin
  insert into public.notifications (recipient_id, actor_id, trip_id, type, payload)
  select r, _actor, _trip_id, _type, coalesce(_payload, '{}'::jsonb)
  from unnest(_recipients) as r
  where r is not null
    and r <> coalesce(_actor, '00000000-0000-0000-0000-000000000000'::uuid)
    and not exists (
      select 1 from public.notification_preferences p
      where p.user_id = r
        and (
          (_category = 'member' and not p.members_enabled) or
          (_category = 'expense' and not p.expenses_enabled) or
          (_category = 'settlement' and not p.settlements_enabled) or
          (_category = 'event' and not p.timeline_enabled)
        )
    );
end;
$$;

revoke all on function private.notify(uuid[], uuid, uuid, text, jsonb) from public;
revoke all on function private.notify(uuid[], uuid, uuid, text, jsonb) from anon;
revoke all on function private.notify(uuid[], uuid, uuid, text, jsonb) from authenticated;

-- 3. mark-read RPCs -----------------------------------------------------------

-- read_at is the only mutable column and it is set via SECURITY DEFINER RPCs scoped to the
-- caller's own rows, so there is no client-facing UPDATE policy to over-permit type/payload.
create or replace function public.mark_notification_read(_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.notifications
  set read_at = now()
  where id = _id and recipient_id = auth.uid() and read_at is null;
end;
$$;

create or replace function public.mark_all_notifications_read()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.notifications
  set read_at = now()
  where recipient_id = auth.uid() and read_at is null;
end;
$$;

revoke all on function public.mark_notification_read(uuid) from public;
revoke all on function public.mark_notification_read(uuid) from anon;
grant execute on function public.mark_notification_read(uuid) to authenticated;

revoke all on function public.mark_all_notifications_read() from public;
revoke all on function public.mark_all_notifications_read() from anon;
grant execute on function public.mark_all_notifications_read() to authenticated;

-- 4. Instrument expense mutation RPCs ----------------------------------------
-- Each adds a single expense-level notification (recipients = active members minus the
-- actor) at the end. We deliberately do NOT notify per split: update_*/upsert_* delete and
-- reinsert the whole split set on every edit, so a per-split trigger would spam everyone.

create or replace function public.create_expense_with_splits(
  _trip_id uuid,
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

  select id into _payer
  from public.trip_members
  where trip_id = _trip_id and user_id = _uid and status = 'active';

  if _payer is null then
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

create or replace function public.update_expense_with_splits(
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

-- Legacy 7-arg overload (no category) - still reachable when the client omits _category.
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

  perform private.notify(
    array(select user_id from public.trip_members where trip_id = _trip_id and status = 'active'),
    _uid, _trip_id, 'expense.updated',
    jsonb_build_object('expenseId', _expense.id, 'description', _expense.description, 'amountCents', _expense.amount_cents)
  );

  return _expense;
end;
$$;

-- 5. Instrument record_settlement --------------------------------------------
-- Two legs, one shared type with a role discriminator in the payload: the payer (from_member)
-- learns a payment from them was recorded, the payee (to_member) learns they were paid. Only
-- active members are notified; the actor (whoever recorded it) is skipped by private.notify.

create or replace function public.record_settlement(
  _trip_id uuid,
  _from_member uuid,
  _to_member uuid,
  _amount_cents integer
)
returns public.trip_settlements
language plpgsql
security definer
set search_path = ''
as $$
declare
  _uid uuid := auth.uid();
  _row public.trip_settlements;
begin
  if not exists (
    select 1 from public.trip_members
    where trip_id = _trip_id and user_id = _uid and status = 'active'
  ) then
    raise exception 'not an active member of this trip';
  end if;

  if _amount_cents is null or _amount_cents <= 0 then
    raise exception 'amount must be positive';
  end if;

  if _from_member = _to_member then
    raise exception 'from and to members must differ';
  end if;

  if not exists (
    select 1 from public.trip_members where id = _from_member and trip_id = _trip_id
  ) or not exists (
    select 1 from public.trip_members where id = _to_member and trip_id = _trip_id
  ) then
    raise exception 'both members must belong to this trip';
  end if;

  insert into public.trip_settlements
    (trip_id, from_member, to_member, amount_cents, currency, created_by)
  values
    (_trip_id, _from_member, _to_member, _amount_cents,
     (select currency from public.trips where id = _trip_id), _uid)
  returning * into _row;

  perform private.notify(
    array(select user_id from public.trip_members where id = _from_member and status = 'active'),
    _uid, _trip_id, 'settlement.created',
    jsonb_build_object('settlementId', _row.id, 'amountCents', _row.amount_cents, 'role', 'from', 'counterpartyMemberId', _to_member)
  );
  perform private.notify(
    array(select user_id from public.trip_members where id = _to_member and status = 'active'),
    _uid, _trip_id, 'settlement.created',
    jsonb_build_object('settlementId', _row.id, 'amountCents', _row.amount_cents, 'role', 'to', 'counterpartyMemberId', _from_member)
  );

  return _row;
end;
$$;

-- 6. Instrument membership RPCs ----------------------------------------------

create or replace function public.leave_trip(_trip_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  _uid uuid := auth.uid();
  _role public.trip_role;
begin
  select role into _role
  from public.trip_members
  where trip_id = _trip_id and user_id = _uid and status = 'active';

  if _role is null then
    raise exception 'not an active member of this trip';
  end if;

  if _role = 'owner' then
    raise exception 'the owner cannot leave the trip';
  end if;

  update public.trip_members
  set status = 'removed'
  where trip_id = _trip_id and user_id = _uid;

  -- The leaver is now 'removed', so the active-member set already excludes them; notify the
  -- remaining members. (private.notify also skips the actor defensively.)
  perform private.notify(
    array(select user_id from public.trip_members where trip_id = _trip_id and status = 'active'),
    _uid, _trip_id, 'member.left', '{}'::jsonb
  );
end;
$$;

create or replace function public.remove_trip_member(_member_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  _uid uuid := auth.uid();
  _trip_id uuid;
  _role public.trip_role;
  _removed_uid uuid;
begin
  select trip_id, role, user_id into _trip_id, _role, _removed_uid
  from public.trip_members
  where id = _member_id;

  if _trip_id is null then
    raise exception 'member not found';
  end if;

  if _role = 'owner' then
    raise exception 'cannot remove the trip owner';
  end if;

  if not exists (
    select 1 from public.trips
    where id = _trip_id and owner_id = _uid
  ) then
    raise exception 'only the trip owner can remove members';
  end if;

  update public.trip_members
  set status = 'removed'
  where id = _member_id;

  -- Tell the removed member they were removed (actor = the owner, skipped by private.notify
  -- if they ever coincide).
  perform private.notify(
    array[_removed_uid], _uid, _trip_id, 'member.removed', '{}'::jsonb
  );
end;
$$;

create or replace function public.join_trip_by_code(_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  _uid uuid := auth.uid();
  _trip_id uuid;
begin
  select id into _trip_id
  from public.trips
  where invite_code = lower(trim(_code));

  if _trip_id is null then
    raise exception 'invalid invite code';
  end if;

  insert into public.trip_members (trip_id, user_id, role, status)
  values (_trip_id, _uid, 'member', 'active')
  on conflict (trip_id, user_id) do update
    set status = 'active'
    where trip_members.status <> 'active';

  -- Notify the existing members that someone joined (the joiner is now active and is the
  -- actor, so private.notify skips them).
  perform private.notify(
    array(select user_id from public.trip_members where trip_id = _trip_id and status = 'active'),
    _uid, _trip_id, 'member.joined', '{}'::jsonb
  );

  return _trip_id;
end;
$$;

-- 7. event.added trigger ------------------------------------------------------
-- The only valid trigger-based emit: trip_events are inserted directly by the client
-- (no RPC), and NEW.created_by already records the actor for an INSERT.

create or replace function public.tg_notify_event_added()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.notify(
    array(select user_id from public.trip_members where trip_id = new.trip_id and status = 'active'),
    new.created_by, new.trip_id, 'event.added',
    jsonb_build_object('eventId', new.id, 'title', new.title)
  );
  return new;
end;
$$;

create trigger trip_events_notify_added
  after insert on public.trip_events
  for each row
  execute function public.tg_notify_event_added();
