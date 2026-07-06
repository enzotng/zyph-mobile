-- Unified taxonomy on the timeline side: trip_events gains a required root `category` and an
-- optional dotted `subcategory` (full code, e.g. 'transport.flight'). Backfilled from the legacy
-- free-text `type` via the same mapping as the app's LEGACY_TYPE_MAP (generic roots keep a NULL
-- subcategory - never fabricate a leaf). The legacy `type` column is frozen (kept, unused by
-- readers after this release) and dropped in a later cleanup.
--
-- SAFE LIVE ROLLOUT: category is `not null default 'other'`. The DEFAULT keeps in-flight OLD app
-- builds (which insert without a category) working during the window between this migration hitting
-- prod and the new app shipping - and it makes `category` OPTIONAL in the generated Insert type, so
-- the current client code compiles unchanged. The default is intentional and dropped in Lot 3 once
-- every build sends an explicit category.

alter table public.trip_events add column category text not null default 'other';
alter table public.trip_events add column subcategory text;

update public.trip_events
set
  category = case type
    when 'flight' then 'transport'
    when 'hotel' then 'lodging'
    when 'lodging' then 'lodging'
    when 'transport' then 'transport'
    when 'activity' then 'activity'
    when 'food' then 'food'
    when 'event' then 'other'
    else 'other'
  end,
  subcategory = case type
    when 'flight' then 'transport.flight'
    when 'hotel' then 'lodging.hotel'
    when 'event' then 'other.event'
    else null
  end;

alter table public.trip_events
  add constraint trip_events_category_check
  check (category in ('transport', 'lodging', 'food', 'activity', 'shopping', 'health', 'fees', 'other'));
