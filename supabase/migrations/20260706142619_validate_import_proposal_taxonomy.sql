-- Unified taxonomy on the inbound-email path: validate_import_proposal maps the reviewed proposal
-- events into trip_events. Post-taxonomy it must write `category`/`subcategory` (not the legacy
-- `type`, which is now vestigial). The proposal jsonb may carry either the NEW shape (category +
-- subcategory, from the reworked parser) or the LEGACY shape (type, for proposals created before
-- this rollout), so we resolve both:
--   category:    explicit only if it is one of the 8 valid roots, else mapped from the legacy
--                `type`, else 'other' (can never violate trip_events_category_check).
--   subcategory: explicit only if it is prefixed by the resolved category, else the legacy type's
--                leaf, else null (never fabricate a leaf for a generic root).
-- NB: the subcategory guard here is prefix + shape/length only (the shape/length bound lives in the
-- trip_events_subcategory_format_check DB constraint); full closed-vocabulary MEMBERSHIP is enforced
-- upstream by the edge normalize (SUBCATEGORIES allowlist) and the client zod (isValidSubcategory),
-- per the app-owned-taxonomy design (the DB deliberately does not enumerate leaves, for agility).
-- The remaining columns and the pending->validated guard are unchanged from 20260705212947.
create or replace function public.validate_import_proposal(_proposal_id uuid, _events jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  _uid uuid := auth.uid();
  _trip_id uuid;
begin
  select trip_id into _trip_id from public.import_proposals where id = _proposal_id;
  if _trip_id is null then
    raise exception 'proposal not found';
  end if;

  if not exists (
    select 1 from public.trip_members
    where trip_id = _trip_id and user_id = _uid and status = 'active'
  ) then
    raise exception 'not an active member of this trip';
  end if;

  update public.import_proposals
  set status = 'validated', validated_by = _uid, validated_at = now(), sender_email = null
  where id = _proposal_id and status = 'pending';

  if not found then
    raise exception 'proposal is not pending';
  end if;

  insert into public.trip_events (
    trip_id, title, category, subcategory, starts_at, ends_at, notes, lat, lng, place_id,
    gate_location, location_name, end_location, participants, created_by
  )
  select
    _trip_id,
    e ->> 'title',
    cat.category,
    case
      when nullif(e ->> 'subcategory', '') is not null
        and (e ->> 'subcategory') like cat.category || '.%'
        then e ->> 'subcategory'
      else case e ->> 'type'
        when 'flight' then 'transport.flight'
        when 'hotel' then 'lodging.hotel'
        when 'event' then 'other.event'
        else null
      end
    end,
    (e ->> 'startsAt')::timestamptz,
    nullif(e ->> 'endsAt', '')::timestamptz,
    nullif(e ->> 'notes', ''),
    (e ->> 'lat')::double precision,
    (e ->> 'lng')::double precision,
    nullif(e ->> 'placeId', ''),
    case when jsonb_typeof(e -> 'gateLocation') = 'object' then e -> 'gateLocation' else null end,
    nullif(e ->> 'locationName', ''),
    case when jsonb_typeof(e -> 'endLocation') = 'object' then e -> 'endLocation' else null end,
    case
      when jsonb_typeof(e -> 'participants') = 'array'
        then array(select jsonb_array_elements_text(e -> 'participants'))::uuid[]
      else null
    end,
    _uid
  from jsonb_array_elements(_events) as e
  cross join lateral (
    select case
      when nullif(e ->> 'category', '') in
        ('transport', 'lodging', 'food', 'activity', 'shopping', 'health', 'fees', 'other')
        then e ->> 'category'
      else case e ->> 'type'
        when 'flight' then 'transport'
        when 'hotel' then 'lodging'
        when 'lodging' then 'lodging'
        when 'transport' then 'transport'
        when 'activity' then 'activity'
        when 'food' then 'food'
        when 'event' then 'other'
        else 'other'
      end
    end as category
  ) as cat;
end;
$$;
