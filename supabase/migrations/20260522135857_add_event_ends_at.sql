-- Optional end time for timeline events (US-021). Lets an event be "in progress"
-- between starts_at and ends_at; point events (no ends_at) flip straight from the
-- countdown to "completed" once starts_at passes.
alter table public.trip_events
  add column ends_at timestamptz
    check (ends_at is null or starts_at is null or ends_at >= starts_at);
