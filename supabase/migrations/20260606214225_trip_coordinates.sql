-- Store the chosen destination's coordinates so trip weather can use them directly instead of
-- re-geocoding the free-text destination (which fails for small towns / non-city places). Both
-- nullable: a free-text destination (no autocomplete pick) leaves them null and weather falls
-- back to geocoding the name. Set from the place-search autocomplete on trip create/edit.

alter table public.trips
  add column latitude double precision,
  add column longitude double precision;
