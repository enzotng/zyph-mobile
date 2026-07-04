-- WHY: trip_events.location is a PostGIS geography (a point), so the human-readable place NAME
-- extracted by Smart Import (e.g. an airport name) had nowhere to persist - imported flights
-- landed with coordinates at best and no display name. location_name holds the departure/venue
-- name as plain text (the arrival lives in end_location jsonb). Nullable; no policy change.
alter table public.trip_events add column location_name text;
