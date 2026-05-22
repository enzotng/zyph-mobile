-- Initial ZYPH schema: trips, members, timeline, expenses (mutable + soft-delete),
-- media. RLS scoped to active trip membership via a SECURITY DEFINER helper.

-- Extensions
create extension if not exists postgis with schema extensions;
create extension if not exists moddatetime with schema extensions;

-- Private schema for SECURITY DEFINER helpers (not exposed to the Data API)
create schema if not exists private;

-- Enums
create type public.trip_role as enum ('owner', 'member');
create type public.member_status as enum ('invited', 'active');

-- profiles (extends auth.users)
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  avatar_url text,
  preferred_currency text not null default 'EUR',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- trips
create table public.trips (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  destination text,
  start_date date,
  end_date date,
  currency text not null default 'EUR',
  invite_code text not null unique default encode(extensions.gen_random_bytes(6), 'hex'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint trips_dates_check check (
    start_date is null or end_date is null or end_date >= start_date
  )
);

-- trip_members
create table public.trip_members (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.trip_role not null default 'member',
  status public.member_status not null default 'active',
  joined_at timestamptz not null default now(),
  unique (trip_id, user_id)
);

-- helper: active membership check (SECURITY DEFINER avoids RLS recursion on trip_members)
create or replace function private.is_trip_member(_trip_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.trip_members m
    where m.trip_id = _trip_id
      and m.user_id = auth.uid()
      and m.status = 'active'
  );
$$;

-- trip_events (timeline, geolocated)
create table public.trip_events (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  title text not null,
  type text not null default 'event',
  starts_at timestamptz,
  location geography (Point, 4326),
  notes text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- expenses (mutable + soft-delete + optimistic version)
create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  description text not null,
  amount_cents integer not null check (amount_cents >= 0),
  currency text not null default 'EUR',
  paid_by uuid references public.trip_members (id) on delete set null,
  created_by uuid references public.profiles (id) on delete set null,
  version integer not null default 1,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.expense_splits (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references public.expenses (id) on delete cascade,
  member_id uuid not null references public.trip_members (id) on delete cascade,
  share_cents integer not null check (share_cents >= 0),
  created_at timestamptz not null default now(),
  unique (expense_id, member_id)
);

-- media (binary lives in Storage; this is metadata)
create table public.media (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  owner_id uuid references public.profiles (id) on delete set null,
  storage_path text not null,
  kind text not null default 'image',
  width integer,
  height integer,
  created_at timestamptz not null default now()
);

-- Indexes (incl. covering indexes for all foreign keys)
create index trips_owner_id_idx on public.trips (owner_id);
create index trip_members_user_id_idx on public.trip_members (user_id);
create index trip_members_trip_id_idx on public.trip_members (trip_id);
create index trip_events_trip_id_idx on public.trip_events (trip_id);
create index trip_events_created_by_idx on public.trip_events (created_by);
create index trip_events_location_idx on public.trip_events using gist (location);
create index expenses_trip_id_idx on public.expenses (trip_id) where deleted_at is null;
create index expenses_paid_by_idx on public.expenses (paid_by);
create index expenses_created_by_idx on public.expenses (created_by);
create index expense_splits_expense_id_idx on public.expense_splits (expense_id);
create index expense_splits_member_id_idx on public.expense_splits (member_id);
create index media_trip_id_idx on public.media (trip_id);
create index media_owner_id_idx on public.media (owner_id);

-- updated_at triggers
create trigger handle_updated_at before update on public.profiles
  for each row execute procedure extensions.moddatetime(updated_at);
create trigger handle_updated_at before update on public.trips
  for each row execute procedure extensions.moddatetime(updated_at);
create trigger handle_updated_at before update on public.trip_events
  for each row execute procedure extensions.moddatetime(updated_at);
create trigger handle_updated_at before update on public.expenses
  for each row execute procedure extensions.moddatetime(updated_at);

-- new auth user -> profile row
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute procedure private.handle_new_user();

-- new trip -> owner becomes an active member
create or replace function private.handle_new_trip()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.trip_members (trip_id, user_id, role, status)
  values (new.id, new.owner_id, 'owner', 'active');
  return new;
end;
$$;
create trigger on_trip_created after insert on public.trips
  for each row execute procedure private.handle_new_trip();

-- Row Level Security
alter table public.profiles enable row level security;
alter table public.trips enable row level security;
alter table public.trip_members enable row level security;
alter table public.trip_events enable row level security;
alter table public.expenses enable row level security;
alter table public.expense_splits enable row level security;
alter table public.media enable row level security;

-- profiles
create policy "profiles_select_self" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);
create policy "profiles_update_self" on public.profiles
  for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

-- trips
create policy "trips_select_member" on public.trips
  for select to authenticated using (private.is_trip_member(id) or owner_id = (select auth.uid()));
create policy "trips_insert_owner" on public.trips
  for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "trips_update_owner" on public.trips
  for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "trips_delete_owner" on public.trips
  for delete to authenticated using (owner_id = (select auth.uid()));

-- trip_members
create policy "members_select" on public.trip_members
  for select to authenticated using (private.is_trip_member(trip_id) or user_id = (select auth.uid()));
create policy "members_insert_owner" on public.trip_members
  for insert to authenticated with check (
    exists (select 1 from public.trips t where t.id = trip_id and t.owner_id = (select auth.uid()))
  );
create policy "members_delete_owner" on public.trip_members
  for delete to authenticated using (
    exists (select 1 from public.trips t where t.id = trip_id and t.owner_id = (select auth.uid()))
  );

-- trip_events / expenses / media: members full access
create policy "events_all_member" on public.trip_events
  for all to authenticated using (private.is_trip_member(trip_id)) with check (private.is_trip_member(trip_id));
create policy "expenses_all_member" on public.expenses
  for all to authenticated using (private.is_trip_member(trip_id)) with check (private.is_trip_member(trip_id));
create policy "media_all_member" on public.media
  for all to authenticated using (private.is_trip_member(trip_id)) with check (private.is_trip_member(trip_id));

-- expense_splits: members of the parent expense's trip
create policy "splits_all_member" on public.expense_splits
  for all to authenticated using (
    exists (select 1 from public.expenses e where e.id = expense_id and private.is_trip_member(e.trip_id))
  ) with check (
    exists (select 1 from public.expenses e where e.id = expense_id and private.is_trip_member(e.trip_id))
  );

-- Grants (RLS still gates rows; no access for anon)
grant usage on schema private to authenticated;
grant execute on function private.is_trip_member(uuid) to authenticated;
grant select, insert, update, delete on
  public.profiles, public.trips, public.trip_members,
  public.trip_events, public.expenses, public.expense_splits, public.media
  to authenticated;
