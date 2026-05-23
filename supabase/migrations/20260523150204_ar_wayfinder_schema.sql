-- AR Wayfinder schema: POIs, live member locations, gate location for flights.

-- 1. POIs (custom waypoints inside a trip: gate, toilets, ATM, ...)
create table public.trip_pois (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  label text not null,
  icon text not null default 'pin',
  location extensions.geography (Point, 4326) not null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index trip_pois_trip_id_idx on public.trip_pois (trip_id);

alter table public.trip_pois enable row level security;

create policy "pois_select_member" on public.trip_pois
  for select to authenticated using (private.is_trip_member(trip_id));

create policy "pois_insert_member" on public.trip_pois
  for insert to authenticated with check (private.is_trip_member(trip_id));

create policy "pois_update_member" on public.trip_pois
  for update to authenticated using (private.is_trip_member(trip_id));

create policy "pois_delete_member" on public.trip_pois
  for delete to authenticated using (private.is_trip_member(trip_id));

-- 2. Live member locations (opt-in foreground sharing for AR + map)
create table public.member_locations (
  trip_member_id uuid primary key references public.trip_members (id) on delete cascade,
  location extensions.geography (Point, 4326) not null,
  accuracy_m real,
  heading_deg real,
  updated_at timestamptz not null default now()
);

alter table public.member_locations enable row level security;

create policy "member_locations_select_comember" on public.member_locations
  for select to authenticated using (
    exists (
      select 1
      from public.trip_members me
      join public.trip_members them on them.trip_id = me.trip_id
      where me.user_id = auth.uid()
        and me.status = 'active'
        and them.id = member_locations.trip_member_id
        and them.status = 'active'
    )
  );

create policy "member_locations_insert_self" on public.member_locations
  for insert to authenticated with check (
    exists (
      select 1
      from public.trip_members
      where id = trip_member_id
        and user_id = auth.uid()
        and status = 'active'
    )
  );

create policy "member_locations_update_self" on public.member_locations
  for update to authenticated using (
    exists (
      select 1
      from public.trip_members
      where id = trip_member_id
        and user_id = auth.uid()
    )
  );

create policy "member_locations_delete_self" on public.member_locations
  for delete to authenticated using (
    exists (
      select 1
      from public.trip_members
      where id = trip_member_id
        and user_id = auth.uid()
    )
  );

-- RPC: upsert_member_location — caller-as-self, by trip id (resolves member id).
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
    trip_member_id, location, accuracy_m, heading_deg, updated_at
  ) values (
    _member_id,
    extensions.st_setsrid(extensions.st_makepoint(_lng, _lat), 4326)::extensions.geography,
    _accuracy_m,
    _heading_deg,
    now()
  )
  on conflict (trip_member_id) do update set
    location = excluded.location,
    accuracy_m = excluded.accuracy_m,
    heading_deg = excluded.heading_deg,
    updated_at = now();
end;
$$;

revoke all on function public.upsert_member_location(uuid, double precision, double precision, real, real) from public;
revoke all on function public.upsert_member_location(uuid, double precision, double precision, real, real) from anon;
grant execute on function public.upsert_member_location(uuid, double precision, double precision, real, real) to authenticated;

-- RPC: clear_member_location — stops sharing for the caller in a trip.
create or replace function public.clear_member_location(_trip_id uuid)
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
    and user_id = auth.uid();

  if _member_id is null then
    return;
  end if;

  delete from public.member_locations where trip_member_id = _member_id;
end;
$$;

revoke all on function public.clear_member_location(uuid) from public;
revoke all on function public.clear_member_location(uuid) from anon;
grant execute on function public.clear_member_location(uuid) to authenticated;

-- 3. Optional gate_location on flight events (more precise than airport-level coords).
alter table public.trip_events
  add column gate_location jsonb;
