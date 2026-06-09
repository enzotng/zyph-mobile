-- Follow-up fixes to the notifications feature (20260606182725), from the pre-commit audit:
-- 1. join_trip_by_code emitted member.joined even on a no-op re-join of an already-active
--    member. Only announce a join when the membership actually transitioned to active.
-- 2. tg_notify_event_added trusted NEW.created_by as the actor, but trip_events is inserted
--    directly by the client and its INSERT policy does not pin created_by to auth.uid() - so
--    a member could spoof the actor and suppress the event notification to a chosen victim.
--    Use auth.uid() (the real inserter, available inside the trigger) instead, and skip
--    emission when it is unknown.

create or replace function public.join_trip_by_code(_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  _uid uuid := auth.uid();
  _trip_id uuid;
  _prev_status public.member_status;
begin
  select id into _trip_id
  from public.trips
  where invite_code = lower(trim(_code));

  if _trip_id is null then
    raise exception 'invalid invite code';
  end if;

  select status into _prev_status
  from public.trip_members
  where trip_id = _trip_id and user_id = _uid;

  insert into public.trip_members (trip_id, user_id, role, status)
  values (_trip_id, _uid, 'member', 'active')
  on conflict (trip_id, user_id) do update
    set status = 'active'
    where trip_members.status <> 'active';

  -- Only announce a join when the member actually became active (brand new row or a
  -- reactivation), never on a redundant re-join by an already-active member.
  if _prev_status is null or _prev_status <> 'active' then
    perform private.notify(
      array(select user_id from public.trip_members where trip_id = _trip_id and status = 'active'),
      _uid, _trip_id, 'member.joined', '{}'::jsonb
    );
  end if;

  return _trip_id;
end;
$$;

create or replace function public.tg_notify_event_added()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  _actor uuid := auth.uid();
begin
  -- Attribute to the authenticated inserter, not the client-supplied created_by (which is not
  -- pinned to auth.uid() and could be spoofed to suppress the notification for a victim).
  if _actor is null then
    return new;
  end if;

  perform private.notify(
    array(select user_id from public.trip_members where trip_id = new.trip_id and status = 'active'),
    _actor, new.trip_id, 'event.added',
    jsonb_build_object('eventId', new.id, 'title', new.title)
  );
  return new;
end;
$$;
