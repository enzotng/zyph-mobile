-- Per-user fixed-window rate limiting for the LLM / geocoding edge functions, so an authenticated
-- caller cannot run up the Groq / Photon quota or cost. Counters live in a private table (not
-- exposed via the API); check_rate_limit atomically increments the current window and returns
-- whether the call is allowed. Edge functions fail OPEN when this RPC is unavailable.

create table private.rate_limits (
  user_id uuid not null,
  bucket text not null,
  window_start timestamptz not null default now(),
  count integer not null default 0,
  primary key (user_id, bucket)
);

-- Defence in depth: the table lives in the unexposed private schema and is only touched by the
-- SECURITY DEFINER function below (its owner bypasses RLS), so no policy is needed.
alter table private.rate_limits enable row level security;

create or replace function public.check_rate_limit(
  _bucket text,
  _limit integer,
  _window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  _uid uuid := auth.uid();
  _count integer;
begin
  if _uid is null then
    return false;
  end if;

  insert into private.rate_limits as r (user_id, bucket, window_start, count)
  values (_uid, _bucket, now(), 1)
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
  returning count into _count;

  return _count <= _limit;
end;
$$;

revoke all on function public.check_rate_limit(text, integer, integer) from public;
revoke all on function public.check_rate_limit(text, integer, integer) from anon;
grant execute on function public.check_rate_limit(text, integer, integer) to authenticated;
