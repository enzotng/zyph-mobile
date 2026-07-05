-- WHY: event.added notified every active member even when the event concerns a subset - the
-- exact noise the participants column exists to remove. When NEW.participants is a non-empty
-- subset, only notify active members WITHIN it (intersection guards against stale/foreign ids
-- in the array); otherwise keep the whole-group behavior. private.notify already skips the
-- actor and honors per-user notification preferences.
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
    array(
      select user_id from public.trip_members
      where trip_id = new.trip_id
        and status = 'active'
        and (
          new.participants is null
          or cardinality(new.participants) = 0
          or user_id = any(new.participants)
        )
    ),
    _actor, new.trip_id, 'event.added',
    jsonb_build_object('eventId', new.id, 'title', new.title)
  );
  return new;
end;
$$;
