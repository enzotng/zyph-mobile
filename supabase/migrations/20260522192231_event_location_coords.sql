-- Event coordinates for the trip map (US-030). The app reads and writes plain
-- lat/lng columns; a trigger keeps the existing PostGIS `location` geography in
-- sync so the gist index stays usable for future geo queries.
alter table public.trip_events
  add column lat double precision,
  add column lng double precision;

create or replace function public.trip_events_sync_location()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.lat is not null and new.lng is not null then
    new.location := extensions.st_setsrid(
      extensions.st_makepoint(new.lng, new.lat),
      4326
    )::extensions.geography;
  else
    new.location := null;
  end if;
  return new;
end;
$$;

create trigger trip_events_sync_location_trg
  before insert or update of lat, lng on public.trip_events
  for each row
  execute function public.trip_events_sync_location();
