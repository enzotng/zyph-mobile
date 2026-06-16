-- Close the trip_events created_by spoof gap: the events RLS policy (events_all_member) is FOR ALL
-- and its WITH CHECK only validates trip membership, NOT created_by - so a member could attribute
-- an event to another member (and suppress that victim's "event added" notification), on INSERT or
-- by UPDATE-ing an existing row. A BEFORE INSERT OR UPDATE trigger makes created_by immutable:
--   - INSERT: forced to the authenticated caller (a service-role insert with a null auth.uid()
--     keeps whatever it set explicitly, so server-side paths are unaffected).
--   - UPDATE: forced back to the existing value, so it can never be re-attributed.

create or replace function public.trip_events_set_creator()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    new.created_by := old.created_by;
  else
    new.created_by := coalesce((select auth.uid()), new.created_by);
  end if;
  return new;
end;
$$;

drop trigger if exists trip_events_set_creator_trg on public.trip_events;
create trigger trip_events_set_creator_trg
  before insert or update on public.trip_events
  for each row
  execute function public.trip_events_set_creator();
