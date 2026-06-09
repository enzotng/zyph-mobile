-- Per-device push locale so lock-screen copy can be localized (FR/EN). The locale lives on the
-- device token rather than the profile (a user may carry an FR phone and an EN phone), defaulting
-- to null -> the send-push edge function falls back to French. register_push_token gains an
-- optional third arg; the 2-arg signature is dropped first so the name does not become ambiguous.

alter table public.push_tokens add column locale text;

drop function if exists public.register_push_token(text, text);

create or replace function public.register_push_token(
  _token text,
  _platform text,
  _locale text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  _uid uuid := auth.uid();
begin
  if _uid is null then
    raise exception 'not authenticated';
  end if;
  if _token is null or length(trim(_token)) = 0 then
    raise exception 'token is required';
  end if;
  if _platform not in ('ios', 'android', 'web') then
    raise exception 'invalid platform';
  end if;

  -- Normalise and cap the optional, user-supplied locale (matches the _token/_platform guards).
  _locale := nullif(left(lower(trim(_locale)), 35), '');

  insert into public.push_tokens (token, user_id, platform, locale, updated_at)
  values (trim(_token), _uid, _platform, _locale, now())
  on conflict (token) do update
    set user_id = excluded.user_id,
        platform = excluded.platform,
        locale = excluded.locale,
        updated_at = now();
end;
$$;

revoke all on function public.register_push_token(text, text, text) from public;
revoke all on function public.register_push_token(text, text, text) from anon;
grant execute on function public.register_push_token(text, text, text) to authenticated;
