-- WHY: directional events (flights, transfers) have a departure AND an arrival, but trip_events
-- only carried one point (location text + lat/lng) - Smart Import now extracts both ends, and the
-- imported flights landed with no arrival at all. end_location holds the arrival as jsonb
-- { name, lat, lng } - same free-shape convention as gate_location, nullable because most events
-- are single-place. Written by the client under the existing member RLS; no policy change.
alter table public.trip_events add column end_location jsonb;
