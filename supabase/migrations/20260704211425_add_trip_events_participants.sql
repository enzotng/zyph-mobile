-- WHY: a timeline event is implicitly "for the whole group", but real events often concern a
-- subset (a flight booked for 2 of 3 members). participants holds the subset as user ids;
-- NULL or empty = the whole group (zero backfill - every existing event keeps its meaning, and
-- "everyone selected" stores NULL so the list never goes stale when membership changes).
-- No per-element FK (same client-trust level as the rest of the row, written under member RLS);
-- no index (the timeline filters client-side on already-fetched trips).
alter table public.trip_events add column participants uuid[];
