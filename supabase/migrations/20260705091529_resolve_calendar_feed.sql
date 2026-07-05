-- WHY: the calendar-feed edge function must reach private.calendar_feed_tokens and the rate-limit
-- table, but PostgREST only exposes [public, graphql_public] - .schema('private') fails for every
-- caller including service role. House pattern: private data is reached through ONE public
-- SECURITY DEFINER RPC. This one does the whole gate atomically: hash the raw bearer token, find
-- the live token row, require the owning member to still be ACTIVE on the trip, and enforce a
-- fixed-window rate limit (same upsert idiom as public.check_rate_limit, but keyed on the token
-- OWNER because this endpoint has no auth.uid() - calendar clients cannot authenticate).
-- Service-role only: calendar-feed is the sole caller.
create or replace function public.resolve_calendar_feed(
  _token text,
  _limit integer default 60,
  _window_seconds integer default 60
)
returns table (trip_id uuid, rate_limited boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  _row record;
  _count integer;
begin
  select t.trip_id, t.user_id into _row
  from private.calendar_feed_tokens t
  where t.token_hash = encode(extensions.digest(_token, 'sha256'), 'hex')
    and t.revoked_at is null;

  if _row.trip_id is null then
    return;
  end if;

  if not exists (
    select 1 from public.trip_members m
    where m.trip_id = _row.trip_id and m.user_id = _row.user_id and m.status = 'active'
  ) then
    return;
  end if;

  insert into private.rate_limits as r (user_id, bucket, window_start, count)
  values (_row.user_id, 'calendar-feed:' || _row.trip_id, now(), 1)
  on conflict (user_id, bucket) do update
    set
      count = case
        when r.window_start < now() - make_interval(secs => _window_seconds) then 1
        else r.count + 1
      end,
      window_start = case
        when r.window_start < now() - make_interval(secs => _window_seconds) then now()
        else r.window_start
      end
  returning r.count into _count;

  if _count > _limit then
    return query select null::uuid, true;
  else
    return query select _row.trip_id, false;
  end if;
end;
$$;

revoke all on function public.resolve_calendar_feed(text, integer, integer) from public;
revoke all on function public.resolve_calendar_feed(text, integer, integer) from anon;
revoke all on function public.resolve_calendar_feed(text, integer, integer) from authenticated;
grant execute on function public.resolve_calendar_feed(text, integer, integer) to service_role;
