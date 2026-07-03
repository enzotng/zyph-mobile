-- Trip profile / preferences: per-trip travel preferences that ground Zo's future
-- itinerary suggestions (trip type, budget, pace, interests, dietary). Edited by the
-- owner only (the existing trips_update_owner RLS already gates UPDATE on owner_id),
-- read by every member (trips_select_member). No new policy needed.
--
-- Scalars are nullable text + CHECK (not a pg enum, so adding a value is a CHECK swap,
-- never an ALTER TYPE) and "not set" is simply null. interests/dietary are text[]
-- (default '{}', never null) and intentionally have no CHECK: their allowed values are
-- validated app-side against a TS const, so extending the lists is a code change only.
-- budget_total_cents is integer cents in the trip's own currency (no FX stored here).

alter table public.trips
  add column trip_type text,
  add column budget_level text,
  add column budget_total_cents integer,
  add column pace text,
  add column interests text[] not null default '{}',
  add column dietary text[] not null default '{}';

alter table public.trips
  add constraint trips_trip_type_check check (
    trip_type is null or trip_type in (
      'beach', 'city_break', 'road_trip', 'nature', 'ski', 'cultural', 'foodie',
      'adventure', 'wellness', 'family', 'festival', 'business', 'backpacking'
    )
  ),
  add constraint trips_budget_level_check check (
    budget_level is null or budget_level in ('low', 'medium', 'high', 'luxury')
  ),
  add constraint trips_pace_check check (
    pace is null or pace in ('relaxed', 'balanced', 'packed')
  ),
  add constraint trips_budget_total_cents_check check (
    budget_total_cents is null or budget_total_cents >= 0
  );
