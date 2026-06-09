-- Proactive in-app reminder: two days before departure, nudge every active member about the
-- shared gear that is still unpacked or unassigned, so nothing is forgotten at the last minute.
-- This writes through the same private.notify path (category 'packing', so each member's opt-out
-- is honoured) with a null actor - a system reminder skips nobody. Scheduled with pg_cron; the
-- function is also callable on demand for testing.

create extension if not exists pg_cron;

-- Supports the reminder's per-trip scan of shared items (and any shared-list query) so the daily
-- job stays cheap as the table grows.
create index if not exists packing_items_shared_idx
  on public.packing_items (trip_id)
  where scope = 'shared';

create or replace function private.send_packing_reminders()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  _trip record;
  _pending integer;
  _recipients uuid[];
begin
  for _trip in
    select id from public.trips where start_date = current_date + 2
  loop
    select count(*) into _pending
    from public.packing_items
    where trip_id = _trip.id
      and scope = 'shared'
      and (packed = false or assigned_member is null);

    if _pending > 0 then
      _recipients := array(
        select user_id from public.trip_members
        where trip_id = _trip.id and status = 'active'
      );
      perform private.notify(
        _recipients,
        null,
        _trip.id,
        'packing.reminder',
        jsonb_build_object('pending', _pending)
      );
    end if;
  end loop;
end;
$$;

revoke all on function private.send_packing_reminders() from public;
revoke all on function private.send_packing_reminders() from anon;
revoke all on function private.send_packing_reminders() from authenticated;

-- Daily at 08:00 UTC. The named overload upserts, so re-running this is idempotent.
select cron.schedule(
  'packing-j2-reminders',
  '0 8 * * *',
  $$select private.send_packing_reminders();$$
);
