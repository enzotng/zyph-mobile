-- Packing assignment is now RPC-mediated so it can emit a notification (private.notify is only
-- callable from definer functions). Other packing_items columns (label/category/quantity/packed)
-- stay direct collaborative CRUD under the existing FOR ALL "packing_items_member" policy. The
-- table is intentionally NOT locked: under the mutually-trusted trip model a direct
-- assigned_member write over PostgREST is acceptable (it just would not notify).

-- 1) Let members mute packing notifications, mirroring the other category toggles.
alter table public.notification_preferences
  add column if not exists packing_enabled boolean not null default true;

-- 2) Re-create private.notify with the same signature/body plus a 'packing' opt-out branch.
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
          (_category = 'event' and not p.timeline_enabled) or
          (_category = 'packing' and not p.packing_enabled)
        )
    );
end;
$$;

revoke all on function private.notify(uuid[], uuid, uuid, text, jsonb) from public;
revoke all on function private.notify(uuid[], uuid, uuid, text, jsonb) from anon;
revoke all on function private.notify(uuid[], uuid, uuid, text, jsonb) from authenticated;

-- 3) Assign a shared packing item to a member (or unassign with NULL) and notify the assignee.
create or replace function public.assign_packing_item(_item_id uuid, _member_id uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  _uid uuid := auth.uid();
  _trip_id uuid;
  _scope text;
  _label text;
  _assignee_uid uuid;
begin
  select trip_id, scope, label
    into _trip_id, _scope, _label
    from public.packing_items
    where id = _item_id;
  if _trip_id is null then
    raise exception 'packing item not found';
  end if;
  -- Assignment is shared-only (a personal item has a single owner). Reject first so the rule
  -- holds regardless of the membership gate below.
  if _scope = 'personal' then
    raise exception 'cannot assign a personal item';
  end if;
  if not private.is_trip_member(_trip_id) then
    raise exception 'not allowed to modify this item';
  end if;

  if _member_id is not null then
    select user_id into _assignee_uid
      from public.trip_members
      where id = _member_id and trip_id = _trip_id and status = 'active';
    if _assignee_uid is null then
      raise exception 'member is not an active member of this trip';
    end if;
  end if;

  update public.packing_items set assigned_member = _member_id where id = _item_id;

  if _member_id is not null and _assignee_uid <> _uid then
    perform private.notify(
      array[_assignee_uid], _uid, _trip_id, 'packing.assigned',
      jsonb_build_object('itemId', _item_id, 'label', _label, 'memberId', _member_id)
    );
  end if;
end;
$$;

revoke all on function public.assign_packing_item(uuid, uuid) from public;
revoke all on function public.assign_packing_item(uuid, uuid) from anon;
grant execute on function public.assign_packing_item(uuid, uuid) to authenticated;

-- 4) Claim a shared item for yourself (self-assign). No notification (you would only notify self).
create or replace function public.claim_packing_item(_item_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  _uid uuid := auth.uid();
  _trip_id uuid;
  _scope text;
  _member_id uuid;
begin
  select trip_id, scope
    into _trip_id, _scope
    from public.packing_items
    where id = _item_id;
  if _trip_id is null then
    raise exception 'packing item not found';
  end if;
  -- Claiming is shared-only. Reject personal first so the rule holds independently of the gate.
  if _scope = 'personal' then
    raise exception 'cannot assign a personal item';
  end if;
  if not private.is_trip_member(_trip_id) then
    raise exception 'not allowed to modify this item';
  end if;

  select id into _member_id
    from public.trip_members
    where trip_id = _trip_id and user_id = _uid and status = 'active';
  if _member_id is null then
    raise exception 'not an active member of this trip';
  end if;

  update public.packing_items set assigned_member = _member_id where id = _item_id;
end;
$$;

revoke all on function public.claim_packing_item(uuid) from public;
revoke all on function public.claim_packing_item(uuid) from anon;
grant execute on function public.claim_packing_item(uuid) to authenticated;

-- 5) Nudge the current assignee of a shared item (peer reminder).
create or replace function public.nudge_packing_item(_item_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  _uid uuid := auth.uid();
  _trip_id uuid;
  _scope text;
  _owner uuid;
  _label text;
  _assignee_member uuid;
  _assignee_uid uuid;
begin
  select trip_id, scope, owner_id, label, assigned_member
    into _trip_id, _scope, _owner, _label, _assignee_member
    from public.packing_items
    where id = _item_id;
  if _trip_id is null then
    raise exception 'packing item not found';
  end if;
  if _scope = 'shared' then
    if not private.is_trip_member(_trip_id) then
      raise exception 'not allowed to modify this item';
    end if;
  elsif _owner <> _uid then
    raise exception 'not allowed to modify this item';
  end if;
  if _assignee_member is null then
    raise exception 'item has no assignee';
  end if;

  select user_id into _assignee_uid
    from public.trip_members
    where id = _assignee_member and trip_id = _trip_id and status = 'active';
  if _assignee_uid is null then
    raise exception 'assignee is no longer an active member';
  end if;

  perform private.notify(
    array[_assignee_uid], _uid, _trip_id, 'packing.nudged',
    jsonb_build_object('itemId', _item_id, 'label', _label)
  );
end;
$$;

revoke all on function public.nudge_packing_item(uuid) from public;
revoke all on function public.nudge_packing_item(uuid) from anon;
grant execute on function public.nudge_packing_item(uuid) to authenticated;
