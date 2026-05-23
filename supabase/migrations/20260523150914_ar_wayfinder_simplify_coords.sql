-- Simplify AR Wayfinder geometry: store plain lat/lng on POIs and member locations
-- instead of PostGIS geography. AR consumers only need decimal coordinates, and
-- avoiding geometry keeps the API and RPC payloads simple.

alter table public.trip_pois add column lat double precision;
alter table public.trip_pois add column lng double precision;

update public.trip_pois set
  lat = extensions.st_y(location::extensions.geometry),
  lng = extensions.st_x(location::extensions.geometry);

alter table public.trip_pois alter column lat set not null;
alter table public.trip_pois alter column lng set not null;
alter table public.trip_pois drop column location;

alter table public.member_locations add column lat double precision;
alter table public.member_locations add column lng double precision;

update public.member_locations set
  lat = extensions.st_y(location::extensions.geometry),
  lng = extensions.st_x(location::extensions.geometry);

alter table public.member_locations alter column lat set not null;
alter table public.member_locations alter column lng set not null;
alter table public.member_locations drop column location;

create or replace function public.upsert_member_location(
  _trip_id uuid,
  _lat double precision,
  _lng double precision,
  _accuracy_m real default null,
  _heading_deg real default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  _member_id uuid;
begin
  select id into _member_id
  from public.trip_members
  where trip_id = _trip_id
    and user_id = auth.uid()
    and status = 'active';

  if _member_id is null then
    raise exception 'not an active member of this trip';
  end if;

  insert into public.member_locations (
    trip_member_id, lat, lng, accuracy_m, heading_deg, updated_at
  ) values (
    _member_id,
    _lat,
    _lng,
    _accuracy_m,
    _heading_deg,
    now()
  )
  on conflict (trip_member_id) do update set
    lat = excluded.lat,
    lng = excluded.lng,
    accuracy_m = excluded.accuracy_m,
    heading_deg = excluded.heading_deg,
    updated_at = now();
end;
$$;
