-- Packing lists: a shared "common gear" list for the trip plus each member's private personal
-- list. Items carry a category, quantity and packed flag; shared items can be assigned to the
-- member who brings them. This is plain collaborative CRUD (like trip_events / trip_pois), so
-- the client writes the table directly under member/owner-scoped RLS - no RPC layer.

create table public.packing_items (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  scope text not null check (scope in ('shared', 'personal')),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  label text not null,
  category text not null check (
    category in ('clothes', 'toiletries', 'documents', 'electronics', 'health', 'other')
  ),
  quantity integer not null default 1 check (quantity > 0),
  assigned_member uuid references public.trip_members (id) on delete set null,
  packed boolean not null default false,
  created_at timestamptz not null default now()
);

create index packing_items_trip_idx on public.packing_items (trip_id);

alter table public.packing_items enable row level security;

-- Shared items: visible and editable by every active trip member. Personal items: only by their
-- owner. Inserts must belong to a trip the caller is a member of, and a personal item's owner is
-- pinned to the caller (so nobody can create a personal item for someone else).
create policy "packing_items_member" on public.packing_items
  for all to authenticated
  using (
    (scope = 'shared' and private.is_trip_member(trip_id))
    or (scope = 'personal' and owner_id = (select auth.uid()))
  )
  with check (
    (scope = 'shared' and private.is_trip_member(trip_id))
    or (
      scope = 'personal'
      and owner_id = (select auth.uid())
      and private.is_trip_member(trip_id)
    )
  );
